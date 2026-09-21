"""Main video generation engine."""

import threading
import tempfile
import uuid
from pathlib import Path
from typing import Callable


class RenderCancelled(Exception):
    """Raised inside make_frame when the caller requests cancellation."""

import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from moviepy import VideoClip, VideoFileClip

from src.animations.scroll import ScrollingAnimation
from src.core.audio_handler import load_audio
from src.core.lyrics_parser import parse_lyrics
from src.core.text_renderer import TextRenderer
from src.core.theme_loader import Theme, load_theme

FPS_DEFAULT = 30

# Target output resolution
_WIDTH = 1920
_HEIGHT = 1080

RESOLUTIONS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
}


def _fit_to_frame(img: Image.Image, width: int = _WIDTH, height: int = _HEIGHT) -> Image.Image:
    """Scale and center-crop a PIL image to width x height (cover mode)."""
    orig_w, orig_h = img.size
    if orig_w == width and orig_h == height:
        return img
    scale = max(width / orig_w, height / orig_h)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)
    img = img.resize((new_w, new_h), Image.BILINEAR)
    left = (new_w - width) // 2
    top = (new_h - height) // 2
    return img.crop((left, top, left + width, top + height))


_vignette_cache: dict[tuple[int, int], np.ndarray] = {}


def _get_vignette_mask(h: int, w: int) -> np.ndarray:
    key = (h, w)
    if key not in _vignette_cache:
        x = np.linspace(-1, 1, w, dtype=np.float32)
        y = np.linspace(-1, 1, h, dtype=np.float32)
        xx, yy = np.meshgrid(x, y)
        radius = np.sqrt(xx ** 2 + yy ** 2)
        mask = np.clip(1.0 - (radius - 0.45) * 0.75, 0.0, 1.0)[:, :, np.newaxis]
        _vignette_cache[key] = mask
    return _vignette_cache[key]


def _apply_vignette_np(frame: np.ndarray) -> np.ndarray:
    h, w, _ = frame.shape
    mask = _get_vignette_mask(h, w)
    return (frame.astype(np.float32) * mask).astype(np.uint8)


def _apply_letterbox_bars_np(frame: np.ndarray, target_ratio_str: str, bar_color_hex: str = "#000000") -> np.ndarray:
    ratio_map = {
        "2.39:1": 2.39,
        "1.85:1": 1.85,
        "4:3": 4.0 / 3.0,
    }
    target_ratio = ratio_map.get(target_ratio_str)
    if not target_ratio:
        return frame

    h, w, _ = frame.shape
    frame_ratio = w / h
    hex_clean = bar_color_hex.lstrip("#")
    if len(hex_clean) == 6:
        color = [int(hex_clean[i:i+2], 16) for i in (0, 2, 4)]
    else:
        color = [0, 0, 0]

    out = frame.copy()
    if target_ratio > frame_ratio:
        visible_h = w / target_ratio
        bar_h = int((h - visible_h) / 2)
        if bar_h > 0:
            out[:bar_h, :] = color
            out[h - bar_h:, :] = color
    else:
        visible_w = h * target_ratio
        bar_w = int((w - visible_w) / 2)
        if bar_w > 0:
            out[:, :bar_w] = color
            out[:, w - bar_w:] = color
    return out


def _apply_visual_filter(img: Image.Image, filter_name: str, t: float = 0.0) -> Image.Image:
    if not filter_name or filter_name == "none":
        return img

    if filter_name == "pixelate":
        block_size = 16
        small = img.resize((max(1, img.width // block_size), max(1, img.height // block_size)), Image.NEAREST)
        return small.resize((img.width, img.height), Image.NEAREST)

    if filter_name == "film-grain":
        arr = np.array(img, dtype=np.int16)
        noise = np.random.randint(-12, 13, (img.height, img.width, 1), dtype=np.int16)
        arr[:, :, :3] = np.clip(arr[:, :, :3] + noise, 0, 255)
        return Image.fromarray(arr.astype(np.uint8), "RGBA")

    if filter_name == "cyberpunk-neon":
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(1.4)
        enhancer_con = ImageEnhance.Contrast(img)
        return enhancer_con.enhance(1.25)

    if filter_name == "teal-orange":
        arr = np.array(img, dtype=np.float32)
        arr[:, :, 0] = np.clip(arr[:, :, 0] * 1.15, 0, 255)
        arr[:, :, 2] = np.clip(arr[:, :, 2] * 0.88 + 15, 0, 255)
        return Image.fromarray(arr.astype(np.uint8), "RGBA")

    if filter_name == "crt-scanlines":
        arr = np.array(img, dtype=np.uint8)
        arr[::4, :, :3] = (arr[::4, :, :3] * 0.65).astype(np.uint8)
        return Image.fromarray(arr, "RGBA")

    if filter_name == "vhs-glitch":
        arr = np.array(img)
        shift = 4
        r = np.roll(arr[:, :, 0], -shift, axis=1)
        b = np.roll(arr[:, :, 2], shift, axis=1)
        arr[:, :, 0] = r
        arr[:, :, 2] = b
        return Image.fromarray(arr, "RGBA")

    return img


def _build_bg_frame_getter(
    background_path: str | Path,
    width: int = _WIDTH,
    height: int = _HEIGHT,
    theme: Theme | None = None,
) -> tuple[Callable[[float], Image.Image], Callable[[], None]]:
    """Return a function that maps video time t → background PIL Image, and a cleanup callback."""
    clip = VideoFileClip(str(background_path), audio=False)
    bg_dur = clip.duration
    cycle = 2.0 * bg_dur
    _eps = 1.0 / 60.0

    def get_bg_frame(t: float) -> Image.Image:
        ct = t % cycle
        bg_t = ct if ct <= bg_dur else cycle - ct
        bg_t = min(max(bg_t, 0.0), bg_dur - _eps)
        frame = clip.get_frame(bg_t)  # HxWx3 uint8
        img = Image.fromarray(frame.astype(np.uint8), "RGB").convert("RGBA")
        fitted = _fit_to_frame(img, width=width, height=height)
        if theme is not None:
            if getattr(theme, "background_blur", 0) > 0:
                radius = min(int(theme.background_blur), 20)
                fitted = fitted.filter(ImageFilter.GaussianBlur(radius=radius))
            active_filter = getattr(theme, "active_filter", "none")
            if active_filter and active_filter != "none":
                fitted = _apply_visual_filter(fitted, active_filter, t)
        return fitted

    def cleanup():
        try:
            clip.close()
        except Exception:
            pass

    return get_bg_frame, cleanup



def generate_video(
    lyrics_path: str | Path,
    audio_path: str | Path,
    output_path: str | Path,
    theme_path: str | Path | None = None,
    theme: Theme | None = None,
    fps: int = FPS_DEFAULT,
    preview: bool = False,
    preview_start: float = 0.0,
    background_path: str | Path | None = None,
    lyric_position: str | None = None,
    highlight_mode: str | None = None,
    aspect_ratio: str | None = None,
    width: int | None = None,
    height: int | None = None,
    logger: str | None = "bar",
    progress_callback: Callable[[int, int], None] | None = None,
    cancel_event: threading.Event | None = None,
) -> Path:
    """Generate a lyric video from lyrics JSON and an audio file.

    Args:
        lyrics_path: Path to lyrics JSON file.
        audio_path: Path to audio file.
        output_path: Path for the output MP4.
        theme_path: Path to theme JSON (None for default theme).
        fps: Frames per second (default 30).
        preview: If True, only generate the first 30 seconds.
        background_path: Path to background video (None for solid color).
        aspect_ratio: Video aspect ratio ('16:9', '9:16', '1:1', '4:5').

    Returns:
        The output file path.
    """
    # Load inputs
    lyrics_data = parse_lyrics(lyrics_path)
    audio = load_audio(audio_path)
    theme_obj = theme if theme is not None else load_theme(theme_path)
    if lyric_position is not None:
        theme_obj.lyric_position = lyric_position
    if highlight_mode is not None:
        theme_obj.highlight_mode = highlight_mode

    # Resolve output resolution
    target_aspect = aspect_ratio or getattr(theme_obj, "aspect_ratio", "16:9")
    default_w, default_h = RESOLUTIONS.get(target_aspect, (1920, 1080))
    render_w = width if width is not None else default_w
    render_h = height if height is not None else default_h

    renderer = TextRenderer(theme_obj, width=render_w, height=render_h)

    lines = lyrics_data["lines"]
    gap_periods = lyrics_data.get("gap_periods", [])
    intro_end_time = lyrics_data.get("intro_end_time")
    outro_start_time = lyrics_data.get("outro_start_time")
    total_duration = audio.duration
    if preview:
        total_duration = max(min(audio.duration - preview_start, 30.0), 0.0)
        # Keep all lines — those beyond total_duration are never reached by
        # make_frame(t) but are needed so the scroll queue shows upcoming lines
        # right up to the end of the preview window.

    print(f"Generating video: {lyrics_data['title']} by {lyrics_data['artist']}")
    print(f"Resolution: {render_w}x{render_h} ({target_aspect}) | FPS: {fps} | Duration: {total_duration:.1f}s | Lyric lines: {len(lines)}")

    # Build background frame getter (ping-pong loop) if a video was provided
    bg_frame_getter = None
    bg_cleanup = None
    if background_path is not None:
        print(f"Background: {background_path} (ping-pong loop, {render_w}x{render_h})")
        bg_frame_getter, bg_cleanup = _build_bg_frame_getter(
            background_path, width=render_w, height=render_h, theme=theme_obj
        )

    # Build scrolling animation over all lines
    animation = ScrollingAnimation(
        lines=lines,
        fps=fps,
        line_height=theme_obj.line_height,
        inactive_alphas=theme_obj.inactive_text_opacity_gradient,
        intro_lines=(
            [
                "__LOGO__" if theme_obj.logo_path else lyrics_data.get("artist", ""),
                lyrics_data["title"],
            ]
            if intro_end_time is not None else None
        ),
        intro_end_time=intro_end_time,
        outro_lines=(
            [
                "__LOGO__" if theme_obj.logo_path else lyrics_data.get("artist", ""),
                lyrics_data["title"],
            ]
            if outro_start_time is not None else None
        ),
        outro_start_time=outro_start_time,
        gap_periods=gap_periods,
        height=render_h,
        width=render_w,
    )

    total_frames = max(int(total_duration * fps), 1)
    _frame_count: list[int] = [0]

    def make_frame(t: float):
        if cancel_event is not None and cancel_event.is_set():
            raise RenderCancelled
        actual_t = t + preview_start if preview else t
        bg = bg_frame_getter(actual_t) if bg_frame_getter is not None else None
        result = animation.make_frame(actual_t, renderer, background=bg)

        # Apply Vignette & Letterbox post-processing if enabled
        if getattr(theme_obj, "vignette_enabled", False):
            result = _apply_vignette_np(result)
        letterbox = getattr(theme_obj, "letterbox_bars", "none")
        if letterbox and letterbox != "none":
            result = _apply_letterbox_bars_np(result, letterbox, getattr(theme_obj, "letterbox_color", "#000000"))

        _frame_count[0] += 1
        if progress_callback is not None:
            progress_callback(min(_frame_count[0], total_frames), total_frames)
        return result

    # Build video clip
    audio_start = preview_start if preview else 0.0
    video = VideoClip(frame_function=make_frame, duration=total_duration)
    video = video.with_fps(fps)

    if preview:
        end_t = min(audio_start + total_duration, audio.duration)
        video = video.with_audio(audio.subclipped(audio_start, end_t))
    else:
        video = video.with_audio(audio)

    # Ensure output directory exists
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Temporary audio file path in standard /tmp directory to avoid permission issues
    temp_dir = Path(tempfile.gettempdir())
    temp_audio = str(temp_dir / f"temp_{uuid.uuid4().hex[:8]}_audio.m4a")

    # Export with memory-optimized FFmpeg parameters
    print(f"Exporting to {output_path} (preset=ultrafast, threads=2)...")
    try:
        video.write_videofile(
            str(output_path),
            fps=fps,
            codec="libx264",
            audio_codec="aac",
            preset="ultrafast",
            threads=2,
            ffmpeg_params=[
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                "-max_muxing_queue_size", "1024",
            ],
            temp_audiofile=temp_audio,
            remove_temp=True,
            logger=logger,
        )
    finally:
        try:
            video.close()
        except Exception:
            pass
        try:
            audio.close()
        except Exception:
            pass
        if bg_cleanup is not None:
            try:
                bg_cleanup()
            except Exception:
                pass
        if Path(temp_audio).exists():
            try:
                Path(temp_audio).unlink()
            except Exception:
                pass

    print(f"Done! Video saved to {output_path}")
    return output_path


"""Per-word / per-character entrance animation applier for the Python renderer.

The web dashboard drives entrance animations via CSS classes + animation-delay.
This module computes the matching per-token transforms (scale, dy, blur, opacity)
from the same spring physics so the final render matches the preview.

Usage:
    from src.animations.text_entrances import TextEntranceApplier

    applier = TextEntranceApplier(theme, active_index, clips, t, fps)
    for each visible line:
        transforms = applier.word_transforms(line_idx, line_text)
        # transforms: list of (word_str, scale, dy, blur_rad, opacity) for each word
"""

from __future__ import annotations

from typing import Callable

from PIL import Image, ImageDraw, ImageFont, ImageFilter

from src.animations.spring import (
    SpringParams,
    blur_value,
    pop_scale_value,
    stagger_delay,
    translate_value,
)
from src.core.theme_loader import Theme


def _default_spring(theme: Theme) -> SpringParams:
    return SpringParams(
        damping=float(getattr(theme, "spring_damping", 18) or 18),
        stiffness=float(getattr(theme, "spring_stiffness", 120) or 120),
        mass=float(getattr(theme, "spring_mass", 1) or 1),
    )


def _entrance_style(theme: Theme, line_entrance_override: str | None = None) -> str:
    if line_entrance_override:
        return line_entrance_override
    return getattr(theme, "entrance_style", "scroll") or "scroll"


def _word_animation(theme: Theme, line_word_override: str | None = None) -> str:
    if line_word_override:
        return line_word_override
    return getattr(theme, "word_animation", "none") or "none"


def _char_stagger_ms(theme: Theme) -> int:
    return int(getattr(theme, "char_stagger_ms", 0) or 0)


def _line_start_time(line: object, lines: list[object], line_idx: int) -> float:
    """Return the start time of the line at *line_idx*.

    Works with LyricLine objects (has start_time) or plain dicts.
    """
    if hasattr(line, "start_time"):
        return float(line.start_time)
    # Fallback: derive from lines list
    if line_idx == 0:
        return 0.0
    prev = lines[line_idx - 1]
    if hasattr(prev, "end_time"):
        return float(prev.end_time)
    return 0.0


class TextEntranceApplier:
    """Computes per-word/per-char entrance transforms for a lyric line at time *t*.

    The applier is stateless — call ``word_transforms`` for each line to get
    the list of word transforms for that line at the current frame time.
    """

    def __init__(
        self,
        theme: Theme,
        active_index: int,
        lines: list[object],
        t: float,
        fps: int = 30,
        clip_start_times: list[float] | None = None,
    ):
        """Args:
        theme: Resolved Theme (with entrance_style, word_animation, char_stagger_ms,
            spring_damping/stiffness/mass, font_weight, font_style, text_transform).
        active_index: Index of the currently-sung line (as determined by the timeline).
        lines: List of LyricLine objects (or dicts with text + start_time).
        t: Current video time in seconds.
        fps: Frame rate (used for sub-frame precision).
        clip_start_times: Optional explicit start times per line (overrides LyricLine).
        """
        self.theme = theme
        self.active_index = active_index
        self.lines = lines
        self.t = t
        self.fps = fps
        self.clip_start_times = clip_start_times

    def _start_time(self, line_idx: int) -> float:
        if self.clip_start_times is not None and line_idx < len(self.clip_start_times):
            return float(self.clip_start_times[line_idx])
        line = self.lines[line_idx] if line_idx < len(self.lines) else None
        return _line_start_time(line, self.lines, line_idx) if line is not None else 0.0

    def word_transforms(
        self,
        line_idx: int,
        text: str,
        entrance_override: str | None = None,
        word_animation_override: str | None = None,
    ) -> list[dict]:
        """Return per-word transform dicts for *text* at the current frame time.

        Each dict has keys:
            word: str — the word text
            scale: float — scale factor (1.0 = normal)
            dy: float — vertical pixel offset (positive = down)
            blur: float — blur radius in px (0 = no blur)
            opacity: float — alpha 0..1

        For non-active lines (line_idx < active_index), returns words at full
        alpha with no transform (the line is already visible).
        For lines beyond the active index, returns words at reduced alpha (the
        web preview uses inactive_text_opacity_gradient for these).
        """
        entrance = _entrance_style(self.theme, entrance_override)
        word_anim = _word_animation(self.theme, word_animation_override)
        stagger_ms = _char_stagger_ms(self.theme)
        spring = _default_spring(self.theme)

        # Non-active lines: no entrance transform, just dim alpha per the gradient.
        if line_idx < self.active_index:
            words = text.split()
            return [{"word": w, "scale": 1.0, "dy": 0.0, "blur": 0.0, "opacity": 1.0} for w in words]

        # Lines ahead of the active index: full opacity, no transform (will animate when reached).
        if line_idx > self.active_index:
            words = text.split()
            return [{"word": w, "scale": 1.0, "dy": 0.0, "blur": 0.0, "opacity": 1.0} for w in words]

        # Active line: compute per-word entrance transforms.
        line_start = self._start_time(line_idx)
        words = text.split()
        if not words:
            return []

        # Determine the effective entrance: if word_animation is set and entrance is 'none'/'scroll',
        # use word_animation as the per-word entrance.
        eff_entrance = entrance
        if entrance in ("none", "scroll", "typewriter") and word_anim != "none":
            eff_entrance = word_anim

        result: list[dict] = []
        for i, word in enumerate(words):
            delay = stagger_delay(i, stagger_ms)
            elapsed = max(0.0, self.t - line_start - delay)
            scale = 1.0
            dy = 0.0
            blur = 0.0
            opacity = 1.0

            if eff_entrance == "pop-scale":
                scale = pop_scale_value(elapsed, spring)
                opacity = min(1.0, max(0.0, elapsed * 8.0))  # quick fade-in
                if elapsed > 0.05:
                    opacity = 1.0
            elif eff_entrance == "blur-in":
                s = elapsed * 6.0  # quick rise
                if s < 1.0:
                    opacity = s
                else:
                    opacity = 1.0
                blur = blur_value(elapsed, spring)
            elif eff_entrance == "drop-in":
                s = elapsed * 5.0
                if s < 1.0:
                    opacity = s
                else:
                    opacity = 1.0
                dy = translate_value(elapsed, spring, peak=60.0)
                # clamp dy so the word doesn't fly off screen
                dy = max(-60.0, min(20.0, dy))
            elif eff_entrance == "fade":
                s = min(1.0, elapsed * 4.0)
                opacity = s
                dy = -16.0 * (1.0 - s)
            elif eff_entrance == "slide-left":
                s = min(1.0, elapsed * 5.0)
                opacity = s
                dy = 0.0
                # horizontal translate handled by the renderer via translateX
            elif eff_entrance == "slide-right":
                s = min(1.0, elapsed * 5.0)
                opacity = s
                dy = 0.0
            elif eff_entrance == "rotate-in":
                s = min(1.0, elapsed * 5.0)
                opacity = s
                dy = 0.0
            elif eff_entrance == "flip-up":
                s = min(1.0, elapsed * 5.0)
                opacity = s
                dy = 0.0
            elif eff_entrance == "wave" or eff_entrance == "raindrop":
                # Per-character stagger: handled at char level by the renderer.
                # At word level, just return opacity based on word index.
                s = min(1.0, (elapsed + i * 0.05) * 5.0)
                opacity = s
            elif eff_entrance == "raindrop":
                opacity = min(1.0, max(0.0, (elapsed - delay) * 6.0))
            else:
                # 'none' or 'scroll' or 'typewriter': no entrance transform.
                opacity = 1.0

            # Apply spring-mass tuning: if spring_damping is high, the motion is gentler.
            # (Already accounted for in the spring_value calls above.)

            result.append({
                "word": word,
                "scale": scale,
                "dy": dy,
                "blur": blur,
                "opacity": opacity,
                "angle": 0.0,  # placeholder for rotate-in / flip-up (not yet implemented in PIL)
            })

        return result


def draw_word(
    draw: ImageDraw.ImageDraw,
    word: str,
    x_cursor: float,
    y_center: float,
    font: ImageFont.FreeTypeFont,
    transform: dict,
    fill: tuple[int, int, int, int],
    stroke_width: int = 0,
    stroke_fill: tuple | None = None,
    anchor: str = "lm",
) -> float:
    """Draw a single word with the given transform onto *draw*'s layer.

    Returns the pixel width of the drawn word (so the caller can advance x_cursor).

    Args:
        draw: PIL ImageDraw for the current text layer.
        word: Word text.
        x_cursor: Current x position (left edge for 'lm' anchor).
        y_center: Vertical center of the line.
        font: Font to use.
        transform: dict from word_transforms() with scale, dy, blur, opacity, angle.
        fill: RGBA fill color.
        stroke_width: Pixel stroke width (0 = none).
        stroke_fill: RGBA stroke color (or None).
        anchor: PIL text anchor (default 'lm' = left-middle).
    """
    scale = transform.get("scale", 1.0)
    dy = transform.get("dy", 0.0)
    blur = transform.get("blur", 0.0)
    opacity = transform.get("opacity", 1.0)
    angle = transform.get("angle", 0.0)

    # Compute the word's pixel width at scale=1 so we can center/position correctly.
    try:
        base_width = font.getlength(word)
    except AttributeError:
        base_width, _ = font.getsize(word)  # type: ignore[attr-defined]

    scaled_width = base_width * scale

    # Adjust fill alpha by opacity.
    r, g, b, a = fill
    fill_opacity = int(a * opacity)
    fill_col = (r, g, b, fill_opacity)

    stroke_col = None
    if stroke_width > 0 and stroke_fill is not None:
        sr, sg, sb, sa = stroke_fill
        stroke_col = (sr, sg, sb, int(sa * opacity))

    # Effective draw position: anchor at the word's center horizontally, y_center dy-adjusted.
    # For anchor='lm' (left-middle), x_cursor is the left edge. We want the word centered
    # at the cursor position, so we offset by -scaled_width/2.
    draw_x = x_cursor - scaled_width / 2.0
    draw_y = y_center + dy

    if blur > 0.0:
        # Render the word to a small transparent layer, blur it, then composite.
        word_layer = Image.new("RGBA", (int(scaled_width + 20), int(font.size * scale + 20)), (0, 0, 0, 0))
        wdraw = ImageDraw.Draw(word_layer)
        wdraw.text((10 - scaled_width / 2.0, 10), word, font=font, fill=fill_col, anchor="lm",
                   stroke_width=stroke_width, stroke_fill=stroke_col)
        if blur > 0:
            word_layer = word_layer.filter(ImageFilter.GaussianBlur(blur))
        # Paste onto the main layer at the right position.
        paste_x = int(draw_x)
        paste_y = int(draw_y - font.size * scale / 2.0)
        draw._image.paste(word_layer, (paste_x, paste_y), word_layer)
        return scaled_width

    # No blur: draw directly.
    draw.text(
        (draw_x, draw_y),
        word,
        font=font,
        fill=fill_col,
        anchor=anchor,
        stroke_width=stroke_width if stroke_width > 0 else 0,
        stroke_fill=stroke_col,
    )
    return scaled_width


# Backward-compat alias kept because a previous text_renderer.py import referenced
# draw_word_with_transform. New code should use draw_word() directly.
draw_word_with_transform = draw_word

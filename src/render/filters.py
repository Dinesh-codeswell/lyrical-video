"""
Phase 1 Python-side filter parity for the video renderer.

These mirror the web preview's bloom, chromatic aberration, blend modes, and halation
so exported MP4 frames use the same composition behavior as the stage.

All functions operate on HxWx3 uint8 numpy arrays or PIL RGBA images.
"""

from __future__ import annotations

from typing import Literal

import numpy as np
from PIL import Image

BlendMode = Literal[
    "normal",
    "multiply",
    "screen",
    "overlay",
    "soft-light",
    "color-dodge",
    "difference",
]

FILTER_ENABLED_FALSE = object()


def _to_rgba(img: Image.Image) -> Image.Image:
    if img.mode == "RGBA":
        return img
    if img.mode == "RGB":
        return img.convert("RGBA")
    return img.convert("RGBA")


def _to_uint8_rgb(arr: np.ndarray) -> np.ndarray:
    if arr.dtype != np.uint8:
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    if arr.ndim == 3 and arr.shape[2] == 4:
        return arr[:, :, :3].copy()
    if arr.ndim == 2:
        return np.stack([arr, arr, arr], axis=2)
    return arr[:, :, :3].copy()


def compose_with_blend(
    base: Image.Image,
    overlay: Image.Image,
    blend: BlendMode = "normal",
    opacity: float = 1.0,
) -> Image.Image:
    """Composite *overlay* onto *base* using a simple pixel blend mode.

    Both images are converted to RGBA and resized to the same size if needed.
    """
    base = _to_rgba(base)
    overlay = _to_rgba(overlay)

    if base.size != overlay.size:
        overlay = overlay.resize(base.size, Image.LANCZOS)

    b = np.asarray(base, dtype=np.float32) / 255.0
    o = np.asarray(overlay, dtype=np.float32) / 255.0
    a = o[:, :, 3:4] * opacity

    out = _blend_pixels(b[:, :, :3], o[:, :, :3], blend)
    out = out * a + b[:, :, :3] * (1 - a)
    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)

    rgba = np.dstack([out, np.clip(b[:, :, 3] * a + b[:, :, 3] * (1 - a), 0, 1).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def _blend_pixels(a: np.ndarray, b: np.ndarray, mode: BlendMode) -> np.ndarray:
    if mode == "normal":
        return b
    if mode == "multiply":
        return a * b
    if mode == "screen":
        return 1 - (1 - a) * (1 - b)
    if mode == "overlay":
        return np.where(a <= 0.5, 2 * a * b, 1 - 2 * (1 - a) * (1 - b))
    if mode == "soft-light":
        return (1 - 2 * b) * a * a + 2 * b * a
    if mode == "color-dodge":
        denom = np.where(b == 1, 1, 1 - b)
        return np.minimum(1, a / denom)
    if mode == "difference":
        return np.abs(a - b)
    return b


def apply_bloom(
    img: Image.Image,
    intensity: float = 0.6,
    glow_color: tuple[float, float, float, float] | None = None,
    blend: BlendMode = "screen",
) -> Image.Image:
    """Additive bloom/glow composited over bright regions.

    intensity: 0..1 bloom strength.
    glow_color: optional RGBA glow tint; if None, uses screen blend on the image itself.
    """
    img = _to_rgba(img)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]

    mask = np.clip((lum - 0.55) / 0.45, 0, 1) ** 1.6
    if glow_color is not None:
        glow = np.zeros_like(arr)
        glow[:, :, 0] = glow_color[0]
        glow[:, :, 1] = glow_color[1]
        glow[:, :, 2] = glow_color[2]
        glow[:, :, 3] = glow_color[3] if len(glow_color) > 3 else 1.0
        bloom = (mask[:, :, None] * glow[:, :, :3] * intensity)
        out = np.clip(arr[:, :, :3] + bloom, 0, 1)
    else:
        bloom = (mask[:, :, None] * arr[:, :, :3] * intensity)
        out = np.clip(arr[:, :, :3] + bloom, 0, 1)
    out = (out * 255).astype(np.uint8)
    out = np.dstack([out, np.clip(arr[:, :, 3], 0, 1).astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


def apply_chromatic_aberration(
    img: Image.Image,
    red_offset: float = 2.0,
    cyan_offset: float = 2.0,
    opacity: float = 0.25,
) -> Image.Image:
    """RGB edge-offset chromatic aberration composited via screen-like addition.

    This is a simple approximation suitable for both preview parity and final frames.
    """
    img = _to_rgba(img)
    w, h = img.size
    out = np.asarray(img, dtype=np.float32) / 255.0

    red = np.roll(out[:, :, 0], int(red_offset), axis=1)
    blue = np.roll(out[:, :, 2], -int(cyan_offset), axis=1)

    ca = np.zeros_like(out[:, :, :3])
    ca[:, :, 0] = red
    ca[:, :, 2] = blue
    ca[:, :, 1] = out[:, :, 1]

    blended = out[:, :, :3] * (1 - opacity) + ca * opacity
    blended = np.clip(blended, 0, 1)
    out[:, :, :3] = blended
    out = (out * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def apply_halation(
    img: Image.Image,
    intensity: float = 0.4,
    warm_color: tuple[float, float, float, float] | None = None,
) -> Image.Image:
    """Warm highlight glow (halation) around bright areas.

    warm_color: optional RGBA warm tint, default orange-ish.
    """
    img = _to_rgba(img)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    lum = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]

    mask = np.clip((lum - 0.7) / 0.3, 0, 1) ** 2.0
    glow = warm_color if warm_color is not None else (1.0, 0.55, 0.2, 1.0)
    glow_arr = np.array(glow[:3], dtype=np.float32)
    bloom = (mask[:, :, None] * glow_arr[None, None, :] * intensity)
    out = np.clip(arr[:, :, :3] + bloom, 0, 1)
    out = (out * 255).astype(np.uint8)
    out = np.dstack([out, np.clip(arr[:, :, 3], 0, 1).astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


def apply_gate_weave(
    img: Image.Image,
    amount: float = 1.5,
    seed: int = 7,
    frame_index: int = 0,
) -> Image.Image:
    """Tiny random camera jitter for film-gate-weave look.

    amount: max translate in px.
    frame_index: used to vary the jitter per frame.
    """
    img = _to_rgba(img)
    rnd = np.random.default_rng(seed + frame_index)
    dx = rnd.uniform(-amount, amount)
    dy = rnd.uniform(-amount, amount)
    return img.transform(img.size, Image.AFFINE, (1, 0, dx, 0, 1, dy), Image.BILINEAR)


def apply_vignette_pulse(
    img: Image.Image,
    intensity: float = 0.6,
    phase: float = 0.0,
) -> Image.Image:
    """Breathing vignette: intensity is modulated by *phase* (0..1 from tempo)."""
    img = _to_rgba(img)
    w, h = img.size
    x = np.linspace(-1, 1, w, dtype=np.float32)
    y = np.linspace(-1, 1, h, dtype=np.float32)
    xx, yy = np.meshgrid(x, y)
    radius = np.sqrt(xx * xx + yy * yy)
    breathe = 0.4 + 0.6 * (0.5 * (1 - np.cos(2 * np.pi * phase)))
    mask = np.clip(1 - (radius - 0.4) * 0.9, 0, 1) ** 2.0
    mask = 1 - mask * intensity * breathe
    mask = mask[:, :, None]
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr[:, :, :3] = arr[:, :, :3] * mask
    arr = np.clip(arr, 0, 1)
    out = (arr * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def apply_vhs_damage(
    img: Image.Image,
    rgb_split_px: float = 10.0,
    block_size: float = 18.0,
    scanlines: float = 6.0,
    seed: int = 7,
    frame_index: int = 0,
) -> Image.Image:
    """VHS-style damage: RGB split + block tearing + scanlines.

    This is a preview/parody-grade effect. For final frames it provides the VHS aesthetic
    without requiring external shader tooling.
    """
    img = _to_rgba(img)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    h, w, _ = arr.shape

    rnd = np.random.default_rng(seed + frame_index)

    # RGB split
    r_offset = int(rgb_split_px * rnd.uniform(-0.6, 0.6))
    b_offset = int(rgb_split_px * rnd.uniform(-0.6, 0.6))
    out = np.zeros_like(arr[:, :, :3])
    out[:, :, 0] = np.roll(arr[:, :, 0], r_offset, axis=1)
    out[:, :, 1] = arr[:, :, 1]
    out[:, :, 2] = np.roll(arr[:, :, 2], b_offset, axis=1)

    # block tearing
    by = max(1, int(block_size * rnd.uniform(0.6, 1.4)))
    bx = max(1, int(block_size * rnd.uniform(0.6, 1.4)))
    offset_y = rnd.integers(-by, by)
    offset_x = rnd.integers(-bx, bx)
    tear = out.copy()
    tear[max(0, offset_y):, max(0, offset_x):] = out[: h - offset_y if offset_y >= 0 else h, : w - offset_x if offset_x >= 0 else w]
    out = tear

    # scanlines
    if scanlines > 0:
        line_width = max(1, w // int(scanlines))
        for i in range(0, h, max(1, int(h / scanlines))):
            out[i:i + line_width, :, :] = out[i:i + line_width, :, :] * 0.6

    out = np.clip(out, 0, 1)
    out = (out * 255).astype(np.uint8)
    out = np.dstack([out, np.clip(arr[:, :, 3], 0, 1).astype(np.uint8)])
    return Image.fromarray(out, "RGBA")

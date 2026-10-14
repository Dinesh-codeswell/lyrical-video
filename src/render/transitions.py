"""
Phase 1 Python-side transition helpers for the video renderer.

These mirror the web preview's expanded transition catalog where the final MP4 frames
should match: whip pan, zoom blur, spring/pop motion, parametrized glitch, dip-to-color,
shape wipes, clock wipe, and soft morph.

All helpers operate on HxWx3 uint8 numpy arrays and return the same shape.
"""

from __future__ import annotations

import math
from typing import Literal

import numpy as np
from PIL import Image, ImageFilter


Direction = Literal["left", "right", "up", "down"]


def _to_pil(img: np.ndarray) -> Image.Image:
    if not isinstance(img, Image.Image):
        return Image.fromarray(img.astype(np.uint8), "RGB").convert("RGBA")
    if img.mode != "RGBA":
        return img.convert("RGBA")
    return img


def _to_array(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("RGB"), dtype=np.uint8)


def _horizontal_wipe(
    img: np.ndarray,
    progress: float,
    direction: Direction,
    feather: float = 6.0,
) -> np.ndarray:
    """Linear wipe along x or y with soft feather."""
    pil = _to_pil(img)
    w, h = pil.size
    if w == 0 or h == 0:
        return img

    pos = int(progress * w if direction in ("left", "right") else progress * h)
    pos = max(0, min(pos, w if direction in ("left", "right") else h))

    mask = np.zeros((h, w), dtype=np.float32)
    if direction == "left":
        mask[:, pos:] = 1.0
    elif direction == "right":
        mask[:, :pos] = 1.0
    elif direction == "up":
        mask[pos:, :] = 1.0
    else:
        mask[:pos, :] = 1.0

    if feather > 0:
        ramp = np.linspace(0, 1, max(1, int(feather)), dtype=np.float32)
        if direction == "left":
            mask[:, pos - len(ramp) : pos] = ramp[::-1]
        elif direction == "right":
            mask[:, pos : pos + len(ramp)] = ramp
        elif direction == "up":
            mask[pos - len(ramp) : pos, :] = ramp[::-1, None]
        else:
            mask[pos : pos + len(ramp), :] = ramp[None, :]

    mask = np.clip(mask, 0, 1)
    out = img.astype(np.float32) * (1 - mask[:, :, None]) + img.astype(np.float32) * mask[:, :, None]
    return out.astype(np.uint8)


def whip_pan(
    img: np.ndarray,
    progress: float,
    direction: Direction = "right",
    motion_blur: float = 80.0,
    overshoot: float = 0.12,
) -> np.ndarray:
    """Whip-pan transition with strong directional motion blur and slight overshoot."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    blurred = _motion_blur_direction(_to_pil(img), direction, motion_blur / 100.0)
    base = _to_array(blurred)
    wiping = _horizontal_wipe(img, _clamp_progress(progress, overshoot, "ease-out"), direction, feather=8.0)
    blend = _over(base, wiping, progress)
    return blend


def zoom_blur(
    img: np.ndarray,
    progress: float,
    zoom: float = 1.8,
    motion_blur: float = 70.0,
) -> np.ndarray:
    """Radial zoom-in with radial motion blur streak."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    scale = 1 + (zoom - 1) * _clamp_progress(progress, 0.0, "ease-out")
    pil = _to_pil(img)
    w, h = pil.size
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    zoomed = pil.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - w) // 2
    top = (new_h - h) // 2
    zoomed = zoomed.crop((left, top, left + w, top + h))

    blurred = _radial_motion_blur(zoomed, motion_blur / 100.0)
    base = _to_array(_to_pil(img))
    blended = _over(base, _to_array(blurred), _clamp_progress(progress, 0.0, "ease-out"))
    return blended


def spring_pop(
    img: np.ndarray,
    progress: float,
    direction: Direction = "up",
    overshoot: float = 0.18,
    feather: float = 2.0,
) -> np.ndarray:
    """Spring/pop motion with overshoot then settle from a direction."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    eased = _clamp_progress(progress, overshoot, "spring")
    translate = {
        "left": (-1, 0),
        "right": (1, 0),
        "up": (0, -1),
        "down": (0, 1),
    }[direction]
    shift_px = (int(eased * 60 * translate[0]), int(eased * 60 * translate[1]))
    pil = _to_pil(img).transform(img.shape[1], img.shape[0], Image.AFFINE, (1, 0, shift_px[0], 0, 1, shift_px[1]), Image.BILINEAR)
    base = _to_array(_to_pil(img))
    mask = _translate_mask(img.shape[1], img.shape[0], shift_px, feather=feather)
    blended = base.astype(np.float32) * (1 - mask[:, :, None]) + _to_array(pil).astype(np.float32) * mask[:, :, None]
    return blended.astype(np.uint8)


def glitch_dissolve(
    img: np.ndarray,
    progress: float,
    rgb_split_px: float = 6.0,
    scanlines: float = 4.0,
    seed: int = 7,
    frame_index: int = 0,
) -> np.ndarray:
    """Parametrized glitch dissolve: RGB split + scanline tearing based on progress."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    pil = _to_pil(img)
    w, h = pil.size
    arr = np.asarray(pil, dtype=np.float32) / 255.0

    strength = _clamp_progress(progress, 0.0, "ease-out")
    shift = int(rgb_split_px * strength)
    out = arr.copy()
    out[:, :, 0] = np.roll(arr[:, :, 0], shift, axis=1)
    out[:, :, 2] = np.roll(arr[:, :, 2], -shift, axis=1)

    if scanlines > 0:
        scan = max(1, int(scanlines * strength))
        for i in range(0, h, max(1, h // scan)):
            out[i : i + max(1, h // (scan * 2)), :, :] *= 0.6

    out = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    out = np.dstack([out, np.ones((h, w), dtype=np.uint8) * 255])
    return out[:, :, :3]


def glitch_damage(
    img: np.ndarray,
    progress: float,
    rgb_split_px: float = 10.0,
    block_size: float = 18.0,
    scanlines: float = 6.0,
    seed: int = 7,
    frame_index: int = 0,
) -> np.ndarray:
    """VHS damage transition: RGB split, block tearing, scanlines, seed-controlled."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    strength = _clamp_progress(progress, 0.0, "ease-out")
    shifted = glitch_dissolve(img, strength, rgb_split_px, scanlines, seed, frame_index)
    pil = _to_pil(Image.fromarray(shifted))

    block_px = max(1, int(block_size * strength))
    rnd = np.random.default_rng(seed + frame_index + int(progress * 1000))
    bx = int(rnd.uniform(0, max(1, block_px)))
    by = int(rnd.uniform(0, max(1, block_px)))
    mask = np.ones((pil.height, pil.width), dtype=np.uint8) * 255
    mask[by : by + block_px, bx : bx + block_px] = 0
    black = Image.new("L", (pil.width, pil.height), 0)
    damaged = Image.composite(black, pil.convert("RGB"), Image.fromarray(mask))
    return _to_array(damaged)


def dip_to_color(
    img: np.ndarray,
    progress: float,
    color: str = "#000000",
) -> np.ndarray:
    """Dip to an arbitrary color (not only black/white) based on progress."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    dip = _hex_to_rgba_tuple(color)
    overlay = np.full_like(img, dip, dtype=np.float32)
    strength = _clamp_progress(progress, 0.0, "dip")
    t = np.clip(strength, 0, 1)
    out = img.astype(np.float32) * (1 - t)[:, :, None] + overlay * t[:, :, None]
    return out.astype(np.uint8)


def shape_wipe(
    img: np.ndarray,
    progress: float,
    shape: Literal["circle", "square", "diamond"] = "circle",
    feather: float = 6.0,
) -> np.ndarray:
    """Expanding shape mask reveal."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    pil = _to_pil(img)
    w, h = pil.size
    cx, cy = w / 2.0, h / 2.0
    t = _clamp_progress(progress, 0.0, "ease-out")
    mask = np.zeros((h, w), dtype=np.float32)

    if shape == "circle":
        r = max(w, h) * t / 2.0
        ys, xs = np.ogrid[:h, :w]
        d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        mask = np.clip((d - (r - feather)) / feather, 0, 1)
    elif shape == "square":
        half = max(w, h) * t / 2.0
        mask = np.where(
            (np.abs(np.arange(w) - cx) < half) & (np.abs(np.arange(h)[:, None] - cy) < half),
            1.0,
            0.0,
        ).astype(np.float32)
        if feather > 0:
            ew = int(feather)
            mask[:, :ew] = np.minimum(mask[:, :ew], np.linspace(0, 1, ew))
            mask[:, -ew:] = np.minimum(mask[:, -ew:], np.linspace(1, 0, ew))
            mask[:ew, :] = np.minimum(mask[:ew, :], np.linspace(0, 1, ew)[:, None])
            mask[-ew:, :] = np.minimum(mask[-ew:, :], np.linspace(1, 0, ew)[:, None])
    else:
        r = max(w, h) * t / 2.0
        ys, xs = np.ogrid[:h, :w]
        d = np.abs(xs - cx) + np.abs(ys - cy)
        mask = np.clip((d - (r - feather)) / feather, 0, 1)

    mask = np.clip(mask, 0, 1)
    out = img.astype(np.float32) * (1 - mask[:, :, None])
    return out.astype(np.uint8)


def clock_wipe(
    img: np.ndarray,
    progress: float,
    start_angle: float = 0.0,
    feather: float = 4.0,
) -> np.ndarray:
    """Radial sweep from a center point with start angle control."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    pil = _to_pil(img)
    w, h = pil.size
    cx, cy = w / 2.0, h / 2.0
    t = _clamp_progress(progress, 0.0, "ease-out")
    sweep = t * 2 * math.pi + math.radians(start_angle)

    ys, xs = np.ogrid[:h, :w]
    dx, dy = xs - cx, ys - cy
    angle = (np.degrees(np.arctan2(dy, dx)) + 360) % 360
    mask = np.where(angle <= sweep, 1.0, 0.0).astype(np.float32)

    if feather > 0:
        ew = int(feather)
        grad = np.linspace(0, 1, ew, dtype=np.float32)
        mask[:, :ew] = np.maximum(mask[:, :ew], grad[::-1][None, :])
        mask[:, -ew:] = np.maximum(mask[:, -ew:], grad[None, :])
        mask[:ew, :] = np.maximum(mask[:ew, :], grad[:, None])
        mask[-ew:, :] = np.maximum(mask[-ew:, :], grad[::-1][:, None])

    mask = np.clip(mask, 0, 1)
    out = img.astype(np.float32) * (1 - mask[:, :, None])
    return out.astype(np.uint8)


def morph_soft(
    img: np.ndarray,
    progress: float,
    blur: float = 12.0,
    feather: float = 6.0,
) -> np.ndarray:
    """Soft morph: blurred cross-dissolve toward a warped version of the same frame."""
    if progress <= 0:
        return img
    if progress >= 1:
        return img

    t = _clamp_progress(progress, 0.0, "ease-out")
    warped = _to_array(_to_pil(img).filter(ImageFilter.GaussianBlur(max(0.1, blur * (1 - t)))))
    base = img.astype(np.float32)
    warped_f = warped.astype(np.float32)
    r = base * (1 - t)[:, :, None] + warped_f * t[:, :, None]
    return r.astype(np.uint8)


def _clamp_progress(progress: float, overshoot: float, style: str) -> float:
    p = max(0.0, min(1.0, progress))
    if style == "spring":
        if p < 0.5:
            return p * 2 * (1 - overshoot)
        return 1 - (1 - p) * 2 * (1 + overshoot * math.sin((p - 0.5) * math.pi * 2))
    if style == "ease-out":
        return 1 - (1 - p) * (1 - p)
    if style == "dip":
        return p * (1 - abs(2 * p - 1)) * 1.2
    return p


def _motion_blur_direction(pil: Image.Image, direction: Direction, amount: float) -> Image.Image:
    if amount <= 0:
        return pil
    w, h = pil.size
    offsets = []
    steps = max(1, int(amount * 30))
    for i in range(-steps, steps + 1):
        frac = i / steps
        if direction in ("left", "right"):
            x = frac * amount * 20
            y = 0
        else:
            x = 0
            y = frac * amount * 20
        offsets.append((x, y))
    acc = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for dx, dy in offsets:
        shifted = pil.transform((w, h), Image.AFFINE, (1, 0, dx, 0, 1, dy), Image.BILINEAR)
        acc = Image.alpha_composite(acc, shifted)
    acc = acc.filter(ImageFilter.GaussianBlur(1.0))
    return acc


def _radial_motion_blur(pil: Image.Image, amount: float) -> Image.Image:
    if amount <= 0:
        return pil
    w, h = pil.size
    acc = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    steps = 8
    for i in range(steps):
        scale = 1 + amount * (i / steps)
        sw = max(1, int(w * scale))
        sh = max(1, int(h * scale))
        scaled = pil.resize((sw, sh), Image.LANCZOS)
        left = (sw - w) // 2
        top = (sh - h) // 2
        acc = Image.alpha_composite(acc, scaled.crop((left, top, left + w, top + h)))
    return acc


def _translate_mask(w: int, h: int, shift: tuple[int, int], feather: float = 2.0) -> np.ndarray:
    mask = np.ones((h, w), dtype=np.float32)
    dx, dy = shift
    if dx > 0:
        mask[:, :dx] = np.clip(np.linspace(0, 1, dx), 0, 1)
    elif dx < 0:
        mask[:, dx:] = np.clip(np.linspace(1, 0, -dx), 0, 1)
    if dy > 0:
        mask[:dy, :] = np.minimum(mask[:dy, :], np.linspace(0, 1, dy)[:, None])
    elif dy < 0:
        mask[dy:, :] = np.minimum(mask[dy:, :], np.linspace(1, 0, -dy)[:, None])
    return mask


def _over(base: np.ndarray, overlay: np.ndarray, opacity: float) -> np.ndarray:
    a = np.full(overlay.shape[:2], opacity, dtype=np.float32)[:, :, None]
    return base.astype(np.float32) * (1 - a) + overlay.astype(np.float32) * a


def _hex_to_rgba_tuple(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b)

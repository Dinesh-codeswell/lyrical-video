"""
Phase 1 Python-side text animation parity.

Mirrors the web animation registry (Animations.ts) so exported frames can apply the same
entrance/exit/word motion behavior, at least for the items that matter to the final MP4.
"""
from __future__ import annotations

import math
from typing import Callable

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SpringFn = Callable[[float], float]


def spring_ease_out(
    t: float,
    damping: float = 18.0,
    stiffness: float = 120.0,
    mass: float = 1.0,
) -> float:
    if t <= 0:
        return 0.0
    omega_n = math.sqrt(stiffness / mass)
    zeta = damping / (2.0 * math.sqrt(stiffness * mass))

    if zeta >= 1:
        if zeta == 1:
            return 1.0 - (1.0 + omega_n * t) * math.exp(-omega_n * t)
        sqrt_term = math.sqrt(max(0.0, zeta * zeta - 1.0))
        s1 = -omega_n * (zeta - sqrt_term)
        s2 = -omega_n * (zeta + sqrt_term)
        if abs(s1 - s2) < 1e-9:
            return 1.0 - (1.0 + omega_n * t) * math.exp(-omega_n * t)
        return 1.0 - (s2 * math.exp(s1 * t) - s1 * math.exp(s2 * t)) / (s2 - s1)

    omega_d = omega_n * math.sqrt(max(0.0, 1.0 - zeta * zeta))
    exp_term = math.exp(-zeta * omega_n * t)
    cos_term = math.cos(omega_d * t)
    sin_term = math.sin(omega_d * t)
    coeff = coeff = (zeta * omega_n / omega_d) if omega_d > 1e-9 else 0.0
    return float(1.0 - exp_term * (cos_term + coeff * sin_term))


def pop_scale_ease(t: float) -> float:
    s = spring_ease_out(t)
    raw = 0.7 + 0.4 * s
    if raw > 1.05:
        return 1.0 + (raw - 1.0) * 0.3
    return raw


def blur_in_ease(t: float) -> float:
    s = spring_ease_out(t)
    return max(0.0, 1.0 - s)


def drop_in_ease(t: float) -> float:
    s = spring_ease_out(t)
    raw = -60.0 * (1.0 - s)
    if raw > 0:
        return raw * 0.4
    return raw


def apply_word_entrance(
    draw: ImageDraw.ImageDraw,
    word: str,
    x: float,
    y: float,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    t: float,
    style: str,
    spring_fn: SpringFn | None = None,
) -> None:
    """Draw a single word with entrance motion driven by elapsed time *t*."""
    if spring_fn is None:
        spring_fn = lambda tt: spring_ease_out(tt)

    elapsed = max(0.0, t)
    if style == "pop-scale":
        scale = pop_scale_ease(elapsed)
        opacity = min(1.0, elapsed * 8.0) if elapsed < 0.05 else 1.0
        draw_word_scaled(draw, word, x, y, font, fill, scale, opacity)
    elif style == "blur-in":
        opacity = min(1.0, elapsed * 5.0)
        blur = max(0.0, 12.0 * (1.0 - spring_fn(elapsed)))
        draw_word_blurred(draw, word, x, y, font, fill, opacity, blur)
    elif style == "drop-in":
        opacity = min(1.0, elapsed * 5.0)
        dy = drop_in_ease(elapsed)
        draw_word_translated(draw, word, x, y + dy, font, fill, opacity)
    elif style == "slide-up":
        opacity = min(1.0, elapsed * 5.0)
        dy = -20.0 * (1.0 - spring_fn(elapsed))
        draw_word_translated(draw, word, x, y + dy, font, fill, opacity)
    else:
        draw_word_scaled(draw, word, x, y, font, fill, 1.0, 1.0)


def draw_word_scaled(
    draw: ImageDraw.ImageDraw,
    word: str,
    x: float,
    y: float,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    scale: float,
    opacity: float,
) -> None:
    r, g, b, a = fill
    col = (r, g, b, int(a * opacity))
    w = draw.textlength(word, font=font) * scale
    draw.text((x - w / 2.0, y), word, font=font, fill=col, anchor="mm")


def draw_word_blurred(
    draw: ImageDraw.ImageDraw,
    word: str,
    x: float,
    y: float,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    opacity: float,
    blur_radius: float,
) -> None:
    r, g, b, a = fill
    col = (r, g, b, int(a * opacity))
    word_img = Image.new("RGBA", (int(font.size * 3), int(font.size * 3)), (0, 0, 0, 0))
    wd = ImageDraw.Draw(word_img)
    wd.text((word_img.width / 2.0, word_img.height / 2.0), word, font=font, fill=col, anchor="mm")
    if blur_radius > 0:
        word_img = word_img.filter(ImageFilter.GaussianBlur(blur_radius))
    draw._image.paste(word_img, (int(x - word_img.width / 2.0), int(y - word_img.height / 2.0)), word_img)


def draw_word_translated(
    draw: ImageDraw.ImageDraw,
    word: str,
    x: float,
    y: float,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int, int],
    opacity: float,
) -> None:
    r, g, b, a = fill
    col = (r, g, b, int(a * opacity))
    draw.text((x, y), word, font=font, fill=col, anchor="lm")

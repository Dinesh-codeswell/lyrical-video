from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pytest

from src.animations.spring import SpringParams, spring_value
from src.animations.text_entrances import TextEntranceApplier
from src.core.theme_loader import Theme
from src.render.filters import apply_bloom, apply_chromatic_aberration, compose_with_blend
from src.render.fonts import BUNDLED_FAMILIES, bundled_ttf_path
from src.render.text_animations import apply_word_entrance, spring_ease_out
from src.render.transitions import render_transition


def test_spring_animator():
    params = SpringParams(stiffness=120.0, damping=12.0, mass=1.0)
    val = spring_value(0.5, params)
    assert isinstance(val, float)
    assert 0.0 <= val <= 2.0


def test_filters_bloom_and_ca():
    img = Image.new("RGBA", (100, 100), (255, 255, 255, 255))
    bloom_img = apply_bloom(img, intensity=0.5)
    assert bloom_img.size == (100, 100)
    assert bloom_img.mode == "RGBA"

    ca_img = apply_chromatic_aberration(img, red_offset=2.0, cyan_offset=2.0)
    assert ca_img.size == (100, 100)
    assert ca_img.mode == "RGBA"


def test_blend_modes():
    base = Image.new("RGBA", (50, 50), (100, 100, 100, 255))
    overlay = Image.new("RGBA", (50, 50), (200, 50, 50, 200))
    blended = compose_with_blend(base, overlay, blend="multiply", opacity=0.8)
    assert blended.size == (50, 50)
    assert blended.mode == "RGBA"


def test_bundled_fonts():
    assert len(BUNDLED_FAMILIES) >= 5
    path = bundled_ttf_path("Inter", 400)
    assert path is not None


def test_text_animations_render():
    base = Image.new("RGBA", (200, 50), (0, 0, 0, 255))
    draw = ImageDraw.Draw(base)
    font = ImageFont.load_default()
    apply_word_entrance(draw, "Hello", 10, 10, font, (255, 255, 255, 255), 0.5, "pop-scale")
    assert base.size == (200, 50)


def test_text_entrance_applier():
    theme = Theme()
    applier = TextEntranceApplier(theme, active_index=0, lines=[{"text": "Hello World", "start_time": 0.0}], t=0.5)
    transforms = applier.word_transforms(0, "Hello World")
    assert isinstance(transforms, list)


def test_transitions_render():
    img_a = Image.new("RGBA", (100, 100), (255, 0, 0, 255))
    img_b = Image.new("RGBA", (100, 100), (0, 255, 0, 255))
    trans = render_transition(img_a, img_b, "crossfade", progress=0.5)
    assert trans.size == (100, 100)
    assert trans.mode == "RGBA"

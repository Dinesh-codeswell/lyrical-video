"""Theme loading and defaults."""

import json
from dataclasses import dataclass, field
from pathlib import Path

DEFAULTS = {
    "name": "Default",
    "background_color": "#1a1a1a",
    "text_color": "#ffffff",
    "active_text_color": "#D66E31",                 # burnt orange fill
    "active_text_bold": False,
    "active_text_glow": True,
    "active_glow_color": None,                      # None = same as active_text_color
    "active_font_family": None,                     # None = inherit from font_family
    "active_text_stroke_color": "#6A1E22",          # dark maroon rib/outline
    "active_text_stroke_width": 3,                  # px; 0 = no stroke
    "inactive_text_opacity_gradient": [0.6, 0.4, 0.2],
    "font_family": "Arial",
    "font_size": 72,
    "line_spacing": 1.5,
    "lyric_position": "center",
    "highlight_mode": "line",
    "highlight_dim_alpha": 0.3,
    "text_overlay_opacity": 0,       # int 0-100
    "text_overlay_color": "#000000",
    "aspect_ratio": "16:9",
    "animation_style": "scroll",
    # Typography extensions (Phase 1)
    "font_weight": 400,
    "font_style": "normal",
    "text_transform": "none",
    # Text entrance / exit animation (per-line granularity, independent of highlight_mode)
    "entrance_style": "scroll",
    "exit_style": "fade-out-up",
    "word_animation": "none",
    "char_stagger_ms": 0,
    "spring_damping": 18,
    "spring_stiffness": 120,
    "spring_mass": 1,
    "karaoke_fill": "flat",
    "blend_mode": "normal",
    "bloom_enabled": False,
    "bloom_intensity": 0,
    "chromatic_aberration": False,
    "camera_shake": False,
    "beat_punch": False,
    # Kept for backward compatibility
    "text_position": "center",
    "text_shadow": False,
    "text_shadow_color": "#000000",
    "text_shadow_offset": [3, 3],
    "column_width": 1760,           # px; valid range 200–1920
    "logo_path": "",                # abs or relative path to PNG/JPG; empty = no logo
    "logo_width": 400,              # px wide; height auto-scaled to maintain aspect ratio
    "logo_h_align": "center",       # "left", "center", "right"
    "title_h_align": "center",      # horizontal alignment for intro/outro title text
    "interlude_dot_color": None,    # None = use active_text_color
    "active_filter": "none",
    "background_blur": 0,
    "vignette_enabled": False,
    "letterbox_bars": "none",
    "letterbox_color": "#000000",
    "active_transition": "crossfade",
    "transition_duration": 0.4,
    "wave_enabled": False,
    "wave_speed": 1.0,
    "wave_amplitude": 15.0,
    "pixelate_block_size": 16,
    "chroma_key_enabled": False,
    "chroma_key_color": "#00ff00",
    "chroma_key_fuzz": 35,
}

THEME_PRESETS = {
    "default": {
        "name": "Default Studio",
        "background_color": "#1a1a1a",
        "text_color": "#ffffff",
        "active_text_color": "#D66E31",
        "active_text_bold": False,
        "active_text_glow": True,
        "active_glow_color": "#D66E31",
        "active_text_stroke_color": "#6A1E22",
        "active_text_stroke_width": 3,
        "font_family": "Arial",
        "font_weight": 400,
        "font_style": "normal",
        "text_transform": "none",
        "entrance_style": "scroll",
        "exit_style": "fade-out-up",
        "word_animation": "none",
        "karaoke_fill": "flat",
        "blend_mode": "normal",
        "font_size": 72,
        "line_spacing": 1.5,
        "lyric_position": "center",
        "highlight_mode": "line",
        "text_overlay_opacity": 0,
        "text_overlay_color": "#000000",
        "aspect_ratio": "16:9",
        "animation_style": "scroll",
    },
    "cyberpunk": {
        "name": "Cyberpunk Neon",
        "background_color": "#0a0a14",
        "text_color": "#67e8f9",
        "active_text_color": "#ff007f",
        "active_text_bold": True,
        "active_text_glow": True,
        "active_glow_color": "#00f3ff",
        "active_text_stroke_color": "#00f3ff",
        "active_text_stroke_width": 4,
        "font_family": "Anton",
        "font_weight": 400,
        "font_style": "normal",
        "text_transform": "uppercase",
        "entrance_style": "pop-scale",
        "exit_style": "scale-out",
        "word_animation": "scale-pop",
        "karaoke_fill": "gradient",
        "blend_mode": "screen",
        "bloom_enabled": True,
        "bloom_intensity": 60,
        "chromatic_aberration": True,
        "font_size": 76,
        "line_spacing": 1.6,
        "lyric_position": "center",
        "highlight_mode": "line",
        "text_overlay_opacity": 30,
        "text_overlay_color": "#050510",
        "aspect_ratio": "16:9",
        "animation_style": "scroll",
    },
    "spotify_minimal": {
        "name": "Spotify Minimal",
        "background_color": "#121212",
        "text_color": "#71717a",
        "active_text_color": "#ffffff",
        "active_text_bold": True,
        "active_text_glow": False,
        "active_glow_color": None,
        "active_text_stroke_color": "#000000",
        "active_text_stroke_width": 0,
        "font_family": "Inter",
        "font_weight": 400,
        "font_style": "normal",
        "text_transform": "uppercase",
        "entrance_style": "fade",
        "exit_style": "fade-out-up",
        "word_animation": "none",
        "karaoke_fill": "gradient",
        "blend_mode": "normal",
        "font_size": 72,
        "line_spacing": 1.5,
        "lyric_position": "left",
        "highlight_mode": "line",
        "text_overlay_opacity": 0,
        "text_overlay_color": "#000000",
        "aspect_ratio": "16:9",
        "animation_style": "scroll",
    },
    "sunset_warmth": {
        "name": "Sunset Warmth",
        "background_color": "#180e1a",
        "text_color": "#fdba74",
        "active_text_color": "#fbbf24",
        "active_text_bold": True,
        "active_text_glow": True,
        "active_glow_color": "#f97316",
        "active_text_stroke_color": "#831843",
        "active_text_stroke_width": 2,
        "font_family": "Playfair Display",
        "font_weight": 400,
        "font_style": "normal",
        "text_transform": "none",
        "entrance_style": "fade",
        "exit_style": "fade-out-up",
        "word_animation": "none",
        "karaoke_fill": "gradient",
        "blend_mode": "normal",
        "font_size": 74,
        "line_spacing": 1.5,
        "lyric_position": "center",
        "highlight_mode": "line",
        "text_overlay_opacity": 20,
        "text_overlay_color": "#1c0b24",
        "aspect_ratio": "16:9",
        "animation_style": "scroll",
    },
    "dark_trap": {
        "name": "Dark Trap 808",
        "background_color": "#050505",
        "text_color": "#52525b",
        "active_text_color": "#ef4444",
        "active_text_bold": True,
        "active_text_glow": True,
        "active_glow_color": "#dc2626",
        "active_text_stroke_color": "#450a0a",
        "active_text_stroke_width": 4,
        "font_family": "Anton",
        "font_weight": 400,
        "font_style": "normal",
        "text_transform": "uppercase",
        "entrance_style": "drop-in",
        "exit_style": "scale-out",
        "word_animation": "scale-pop",
        "char_stagger_ms": 30,
        "karaoke_fill": "flat",
        "blend_mode": "normal",
        "bloom_enabled": True,
        "bloom_intensity": 40,
        "chromatic_aberration": True,
        "camera_shake": True,
        "beat_punch": True,
        "font_size": 80,
        "line_spacing": 1.4,
        "lyric_position": "center",
        "highlight_mode": "line",
        "text_overlay_opacity": 40,
        "text_overlay_color": "#000000",
        "aspect_ratio": "16:9",
        "animation_style": "scroll",
    },
    "matrix_terminal": {
        "name": "Matrix Terminal",
        "background_color": "#020a05",
        "text_color": "#166534",
        "active_text_color": "#22c55e",
        "active_text_bold": True,
        "active_text_glow": True,
        "active_glow_color": "#4ade80",
        "active_text_stroke_color": "#052e16",
        "active_text_stroke_width": 2,
        "font_family": "JetBrains Mono",
        "font_weight": 400,
        "font_style": "normal",
        "text_transform": "none",
        "entrance_style": "typewriter",
        "exit_style": "typewriter-delete",
        "word_animation": "none",
        "karaoke_fill": "flat",
        "blend_mode": "normal",
        "font_size": 70,
        "line_spacing": 1.5,
        "lyric_position": "left",
        "highlight_mode": "line",
        "text_overlay_opacity": 15,
        "text_overlay_color": "#020a05",
        "aspect_ratio": "16:9",
        "animation_style": "scroll",
    },
}



@dataclass
class Theme:
    """Resolved theme settings."""
    name: str
    background_color: str
    text_color: str
    active_text_color: str | None
    active_text_bold: bool
    active_text_glow: bool
    active_glow_color: str | None
    inactive_text_opacity_gradient: list[float]
    font_family: str
    font_size: int
    line_spacing: float
    lyric_position: str = "center"
    active_font_family: str | None = None
    active_text_stroke_color: str = "#6A1E22"
    active_text_stroke_width: int = 3
    highlight_mode: str = "line"
    highlight_dim_alpha: float = 0.3
    text_overlay_opacity: int = 0
    text_overlay_color: str = "#000000"
    aspect_ratio: str = "16:9"
    animation_style: str = "scroll"
    # Backward-compat fields
    text_position: str = "center"
    text_shadow: bool = False
    text_shadow_color: str = "#000000"
    text_shadow_offset: list[int] = field(default_factory=lambda: [3, 3])
    column_width: int = 1760
    logo_path: str = ""
    logo_width: int = 400
    logo_h_align: str = "center"
    title_h_align: str = "center"
    interlude_dot_color: str | None = None
    active_filter: str = "none"
    background_blur: int = 0
    background_image_path: str = ""
    vignette_enabled: bool = False
    letterbox_bars: str = "none"
    letterbox_color: str = "#000000"
    active_transition: str = "crossfade"
    transition_duration: float = 0.4
    # Typography extensions (Phase 1)
    font_weight: int = 400
    font_style: str = "normal"
    text_transform: str = "none"
    entrance_style: str = "scroll"
    exit_style: str = "fade-out-up"
    word_animation: str = "none"
    char_stagger_ms: int = 0
    spring_damping: int = 18
    spring_stiffness: int = 120
    spring_mass: int = 1
    karaoke_fill: str = "flat"
    blend_mode: str = "normal"
    bloom_enabled: bool = False
    bloom_intensity: int = 0
    chromatic_aberration: bool = False
    camera_shake: bool = False
    beat_punch: bool = False
    wave_enabled: bool = False
    wave_speed: float = 1.0
    wave_amplitude: float = 15.0
    pixelate_block_size: int = 16
    chroma_key_enabled: bool = False
    chroma_key_color: str = "#00ff00"
    chroma_key_fuzz: int = 35

    @property
    def effective_active_text_color(self) -> str:
        """Return the resolved active line text color."""
        return self.active_text_color or self.text_color

    @property
    def effective_active_glow_color(self) -> str:
        """Return the resolved glow color."""
        return self.active_glow_color or self.effective_active_text_color

    @property
    def line_height(self) -> int:
        """Computed line height in pixels from line_spacing * font_size."""
        return int(self.line_spacing * self.font_size)


def _is_valid_hex_color(value: str) -> bool:
    """Return True if value is a valid #RRGGBB hex color string."""
    if not isinstance(value, str):
        return False
    s = value.lstrip("#")
    if len(s) != 6:
        return False
    try:
        int(s, 16)
        return True
    except ValueError:
        return False


def _validate_theme(data: dict, filepath) -> None:
    """Raise ValueError with clear messages if theme data contains invalid values."""
    errors = []

    for key in ("background_color", "text_color", "text_shadow_color"):
        val = data.get(key)
        if val is not None and not _is_valid_hex_color(val):
            errors.append(f"'{key}': '{val}' is not a valid hex color (expected #RRGGBB)")

    for key in ("active_text_color", "active_glow_color", "active_text_stroke_color",
                "interlude_dot_color"):
        val = data.get(key)
        if val is not None and not _is_valid_hex_color(val):
            errors.append(f"'{key}': '{val}' is not a valid hex color (expected #RRGGBB)")

    sw = data.get("active_text_stroke_width")
    if sw is not None and (not isinstance(sw, int) or not (0 <= sw <= 40)):
        errors.append("'active_text_stroke_width': must be an integer between 0 and 40")

    if "lyric_position" in data and data["lyric_position"] not in ("left", "center", "right"):
        errors.append("'lyric_position': must be 'left', 'center', or 'right'")

    if "highlight_mode" in data and data["highlight_mode"] not in ("line", "word", "character"):
        errors.append("'highlight_mode': must be 'line', 'word', or 'character'")

    grad = data.get("inactive_text_opacity_gradient")
    if grad is not None:
        if not isinstance(grad, list) or not all(
            isinstance(x, (int, float)) and 0.0 <= x <= 1.0 for x in grad
        ):
            errors.append(
                "'inactive_text_opacity_gradient': must be a list of floats between 0.0 and 1.0"
            )

    ls = data.get("line_spacing")
    if ls is not None and (not isinstance(ls, (int, float)) or ls <= 0):
        errors.append("'line_spacing': must be a positive number")

    fs = data.get("font_size")
    if fs is not None and (not isinstance(fs, int) or fs <= 0):
        errors.append("'font_size': must be a positive integer")

    cw = data.get("column_width")
    if cw is not None and (not isinstance(cw, int) or not (200 <= cw <= 1920)):
        errors.append("'column_width': must be an integer between 200 and 1920")

    lw = data.get("logo_width")
    if lw is not None and (not isinstance(lw, int) or not (50 <= lw <= 1920)):
        errors.append("'logo_width': must be an integer between 50 and 1920")

    if "logo_h_align" in data and data["logo_h_align"] not in ("left", "center", "right"):
        errors.append("'logo_h_align': must be 'left', 'center', or 'right'")

    if "title_h_align" in data and data["title_h_align"] not in ("left", "center", "right"):
        errors.append("'title_h_align': must be 'left', 'center', or 'right'")

    if "aspect_ratio" in data and data["aspect_ratio"] not in ("16:9", "9:16", "1:1", "4:5"):
        errors.append("'aspect_ratio': must be '16:9', '9:16', '1:1', or '4:5'")

    if errors:
        label = f"theme '{filepath}'" if filepath else "theme"
        msg = f"Invalid {label}:\n" + "\n".join(f"  - {e}" for e in errors)
        raise ValueError(msg)


def load_theme(filepath: str | Path | None = None) -> Theme:
    """Load a theme JSON file with fallbacks to defaults.

    Args:
        filepath: Path to theme JSON. If None, returns the default theme.

    Returns:
        A Theme instance with all properties resolved.

    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If the theme contains invalid property values.
    """
    if filepath is None:
        return Theme(
            name=DEFAULTS["name"],
            background_color=DEFAULTS["background_color"],
            text_color=DEFAULTS["text_color"],
            active_text_color=DEFAULTS["active_text_color"],
            active_text_bold=DEFAULTS["active_text_bold"],
            active_text_glow=DEFAULTS["active_text_glow"],
            active_glow_color=DEFAULTS["active_glow_color"],
            active_font_family=DEFAULTS["active_font_family"],
            active_text_stroke_color=DEFAULTS["active_text_stroke_color"],
            active_text_stroke_width=DEFAULTS["active_text_stroke_width"],
            inactive_text_opacity_gradient=list(DEFAULTS["inactive_text_opacity_gradient"]),
            font_family=DEFAULTS["font_family"],
            font_size=DEFAULTS["font_size"],
            line_spacing=DEFAULTS["line_spacing"],
            lyric_position=DEFAULTS["lyric_position"],
            highlight_mode=DEFAULTS["highlight_mode"],
            highlight_dim_alpha=DEFAULTS["highlight_dim_alpha"],
            text_overlay_opacity=DEFAULTS["text_overlay_opacity"],
            text_overlay_color=DEFAULTS["text_overlay_color"],
            text_position=DEFAULTS["text_position"],
            text_shadow=DEFAULTS["text_shadow"],
            text_shadow_color=DEFAULTS["text_shadow_color"],
            text_shadow_offset=list(DEFAULTS["text_shadow_offset"]),
            column_width=DEFAULTS["column_width"],
            logo_path=DEFAULTS["logo_path"],
            logo_width=DEFAULTS["logo_width"],
            logo_h_align=DEFAULTS["logo_h_align"],
            title_h_align=DEFAULTS["title_h_align"],
            interlude_dot_color=DEFAULTS["interlude_dot_color"],
            font_weight=DEFAULTS["font_weight"],
            font_style=DEFAULTS["font_style"],
            text_transform=DEFAULTS["text_transform"],
            entrance_style=DEFAULTS["entrance_style"],
            exit_style=DEFAULTS["exit_style"],
            word_animation=DEFAULTS["word_animation"],
            char_stagger_ms=DEFAULTS["char_stagger_ms"],
            spring_damping=DEFAULTS["spring_damping"],
            spring_stiffness=DEFAULTS["spring_stiffness"],
            spring_mass=DEFAULTS["spring_mass"],
            karaoke_fill=DEFAULTS["karaoke_fill"],
            blend_mode=DEFAULTS["blend_mode"],
            bloom_enabled=DEFAULTS["bloom_enabled"],
            bloom_intensity=DEFAULTS["bloom_intensity"],
            chromatic_aberration=DEFAULTS["chromatic_aberration"],
            camera_shake=DEFAULTS["camera_shake"],
            beat_punch=DEFAULTS["beat_punch"],
            background_image_path="",
        )

    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"Theme file not found: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    _validate_theme(data, filepath)

    # Backward-compat: map old property names to new ones
    if "glow_enabled" in data and "active_text_glow" not in data:
        data["active_text_glow"] = data["glow_enabled"]
    if "inactive_alphas" in data and "inactive_text_opacity_gradient" not in data:
        data["inactive_text_opacity_gradient"] = data["inactive_alphas"]
    if "line_height" in data and "line_spacing" not in data:
        font_size = data.get("font_size", DEFAULTS["font_size"])
        data["line_spacing"] = data["line_height"] / font_size

    merged = {**DEFAULTS, **data}

    return Theme(
        name=merged["name"],
        background_color=merged["background_color"],
        text_color=merged["text_color"],
        active_text_color=merged["active_text_color"],
        active_text_bold=merged["active_text_bold"],
        active_text_glow=merged["active_text_glow"],
        active_glow_color=merged["active_glow_color"],
        active_font_family=merged.get("active_font_family"),
        active_text_stroke_color=str(merged.get("active_text_stroke_color", DEFAULTS["active_text_stroke_color"])),
        active_text_stroke_width=int(merged.get("active_text_stroke_width", DEFAULTS["active_text_stroke_width"])),
        inactive_text_opacity_gradient=list(merged["inactive_text_opacity_gradient"]),
        font_family=merged["font_family"],
        font_size=merged["font_size"],
        line_spacing=merged["line_spacing"],
        lyric_position=merged["lyric_position"],
        highlight_mode=merged["highlight_mode"],
        highlight_dim_alpha=merged["highlight_dim_alpha"],
        text_overlay_opacity=merged["text_overlay_opacity"],
        text_overlay_color=merged["text_overlay_color"],
        text_position=merged["text_position"],
        text_shadow=merged["text_shadow"],
        text_shadow_color=merged["text_shadow_color"],
        text_shadow_offset=list(merged["text_shadow_offset"]),
        column_width=int(merged["column_width"]),
        logo_path=str(merged["logo_path"]) if merged.get("logo_path") else "",
        logo_width=int(merged.get("logo_width", 400)),
        logo_h_align=str(merged.get("logo_h_align", "center")),
        title_h_align=str(merged.get("title_h_align", "center")),
        interlude_dot_color=merged.get("interlude_dot_color") or None,            active_filter=str(merged.get("active_filter", "none")),
        background_blur=int(merged.get("background_blur", 0)),
        background_image_path=str(merged.get("background_image_path", "") or ""),
        vignette_enabled=bool(merged.get("vignette_enabled", False)),
        letterbox_bars=str(merged.get("letterbox_bars", "none")),
        letterbox_color=str(merged.get("letterbox_color", "#000000")),
        font_weight=int(merged.get("font_weight", 400)),
        font_style=str(merged.get("font_style", "normal")),
        text_transform=str(merged.get("text_transform", "none")),
        entrance_style=str(merged.get("entrance_style", "scroll")),
        exit_style=str(merged.get("exit_style", "fade-out-up")),
        word_animation=str(merged.get("word_animation", "none")),
        char_stagger_ms=int(merged.get("char_stagger_ms", 0)),
        spring_damping=int(merged.get("spring_damping", 18)),
        spring_stiffness=int(merged.get("spring_stiffness", 120)),
        spring_mass=int(merged.get("spring_mass", 1)),
        karaoke_fill=str(merged.get("karaoke_fill", "flat")),
        blend_mode=str(merged.get("blend_mode", "normal")),
        bloom_enabled=bool(merged.get("bloom_enabled", False)),
        bloom_intensity=int(merged.get("bloom_intensity", 0)),
        chromatic_aberration=bool(merged.get("chromatic_aberration", False)),
        camera_shake=bool(merged.get("camera_shake", False)),
        beat_punch=bool(merged.get("beat_punch", False)),
    )

"""Font resolution for the Python video renderer.

Bundled OFL fonts live in src/render/fonts/*.ttf (mirrored from web/public/fonts/).
The same TTF files are referenced by the dashboard's @font-face declarations so the
preview and the final render use identical glyph metrics.

Families without a bundled TTF fall back to the system font of the same name (Pillow
will load whatever the OS provides). This matches the dashboard's behavior for
system fonts like Arial.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

# Directory that contains the bundled TTF files (mirrored from web/public/fonts/).
FONT_DIR = Path(__file__).resolve().parent / "fonts"

# Mapping: (family_lower, weight) -> relative TTF filename.
# Only families/weights that have a bundled static TTF are listed here.
# Families not in this map fall back to system font lookup.
BUNDLED: dict[tuple[str, int], str] = {
    ("inter", 400): "Inter-400.ttf",
    ("inter", 700): "Inter-700.ttf",
    ("inter", 900): "Inter-900.ttf",
    ("anton", 400): "Anton-400.ttf",
    ("montserrat", 400): "Montserrat-400.ttf",
    ("montserrat", 700): "Montserrat-700.ttf",
    ("playfair display", 400): "PlayfairDisplay-400.ttf",
    ("playfair display", 700): "PlayfairDisplay-700.ttf",
    ("caveat", 400): "Caveat-400.ttf",
    ("jetbrains mono", 400): "JetBrainsMono-400.ttf",
    ("jetbrains mono", 700): "JetBrainsMono-700.ttf",
}

# Families that are bundled (used by theme_loader to know when to prefer the TTF).
BUNDLED_FAMILIES = sorted({family for (family, _w) in BUNDLED})


def bundled_ttf_path(family: str, weight: int = 400) -> Path | None:
    """Return the absolute path to the bundled TTF for *family* at *weight*, or None.

    Args:
        family: Font family name (e.g. "Inter", "JetBrains Mono"). Case-insensitive.
        weight: Font weight (400, 700, 900). Only weights with a bundled static TTF
            are supported; other weights fall back to system font.

    Returns:
        Absolute Path to the TTF if bundled, else None (fall back to system font).
    """
    key = (family.strip().lower(), int(weight))
    filename = BUNDLED.get(key)
    if filename is None:
        return None
    p = FONT_DIR / filename
    return p if p.exists() else None


def resolve_font_path(family: str, weight: int = 400) -> Path:
    """Resolve a font path for *family* at *weight*.

    Prefers the bundled TTF when available; otherwise falls back to the system font
    of the same name (Pillow loads whatever the OS provides).

    Args:
        family: Font family name (e.g. "Inter", "Arial").
        weight: Font weight (default 400).

    Returns:
        Absolute Path to a font file Pillow can open.
    """
    ttf = bundled_ttf_path(family, weight)
    if ttf is not None:
        return ttf
    # Fall back to a system font with the same family name.
    # Pillow's ImageFont.truetype can load system fonts by name on most platforms.
    return family


def is_bundled_family(family: str) -> bool:
    """Return True if *family* has a bundled TTF (preview and render use the same file)."""
    return family.strip().lower() in BUNDLED_FAMILIES

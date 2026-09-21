"""Auto-match song files from the input/ directory structure."""

from dataclasses import dataclass
from pathlib import Path

import click

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

INPUT_AUDIO_DIR = PROJECT_ROOT / "input" / "audio"
INPUT_LYRICS_DIR = PROJECT_ROOT / "input" / "lyrics"
INPUT_BACKGROUNDS_DIR = PROJECT_ROOT / "input" / "backgrounds"
THEMES_DIR = PROJECT_ROOT / "themes"

AUDIO_EXTENSIONS = (".mp3", ".wav")
LYRICS_EXTENSIONS = (".json", ".lrc", ".srt", ".vtt")


def _find_lyrics(name: str) -> Path | None:
    for ext in LYRICS_EXTENSIONS:
        p = INPUT_LYRICS_DIR / f"{name}{ext}"
        if p.exists():
            return p
    return None


@dataclass
class SongInfo:
    name: str
    has_lyrics: bool
    has_audio: bool
    has_background: bool

    @property
    def is_loadable(self) -> bool:
        return self.has_lyrics and self.has_audio


def scan_songs() -> list[SongInfo]:
    """Scan input/ directories and return all discovered songs.

    A song is discovered if it has at least a lyrics file or an audio file.
    Returns a list sorted by song name.
    """
    names: set[str] = set()
    for ext in LYRICS_EXTENSIONS:
        for p in INPUT_LYRICS_DIR.glob(f"*{ext}"):
            names.add(p.stem)
    for ext in AUDIO_EXTENSIONS:
        for p in INPUT_AUDIO_DIR.glob(f"*{ext}"):
            names.add(p.stem)

    songs = []
    for name in sorted(names):
        songs.append(SongInfo(
            name=name,
            has_lyrics=_find_lyrics(name) is not None,
            has_audio=_find_audio(name) is not None,
            has_background=(INPUT_BACKGROUNDS_DIR / f"{name}.mp4").exists(),
        ))
    return songs


def resolve_song(
    song_name: str,
    lyrics_override: str | None = None,
    audio_override: str | None = None,
    background_override: str | None = None,
    no_background: bool = False,
) -> dict[str, Path | None]:
    """Resolve file paths for a song by name from the input/ directories.

    Args:
        song_name: Base name of the song (e.g. 'disciples_of_dysfunction').
        lyrics_override: Explicit lyrics path (overrides auto-match).
        audio_override: Explicit audio path (overrides auto-match).
        background_override: Explicit background path (overrides auto-match).
        no_background: If True, force no background video.

    Returns:
        Dict with keys 'lyrics', 'audio', 'background' mapped to resolved Paths.
        'background' may be None if not found or disabled.
    """
    # Resolve lyrics
    if lyrics_override:
        lyrics_path = Path(lyrics_override)
    else:
        lyrics_path = _find_lyrics(song_name)
        if lyrics_path is None:
            ext_str = ", ".join(LYRICS_EXTENSIONS)
            raise click.UsageError(
                f"Lyrics file not found for '{song_name}' in {INPUT_LYRICS_DIR}\n"
                f"Place your lyrics at: input/lyrics/{song_name} (supported: {ext_str})"
            )

    # Resolve audio
    if audio_override:
        audio_path = Path(audio_override)
    else:
        audio_path = _find_audio(song_name)
        if audio_path is None:
            extensions = ", ".join(AUDIO_EXTENSIONS)
            raise click.UsageError(
                f"Audio file not found for '{song_name}' in {INPUT_AUDIO_DIR}\n"
                f"Place your audio file at: input/audio/{song_name}.mp3 (supported: {extensions})"
            )

    # Resolve background
    background_path: Path | None = None
    if no_background:
        background_path = None
    elif background_override:
        background_path = Path(background_override)
    else:
        candidate = INPUT_BACKGROUNDS_DIR / f"{song_name}.mp4"
        if candidate.exists():
            background_path = candidate

    # Resolve theme
    theme_candidate = THEMES_DIR / f"{song_name}.json"
    theme_path: Path | None = theme_candidate if theme_candidate.exists() else None

    return {
        "lyrics": lyrics_path,
        "audio": audio_path,
        "background": background_path,
        "theme": theme_path,
    }


def _find_audio(song_name: str) -> Path | None:
    """Search for an audio file matching the song name."""
    for ext in AUDIO_EXTENSIONS:
        candidate = INPUT_AUDIO_DIR / f"{song_name}{ext}"
        if candidate.exists():
            return candidate
    return None


def get_song_files(song_name: str) -> dict[str, Path | None]:
    """Resolve available file paths for a song slug, allowing partial songs (e.g. lyrics-only or audio-only)."""
    lyrics_path = _find_lyrics(song_name)
    audio_path = _find_audio(song_name)

    background_path = None
    for ext in (".mp4", ".mov", ".avi", ".mkv", ".webm"):
        candidate = INPUT_BACKGROUNDS_DIR / f"{song_name}{ext}"
        if candidate.exists():
            background_path = candidate
            break

    theme_candidate = THEMES_DIR / f"{song_name}.json"
    theme_path = theme_candidate if theme_candidate.exists() else None

    return {
        "lyrics": lyrics_path,
        "audio": audio_path,
        "background": background_path,
        "theme": theme_path,
    }


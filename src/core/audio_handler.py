"""Audio file loading and handling."""

from pathlib import Path

from moviepy import AudioFileClip


def load_audio(filepath: str | Path) -> AudioFileClip:
    """Load an audio file and return a moviepy AudioFileClip.

    Args:
        filepath: Path to the audio file (mp3, wav, etc.).

    Returns:
        An AudioFileClip instance.

    Raises:
        FileNotFoundError: If the audio file doesn't exist.
    """
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"Audio file not found: {filepath}")

    return AudioFileClip(str(filepath))

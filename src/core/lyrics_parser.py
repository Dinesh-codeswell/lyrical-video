"""Lyrics JSON parser and validation."""

import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class LyricLine:
    """A single timed lyric line."""
    text: str
    start_time: float
    end_time: float
    duration: float


@dataclass
class GapPeriod:
    """A silent interlude period between lyric lines."""
    start_time: float
    end_time: float


def parse_lrc_string(lrc_text: str, default_title: str = "Unknown Title", default_artist: str = "Unknown Artist") -> dict:
    """Parse LRC string format into standard lyrics dictionary structure."""
    lines_raw = []
    title = default_title
    artist = default_artist

    meta_re = re.compile(r'\[(ti|ar|al|by|offset):([^\]]+)\]', re.IGNORECASE)
    time_re = re.compile(r'\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]')

    for raw_line in lrc_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        meta_match = meta_re.match(line)
        if meta_match:
            tag, val = meta_match.group(1).lower(), meta_match.group(2).strip()
            if tag == 'ti' and (not title or title == "Unknown Title"):
                title = val
            elif tag == 'ar' and (not artist or artist == "Unknown Artist"):
                artist = val
            continue

        timestamps = []
        last_end = 0
        for m in time_re.finditer(line):
            minutes = int(m.group(1))
            seconds = int(m.group(2))
            millis_str = m.group(3)
            millis = float("0." + millis_str) if millis_str else 0.0
            timestamps.append(minutes * 60 + seconds + millis)
            last_end = m.end()

        lyric_text = line[last_end:].strip()
        lyric_text = re.sub(r'<\d{1,2}:\d{2}(?:[.:]\d{2,3})?>', '', lyric_text).strip()

        for ts in timestamps:
            lines_raw.append({"time": round(ts, 2), "text": lyric_text})

    lines_raw.sort(key=lambda x: x["time"])

    if lines_raw and lines_raw[-1]["text"] != "":
        lines_raw.append({"time": round(lines_raw[-1]["time"] + 4.0, 2), "text": ""})

    return {
        "title": title or default_title,
        "artist": artist or default_artist,
        "lyrics": lines_raw
    }


def parse_srt_string(srt_text: str, default_title: str = "Unknown Title", default_artist: str = "Unknown Artist") -> dict:
    """Parse SRT/VTT subtitle string into standard lyrics dictionary structure."""
    lines_raw = []
    blocks = re.split(r'\n\s*\n', srt_text.strip())
    time_range_re = re.compile(
        r'(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})'
    )

    last_end = 0.0
    for block in blocks:
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        if not lines:
            continue
        match = None
        text_lines = []
        for l in lines:
            m = time_range_re.search(l)
            if m:
                match = m
            elif not l.isdigit() and not l.startswith("WEBVTT"):
                text_lines.append(l)

        if match and text_lines:
            h1, m1, s1, ms1 = map(int, match.group(1, 2, 3, 4))
            start_t = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000.0
            h2, m2, s2, ms2 = map(int, match.group(5, 6, 7, 8))
            end_t = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000.0

            text = " ".join(text_lines)
            lines_raw.append({"time": round(start_t, 2), "text": text})
            last_end = max(last_end, end_t)

    if lines_raw:
        lines_raw.sort(key=lambda x: x["time"])
        lines_raw.append({"time": round(last_end, 2), "text": ""})

    return {
        "title": default_title,
        "artist": default_artist,
        "lyrics": lines_raw
    }


def parse_lyrics(filepath: str | Path) -> dict:
    """Load and parse a lyrics JSON, LRC, or SRT file.

    Args:
        filepath: Path to the lyrics file.

    Returns:
        Dict with keys: title, artist, lines (list of LyricLine).
    """
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"Lyrics file not found: {filepath}")

    ext = filepath.suffix.lower()
    if ext == ".lrc":
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            data = parse_lrc_string(f.read(), default_title=filepath.stem)
    elif ext in (".srt", ".vtt"):
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            data = parse_srt_string(f.read(), default_title=filepath.stem)
    else:
        with open(filepath, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in {filepath}: {e}")
        _validate_structure(data, filepath)

    raw_lyrics = data["lyrics"]
    lines, gap_periods = _build_lyric_lines(raw_lyrics)

    return {
        "title": data.get("title", filepath.stem),
        "artist": data.get("artist", "Unknown Artist"),
        "intro_end_time": data.get("intro_end_time"),
        "outro_start_time": data.get("outro_start_time"),
        "bpm": data.get("bpm"),
        "time_sig_num": data.get("time_sig_num"),
        "beat_offset_s": data.get("beat_offset_s"),
        "lines": lines,
        "gap_periods": gap_periods,
    }


def _validate_structure(data: dict, filepath: Path) -> None:
    """Validate the top-level JSON structure."""
    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object in {filepath}, got {type(data).__name__}")

    for key in ("title", "artist", "lyrics"):
        if key not in data:
            raise ValueError(f"Missing required key '{key}' in {filepath}")

    if not isinstance(data["lyrics"], list):
        raise ValueError(f"'lyrics' must be a list in {filepath}")

    if len(data["lyrics"]) < 2:
        raise ValueError(f"'lyrics' must have at least 2 entries (one line + end marker) in {filepath}")

    for i, entry in enumerate(data["lyrics"]):
        if not isinstance(entry, dict):
            raise ValueError(f"Lyric entry {i} must be an object in {filepath}")
        if "time" not in entry or "text" not in entry:
            raise ValueError(f"Lyric entry {i} missing 'time' or 'text' in {filepath}")
        if not isinstance(entry["time"], (int, float)):
            raise ValueError(f"Lyric entry {i} 'time' must be a number in {filepath}")
        if not isinstance(entry["text"], str):
            raise ValueError(f"Lyric entry {i} 'text' must be a string in {filepath}")


def _build_lyric_lines(raw_lyrics: list[dict]) -> tuple[list[LyricLine], list[GapPeriod]]:
    """Convert raw lyric entries into LyricLine objects with computed durations.

    Also extracts mid-array empty entries as GapPeriod objects representing
    instrumental interludes. The trailing empty end marker is not treated as a gap.
    """
    lines: list[LyricLine] = []
    gap_periods: list[GapPeriod] = []

    for i, entry in enumerate(raw_lyrics):
        if entry["text"] == "":
            # Look ahead for the next non-empty entry to determine gap end time.
            next_t = None
            for j in range(i + 1, len(raw_lyrics)):
                if raw_lyrics[j]["text"] != "":
                    next_t = raw_lyrics[j]["time"]
                    break
            if next_t is not None:
                # Mid-array gap (interlude)
                gap_periods.append(GapPeriod(start_time=entry["time"], end_time=next_t))
            continue

        start_time = entry["time"]

        # End time is the start of the next entry
        if i + 1 < len(raw_lyrics):
            end_time = raw_lyrics[i + 1]["time"]
        else:
            # Last line with no end marker — give it a default 3s duration
            end_time = start_time + 3.0

        duration = end_time - start_time

        lines.append(LyricLine(
            text=entry["text"],
            start_time=start_time,
            end_time=end_time,
            duration=duration,
        ))

    return lines, gap_periods

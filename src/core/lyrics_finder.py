"""Fetch lyrics from NetEase Music API (music.163.com) with multi-source fallback.

This module replaces the broken api.lyrics.ovh approach with a direct integration
to NetEase Music's search and lyrics API, inspired by the LrcApi project's
searchx/netease.py implementation.

NetEase provides:
- Song search with fuzzy matching
- LRC-formatted lyrics with millisecond timestamps
- Multiple lyric formats (lrc, romalrc, yrc, klyric)

Endpoints used:
  GET https://music.163.com/api/cloudsearch/pc?s={query}&type=1&offset=0&limit={limit}
  GET https://music.163.com/api/song/lyric?id={track_id}&lv=-1&tv=-1

A small in-memory LRU cache is kept for lyrics to avoid repeated API calls.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import unicodedata
from functools import lru_cache
from typing import Any

import aiohttp

logger = logging.getLogger(__name__)

# API endpoints (from LrcApi mod/searchx/netease.py)
SEARCH_URL = "https://music.163.com/api/cloudsearch/pc?s={}&type=1&offset=0&limit={}"
LYRICS_URL = "https://music.163.com/api/song/lyric?id={}&lv=-1&tv=-1"

# Request headers (mirrors browser user-agent)
HEADERS = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
    "origin": "https://music.163.com",
    "referer": "https://music.163.com",
}

# Search configuration
SEARCH_LIMIT = 100  # Maximum results to fetch
RESULT_CAP = 10  # Maximum candidates to process for lyrics
FINDER_TIMEOUT = 30.0  # Total timeout for find operation

# Similarity threshold for matching (0.0-1.0, higher = stricter)
SIMILARITY_THRESHOLD = 0.2

# Garbage values to reject early
_GARBAGE = {
    "artist", "title", "unknown", "undefined", "null",
    "no song playing", "_", "",
}

# Patterns for metadata lines to filter out
# These are production credits that appear at the end of LRC files
_METADATA_PATTERNS = re.compile(
    r"^(作词|作曲|编曲|制作人|Lead|Backing|Piano|Electric|Guitar|Bass|Drums|"
    r"Timpani|Gong|Operatic|Vocals|Recorded|Mixing|Mastering|Producer|Director|"
    r"Arrangement|Lyrics|Music|Words|Trumpet|Saxophone|Violin|Cellist|"
    r"Orchestral|Flute|Clarinet|Horn|Triangle|Cymbals|Marimba|Xylophone|"
    r"Harpsichord|Synthesizer|Keyboards|String|Choir)",
    re.IGNORECASE
)

# Common metadata phrases that appear with colons (e.g., "Drums: John Smith")
_METADATA_COLON_PATTERNS = re.compile(
    r"^(作词|作曲|编曲|制作人|Lead|Backing|Piano|Electric|Guitar|Bass|Drums|"
    r"Timpani|Gong|Operatic|Vocals|Recorded|Mixing|Mastering|Producer|Director|"
    r"Arrangement|Lyrics|Music|Words|Trumpet|Saxophone|Violin|Cellist|"
    r"Orchestral|Flute|Clarinet|Horn|Triangle|Cymbals|Marimba|Xylophone|"
    r"Harpsichord|Synthesizer|Keyboards|String|Choir)\s*[:|]",
    re.IGNORECASE
)


class LyricsFinderError(Exception):
    """Raised when no lyrics could be found for the requested song."""


class LyricsNotFoundError(LyricsFinderError):
    """Raised when lyrics were not found for a valid song."""


class LyricsApiError(LyricsFinderError):
    """Raised when the lyrics API returns an error."""


def _is_garbage(value: str) -> bool:
    return value.strip().lower() in _GARBAGE


def _deburr(s: str) -> str:
    """Remove combining diacritical marks."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def _strip_to_alnum(s: str) -> str:
    """Keep only alphanumeric characters, lowercased."""
    return re.sub(r"[^a-zA-Z0-9]+", "", s).lower()


def _levenshtein(a: str, b: str) -> int:
    """Compute Levenshtein distance between two strings."""
    m, n = len(a), len(b)
    if m == 0:
        return n
    if n == 0:
        return m
    prev = list(range(n + 1))
    cur = [0] * (n + 1)
    for i in range(1, m + 1):
        cur[0] = i
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev, cur = cur, prev
    return prev[n]


def _title_matches(requested: str, found: str) -> bool:
    """Check if found title matches requested title using fuzzy matching.

    Uses exact match, substring containment, or Levenshtein distance <= 30%.
    """
    def normalize(s: str) -> str:
        s = _deburr(s).lower()
        s = re.sub(r"\(.*?\)|\[.*?\]|\{.*?\}", "", s)
        s = _strip_to_alnum(s)
        return s

    a = normalize(requested)
    b = normalize(found)
    if not a or not b:
        return False
    if a == b:
        return True
    if a in b or b in a:
        return True
    dist = _levenshtein(a, b)
    max_len = max(len(a), len(b))
    return max_len > 0 and (dist / max_len) <= 0.30


def _primary_artist(artist: str) -> str:
    """Extract primary artist, stripping feat./ft./& etc."""
    parts = re.split(
        r"\s*(?:feat\.?|ft\.?|featuring|&|/|,|;)\s*",
        artist,
        flags=re.IGNORECASE
    )
    if parts:
        candidate = parts[0].strip()
        if candidate and len(candidate) > 1:
            return candidate
    return artist.strip()


def _compute_similarity(title: str, artist: str, album: str, song: dict) -> float:
    """Compute similarity score between requested metadata and a song result.

    Returns a value between 0 and 1, where 1 is a perfect match.
    Based on LrcApi's textcompare approach.
    """
    song_name = song.get("name", "")
    song_names = song.get("alia", []) or []
    song_names.append(song_name)

    artists = song.get("ar", []) or []
    singer_name = " ".join([x.get("name", "") for x in artists]) if artists else ""

    album_info = song.get("al")
    album_name = album_info.get("name", "") if album_info else ""

    # Title similarity: max across all names (including aliases)
    title_norm = _strip_to_alnum(title)
    name_norms = [_strip_to_alnum(n) for n in song_names if n]
    if title_norm and name_norms:
        title_dists = [_levenshtein(title_norm, n) for n in name_norms]
        min_dist = min(title_dists)
        max_len = max(len(title_norm), max(len(n) for n in name_norms))
        title_ratio = 1.0 - (min_dist / max_len) if max_len > 0 else 0.0
    else:
        title_ratio = 0.0

    # Artist similarity
    artist_norm = _strip_to_alnum(artist)
    singer_norm = _strip_to_alnum(singer_name)
    if artist_norm and singer_norm:
        artist_dist = _levenshtein(artist_norm, singer_norm)
        artist_max = max(len(artist_norm), len(singer_norm))
        artist_ratio = 1.0 - (artist_dist / artist_max) if artist_max > 0 else 0.0
    else:
        artist_ratio = 0.5  # Neutral if either is empty

    # Album similarity
    album_norm = _strip_to_alnum(album)
    album_name_norm = _strip_to_alnum(album_name)
    if album_norm and album_name_norm:
        album_dist = _levenshtein(album_norm, album_name_norm)
        album_max = max(len(album_norm), len(album_name_norm))
        album_ratio = 1.0 - (album_dist / album_max) if album_max > 0 else 0.0
    else:
        album_ratio = 0.5  # Neutral if either is empty

    # Combined ratio (geometric mean style from LrcApi)
    ratio = (title_ratio * (artist_ratio + album_ratio) / 2.0) ** 0.5
    return ratio


async def _search_track(
    session: aiohttp.ClientSession,
    title: str,
    artist: str = "",
    album: str = ""
) -> list[dict[str, Any]]:
    """Search for a track on NetEase Music.

    Returns a list of candidate songs with metadata and similarity scores.
    """
    search_str = " ".join([item for item in [title, artist, album] if item])
    if not search_str:
        return []

    url = SEARCH_URL.format(
        search_str.replace(" ", "+"),
        SEARCH_LIMIT
    )

    try:
        async with session.get(url, headers=HEADERS, timeout=10) as resp:
            if resp.status != 200:
                logger.warning(f"NetEase search returned status {resp.status}")
                return []
            text = await resp.text()
            data = json.loads(text)
    except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError) as e:
        logger.error(f"NetEase search failed: {e}")
        return []

    try:
        songs = data.get("result", {}).get("songs", [])
    except (AttributeError, KeyError, TypeError):
        return []

    if not songs:
        return []

    candidates = []
    for song in songs:
        song_names = song.get("alia", []) or []
        song_names.append(song.get("name", ""))

        artists = song.get("ar", []) or []
        singer_name = " ".join([x.get("name", "") for x in artists]) if artists else ""

        album_info = song.get("al")
        album_name = album_info.get("name", "") if album_info else ""

        # Compute similarity
        similarity = _compute_similarity(title, artist, album, song)

        if similarity >= SIMILARITY_THRESHOLD:
            track_id = song.get("id")
            album_id = album_info.get("id") if album_info else None

            candidates.append({
                "ratio": similarity,
                "item": {
                    "title": title,  # Use requested title for consistency
                    "artist": singer_name,
                    "album": album_name,
                    "track_id": track_id,
                    "album_id": album_id,
                }
            })

    # Sort by similarity and cap results
    candidates.sort(key=lambda x: x["ratio"], reverse=True)
    return candidates[:min(len(candidates), RESULT_CAP)]


async def _get_lyrics_text(
    session: aiohttp.ClientSession,
    track_id: int
) -> str | None:
    """Fetch LRC lyrics for a track from NetEase.

    Returns the LRC text or None if not available.
    Prefers lrc, falls back to romalrc, yrc, klyric.
    Does NOT fall back to tlyric (translations).
    """
    url = LYRICS_URL.format(track_id)

    try:
        async with session.get(url, headers=HEADERS, timeout=10) as resp:
            if resp.status != 200:
                logger.warning(f"NetEase lyrics returned status {resp.status}")
                return None
            text = await resp.text()
            data = json.loads(text)
    except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError) as e:
        logger.error(f"NetEase lyrics fetch failed: {e}")
        return None

    # Extract lyrics in preference order
    lrc_data = data.get("lrc", {})
    lyric = lrc_data.get("lyric")

    if lyric:
        return lyric

    # Fallbacks (excluding tlyric which is translations)
    for key in ["romalrc", "yrc", "klyric"]:
        fallback = data.get(key, {})
        if fallback_lyric := fallback.get("lyric"):
            return fallback_lyric

    return None


async def _fetch_lyrics_netease(
    title: str,
    artist: str = "",
    album: str = ""
) -> str | None:
    """Fetch lyrics from NetEase Music API.

    Args:
        title: Song title (required)
        artist: Artist name (optional but improves matching)
        album: Album name (optional but improves matching)

    Returns:
        LRC-formatted lyrics string, or None if not found.
    """
    if not title or _is_garbage(title):
        return None

    async with aiohttp.ClientSession() as session:
        # Search for the track
        candidates = await _search_track(session, title, artist, album)

        if not candidates:
            logger.info(f"No candidates found for '{title}'")
            return None

        # Try each candidate in order of similarity
        for candidate in candidates:
            track_id = candidate["item"]["track_id"]
            if not track_id:
                continue

            logger.info(
                f"Trying track {track_id}: {candidate['item']['title']} "
                f"(similarity: {candidate['ratio']:.2f})"
            )

            lyrics = await _get_lyrics_text(session, track_id)
            if lyrics:
                return lyrics

    return None


@lru_cache(maxsize=128)
def find_lyrics(
    title: str,
    artist: str = "",
    album: str = ""
) -> str:
    """Find lyrics for a song using NetEase Music API.

    This is the main entry point. It searches NetEase Music for the song
    and returns LRC-formatted lyrics with timestamps.

    Args:
        title: Song title (required)
        artist: Artist name (optional, improves matching accuracy)
        album: Album name (optional, improves matching accuracy)

    Returns:
        LRC-formatted lyrics string with timestamp tags like [mm:ss.xx]

    Raises:
        ValueError: If title is empty or garbage.
        LyricsNotFoundError: If no lyrics could be found.
        LyricsApiError: If the API returns an error.
    """
    # Type checks
    if not isinstance(title, str):
        raise TypeError(f"Title must be a string, got {type(title).__name__}")
    if artist and not isinstance(artist, str):
        raise TypeError(f"Artist must be a string, got {type(artist).__name__}")
    if album and not isinstance(album, str):
        raise TypeError(f"Album must be a string, got {type(album).__name__}")

    title_s = title.strip()
    artist_s = artist.strip() if artist else ""
    album_s = album.strip() if album else ""

    if not title_s:
        raise ValueError("Title is required.")
    if _is_garbage(title_s):
        raise ValueError(f"Invalid title: {title_s!r}")

    async def _run() -> str | None:
        return await _fetch_lyrics_netease(title_s, artist_s, album_s)

    try:
        result = asyncio.run(_run())
    except Exception as e:
        logger.error(f"Error fetching lyrics for '{title_s}': {e}")
        raise LyricsApiError(f"Failed to fetch lyrics: {e}") from e

    if result is None:
        raise LyricsNotFoundError(
            f"No lyrics found for '{title_s}'"
            + (f" by {artist_s}" if artist_s else "")
        )

    return result


def parse_lrc_timestamp(line: str) -> float | None:
    """Extract timestamp from an LRC line.

    Args:
        line: An LRC line like "[00:03.872]Some lyrics here"

    Returns:
        Timestamp in seconds, or None if no timestamp found.
    """
    match = re.match(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]", line)
    if not match:
        return None

    minutes = int(match.group(1))
    seconds = int(match.group(2))
    millis_str = match.group(3)
    millis = float("0." + millis_str) if millis_str else 0.0

    return minutes * 60 + seconds + millis


def extract_lyrics_lines(lrc_text: str) -> list[tuple[float, str]]:
    """Parse LRC text into a list of (timestamp, text) tuples.

    Filters out metadata lines (production credits, composer credits, etc.)
    and returns only actual lyric content lines.

    Args:
        lrc_text: Raw LRC-formatted lyrics text

    Returns:
        List of (timestamp_seconds, lyric_text) tuples, sorted by time.
    """
    lines = []
    timestamp_pattern = re.compile(r"^\[(\d{1,2}:\d{2}(?:[.:]\d{2,3})?)\]")

    for raw_line in lrc_text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        # Skip metadata tags (no timestamp or non-time tags)
        if line.startswith("["):
            if not timestamp_pattern.match(line):
                continue  # Skip metadata like [ti:], [ar:], etc.

        match = timestamp_pattern.match(line)
        if not match:
            continue

        ts = parse_lrc_timestamp(line)
        if ts is None:
            continue

        # Extract text after timestamp
        text_start = match.end()
        text = line[text_start:].strip()

        # Skip empty lines and metadata/content warnings
        if not text:
            continue

        # Skip production credits and metadata lines
        if _METADATA_COLON_PATTERNS.match(text) or _METADATA_PATTERNS.match(text):
            continue

        # Skip Chinese metadata labels
        if text.startswith(("作词", "作曲", "编曲", "制作人")):
            continue

        lines.append((ts, text))

    # Sort by timestamp
    lines.sort(key=lambda x: x[0])
    return lines


# For backward compatibility with existing code that may call this
def find_lyrics_simple(title: str, artist: str = "") -> str:
    """Simple interface: just title and artist."""
    return find_lyrics(title, artist)


def get_lyrics_as_json(title: str, artist: str = "", album: str = "") -> dict:
    """Get lyrics formatted for the video generator's expected JSON structure.

    This converts NetEase LRC lyrics into the format expected by the
    lyric video generator (title, artist, lyrics array with time/text).

    Args:
        title: Song title
        artist: Artist name
        album: Album name (optional)

    Returns:
        Dict with keys: title, artist, lyrics (list of {time, text})
    """
    lrc_text = find_lyrics(title, artist, album)
    lines = extract_lyrics_lines(lrc_text)

    # Build lyrics array
    lyrics_list = []
    for ts, text in lines:
        lyrics_list.append({
            "time": round(ts, 2),
            "text": text
        })

    # Add end marker if not present
    if lyrics_list and lyrics_list[-1]["text"] != "":
        last_time = lyrics_list[-1]["time"]
        lyrics_list.append({
            "time": round(last_time + 3.0, 2),
            "text": ""
        })

    return {
        "title": title,
        "artist": artist or "Unknown Artist",
        "lyrics": lyrics_list
    }


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    # Test with command line args or default
    test_title = sys.argv[1] if len(sys.argv) > 1 else "Bohemian Rhapsody"
    test_artist = sys.argv[2] if len(sys.argv) > 2 else "Queen"

    print(f"Searching for: {test_title} by {test_artist}")
    try:
        lrc_text = find_lyrics(test_title, test_artist)
        lines = extract_lyrics_lines(lrc_text)
        print(f"\nFound {len(lines)} timestamped lyric lines:\n")
        for ts, text in lines[:15]:
            print(f"  [{ts:.2f}s] {text}")
        if len(lines) > 15:
            print(f"... ({len(lines) - 15} more lines)")
    except LyricsFinderError as e:
        print(f"Error: {e}")

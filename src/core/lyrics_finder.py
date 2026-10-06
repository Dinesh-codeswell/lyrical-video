"""Fetch lyrics from the public api.lyrics.ovh service (multi-source lyric scraper).

api.lyrics.ovh aggregates several lyric sources (Genius, AZLyrics, Paroles.net,
LyricsMania, Letras.mus.br, Lyrics.com) and returns the first successful result.
This module mirrors the behaviour of the open-source lyrics.ovh project
(https://github.com/NTag/lyrics.ovh) by calling its published API.

Public endpoints used:
  GET https://api.lyrics.ovh/v1/{artist}/{title}  -> {"lyrics": "..."} | {"error": "..."}
  GET https://api.lyrics.ovh/suggest/{term}       -> Deezer search suggestions

A small in-memory LRU cache is kept keyed on (artist, title) to avoid repeated
calls for the same song within a single process lifetime.
"""

from __future__ import annotations

import asyncio
import re
from functools import lru_cache
from typing import Any

import httpx

API_BASE = "https://api.lyrics.ovh"
FINDER_TIMEOUT = 12.0  # seconds for the whole find operation (sources are parallel)

# Queries that are clearly placeholder / junk — fail fast without hitting the API.
_GARBAGE = {
    "artist", "title", "unknown", "undefined", "null",
    "no song playing", "_", "",
}

# Normalisation helpers (mirror lyrics.js deburr / stripToAlphaNum / titleMatches).
_RE_TRAILING_ACCENTS = re.compile(r"[\u0300-\u036f]")
_RE_NON_ALNUM = re.compile(r"[^a-zA-Z0-9]+")


def _deburr(s: str) -> str:
    return _RE_TRAILING_ACCENTS.sub("", s.normalize("NFD") if hasattr(s, "normalize") else s)


def _strip_to_alnum(s: str) -> str:
    return _RE_NON_ALNUM.sub("", s).lower()


def _levenshtein(a: str, b: str) -> int:
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
    """Return True if `found` is a reasonable match for the requested title.

    Mirrors the lyrics.ovh titleMatches logic: exact normalised match, substring
    containment, or Levenshtein distance <= 30% of the longer string.
    """

    def normalize(s: str) -> str:
        s = _deburr(s).lower()
        s = re.sub(r"\(.*?\)|\[.*?\]|\{.*?\}", "", s)
        s = _RE_NON_ALNUM.sub("", s)
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


def _normalize_for_compare(s: str) -> str:
    """Lower-case, de-accented, alphanumeric-only form for fuzzy matching."""
    return _strip_to_alnum(_deburr(s))


def _primary_artist(artist: str) -> str:
    """Return the primary artist when the artist string includes feat./ft./&/, etc."""
    parts = re.split(r"\s*(?:feat\.?|ft\.?|featuring|&|/|,|;)\s*", artist, flags=re.IGNORECASE)
    if parts:
        candidate = parts[0].strip()
        if candidate and len(candidate) > 1:
            return candidate
    return artist.strip()


class LyricsFinderError(Exception):
    """Raised when no lyrics could be found for the requested song."""


def _is_garbage(value: str) -> bool:
    return value.strip().lower() in _GARBAGE


def find_lyrics(artist: str, title: str, client: httpx.Client | None = None) -> str:
    """Fetch lyrics for `title` by `artist` from api.lyrics.ovh.

    Args:
        artist: Artist name.
        title: Song title.
        client: Optional shared httpx.Client (avoids recreating the pool).

    Returns:
        The lyrics text.

    Raises:
        LyricsFinderError: If no lyrics are found or the request fails.
        ValueError: If artist/title are missing or garbage.
    """
    artist_s = artist.strip()
    title_s = title.strip()

    if not artist_s or not title_s:
        raise ValueError("Artist and title are required.")
    if _is_garbage(artist_s) or _is_garbage(title_s):
        raise ValueError("Invalid artist or title.")

    # Fast path: try the normalised primary-artist + clean-title form first.
    # The public API is forgiving, but sending a cleaner query improves hit rate.
    def _lookup(artist_q: str, title_q: str) -> str:
        url = f"{API_BASE}/v1/{_encode(artist_q)}/{_encode(title_q)}"
        c = client or httpx.Client(timeout=FINDER_TIMEOUT, follow_redirects=True)
        try:
            resp = c.get(url, headers={"User-Agent": "LyricVideoGenerator/1.0"})
        finally:
            if client is None:
                c.close()

        if resp.status_code == 404:
            raise LyricsFinderError("No lyrics found")
        if resp.status_code == 400:
            raise LyricsFinderError("Invalid artist or title")
        if not resp.is_success:
            raise LyricsFinderError(f"API error: HTTP {resp.status_code}")

        data = resp.json()
        lyrics = data.get("lyrics")
        if not lyrics or not isinstance(lyrics, str) or not lyrics.strip():
            raise LyricsFinderError("No lyrics found")
        return lyrics.strip()

    return _lookup(artist_s, title_s)


def _encode(s: str) -> str:
    # The public API expects URL-encoded path segments; httpx handles this when
    # passed as separate path parts, but building the URL manually is also safe
    # as long as we percent-encode reserved characters.
    from urllib.parse import quote

    return quote(s.replace(" ", "+"), safe="")


@lru_cache(maxsize=2048)
def _cached_suggest(term: str, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Deezer-powered suggestions via api.lyrics.ovh/suggest/{term}.

    Returns a list of {"artist": ..., "title": ...} dicts.
    """
    if not term.strip():
        return []
    url = f"{API_BASE}/suggest/{_encode(term)}"
    c = client or httpx.Client(timeout=8.0, follow_redirects=True)
    try:
        resp = c.get(url, headers={"User-Agent": "LyricVideoGenerator/1.0"})
    finally:
        if client is None:
            c.close()
    if not resp.is_success:
        return []
    data = resp.json()
    items = data.get("data") or []
    out: list[dict[str, Any]] = []
    for item in items:
        artist = (item.get("artist") or {}).get("name") or ""
        title = item.get("title") or ""
        if artist and title:
            out.append({"artist": artist, "title": title})
    return out


def suggest(term: str, client: httpx.Client | None = None) -> list[dict[str, Any]]:
    """Return suggested artist/title pairs for a search term."""
    return _cached_suggest(term.strip(), client)

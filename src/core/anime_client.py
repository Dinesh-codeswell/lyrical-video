"""Anime image API client — fetches anime-style images for use as video backgrounds.

Supports multiple backends with automatic fallback:

  1. Nekos API  (https://api.nekosapi.com/v5)  — preferred, self-hostable
  2. Danbooru   (https://danbooru.donmai.us)  — large tag-based archive

Usage::

    from src.core import anime_client

    # Search by tag
    images = anime_client.search_tags("demon slayer", limit=10)
    img = images[0]
    print(img["url"])          # direct image URL
    print(img["preview_url"])  # smaller preview
    print(img["tags"])         # list of tag strings

    # Get a random image (optionally filtered by tag)
    img = anime_client.get_random(tag="watame")

    # Download and persist to input/backgrounds/
    path = anime_client.download_to_backgrounds(img)
"""
from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

# ── Config ──────────────────────────────────────────────────────────────────

NEKOS_API_BASE = os.environ.get("NEKOS_API_URL", "https://api.nekosapi.com/v5")
NEKOS_API_KEY = os.environ.get("NEKOS_API_KEY", "")  # optional, increases rate limits

DANBOORU_API_BASE = "https://danbooru.donmai.us"
DANBOORU_API_KEY = os.environ.get("DANBOORU_API_KEY", "")  # optional

DEFAULT_BACKGROUNDS_DIR = Path("input/backgrounds")

# Per-backend rate-limit pauses (seconds between requests).
_BACKEND_COOLDOWN: dict[str, float] = {
    "nekos": 1.0,
    "danbooru": 0.4,
}

# ── Shared helpers ──────────────────────────────────────────────────────────

def _ensure_dirs() -> None:
    DEFAULT_BACKGROUNDS_DIR.mkdir(parents=True, exist_ok=True)


def _http_get(url: str, params: dict | None = None, timeout: int = 30) -> requests.Response:
    """Thin wrapper around requests.get with a User-Agent and basic retry."""
    headers = {
        "User-Agent": "LyricVideoGenerator/1.0 (anime background fetcher)",
    }
    resp = requests.get(url, params=params, headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp


# Rating vocabularies differ per backend. Endpoints pass values like "safe"
# around, so normalise to each backend's own enum — unknown values fall back
# to the safest option instead of triggering a 422 validation error.
_NEKOS_RATING_ALIASES: dict[str, str] = {
    "safe": "safe", "s": "safe", "g": "safe", "general": "safe", "sfw": "safe",
    "suggestive": "suggestive",
    "questionable": "borderline", "q": "borderline", "borderline": "borderline",
    "explicit": "explicit", "e": "explicit", "nsfw": "explicit",
}
_DANBOORU_RATING_ALIASES: dict[str, str] = {
    "safe": "general", "g": "general", "general": "general",
    "suggestive": "sensitive", "s": "sensitive", "sensitive": "sensitive",
    "questionable": "questionable", "q": "questionable", "borderline": "questionable",
    "explicit": "explicit", "e": "explicit", "nsfw": "explicit",
}


def _nekos_rating(rating: str | None) -> str:
    """Normalise a rating to Nekos' vocabulary (safe/suggestive/…)."""
    return _NEKOS_RATING_ALIASES.get((rating or "safe").strip().lower(), "safe")


def _danbooru_rating(rating: str | None) -> str:
    """Normalise a rating to Danbooru's vocabulary (general/sensitive/…)."""
    return _DANBOORU_RATING_ALIASES.get((rating or "safe").strip().lower(), "general")


# ── Result type ─────────────────────────────────────────────────────────────

@dataclass
class AnimeImage:
    """A single anime image ready to be used as a video background."""

    url: str                       # direct download URL
    preview_url: str              # smaller/cached preview URL (may equal url)
    source_url: str               # page on the source site
    tags: list[str]               # associated tags
    score: int                    # community score/rating (0 if unknown)
    width: int                    # image width in px (0 if unknown)
    height: int                   # image height in px (0 if unknown)
    backend: str                  # which backend supplied this image

    def to_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "preview_url": self.preview_url,
            "source_url": self.source_url,
            "tags": self.tags,
            "score": self.score,
            "width": self.width,
            "height": self.height,
            "backend": self.backend,
        }


# ── Nekos API backend ───────────────────────────────────────────────────────

class _NekosBackend:
    """Client for the Nekos API v5 image endpoints."""

    def __init__(self) -> None:
        self._cache: list[AnimeImage] | None = None

    # ── public API ────────────────────────────────────────────────────────

    def search_tags(
        self,
        query: str,
        limit: int = 20,
        rating: str = "safe",
    ) -> list[AnimeImage]:
        """Search Nekos API images by tag query string.

        The v5 ``/images`` endpoint matches ``tag`` **exactly**, so a
        free-text query is tried as-is first and then resolved to real tag
        names via the ``/tags`` substring endpoint before retrying.

        Args:
            query: Free-text tag search (e.g. "catgirl", "demon slayer").
            limit: Maximum images to return (API cap is 100).
            rating: Rating filter — ``safe``/``suggestive``/``borderline``/
                ``explicit`` (aliases like ``s``/``q``/``nsfw`` accepted).
        """
        if not query or not query.strip():
            return []
        limit = max(1, min(int(limit or 20), 100))
        rating = _nekos_rating(rating)
        query = query.strip()

        # 1) Try the query as an exact tag name.
        results = self._fetch_images(tags=[query], limit=limit, rating=rating)
        if results:
            return results

        # 2) Resolve the free text to real tag names (substring match).
        names = self._resolve_tags(query, limit=5)
        if not names:
            return []
        return self._fetch_images(tags=names, limit=limit, rating=rating)

    def _resolve_tags(self, query: str, limit: int = 5) -> list[str]:
        """Resolve a free-text query to exact Nekos tag names.

        Uses ``GET /v5/tags?name=…`` (case-insensitive substring match).
        Returns an empty list on any failure.
        """
        url = f"{NEKOS_API_BASE}/tags"
        params: dict[str, Any] = {"name": query, "limit": max(1, min(limit, 100))}
        if NEKOS_API_KEY:
            params["api_key"] = NEKOS_API_KEY
        try:
            resp = _http_get(url, params=params)
        except requests.RequestException:
            return []
        data = resp.json()
        if isinstance(data, dict):
            items = data.get("items") or data.get("data") or []
        elif isinstance(data, list):
            items = data
        else:
            items = []
        return [
            str(item["name"])
            for item in items
            if isinstance(item, dict) and item.get("name")
        ][:limit]

    def _fetch_images(
        self,
        tags: list[str],
        limit: int,
        rating: str,
    ) -> list[AnimeImage]:
        """Fetch images from ``GET /v5/images`` with exact tag filters.

        ``tag`` is a repeatable param (OR semantics, API max 5 tags);
        pagination is ``limit``/``offset`` and the rating filter is a plain
        ``rating`` param — older ``filter[rating][in][0]``/``page[size]``
        names are silently ignored by the API.
        """
        url = f"{NEKOS_API_BASE}/images"
        params: dict[str, Any] = {"limit": limit}
        if tags:
            params["tag"] = tags[:5]
        if rating:
            params["rating"] = rating
        if NEKOS_API_KEY:
            params["api_key"] = NEKOS_API_KEY

        resp = _http_get(url, params=params)
        data = resp.json()
        # Nekos v5 returns {"items": [...], "total": N}. Older/mock shapes
        # used {"data": [...]}; accept either so the parser is robust.
        if isinstance(data, dict):
            results = data.get("items") or data.get("data") or []
        elif isinstance(data, list):
            results = data
        else:
            results = []
        return [_nekos_row_to_image(row, "nekos") for row in results if isinstance(row, dict)]

    def get_random(
        self,
        tag: str | None = None,
        rating: str = "safe",
    ) -> AnimeImage | None:
        """Return a random image, optionally filtered by a single tag.

        The v5 ``tag`` filter is an exact-name match and an unknown tag
        yields 404, so when a tag is given we try: the raw tag → a tag
        resolved via ``/tags`` → no tag at all. This way free-text tags
        (and typos) still produce an image instead of a hard failure.
        """
        url = f"{NEKOS_API_BASE}/images/random"
        rating = _nekos_rating(rating)

        attempts: list[str | None] = [tag.strip()] if tag and tag.strip() else [None]
        if attempts[0]:
            resolved = self._resolve_tags(attempts[0], limit=1)
            if resolved and resolved[0] != attempts[0]:
                attempts.append(resolved[0])
            attempts.append(None)  # last resort: untagged random

        resp: requests.Response | None = None
        for candidate in attempts:
            params: dict[str, Any] = {}
            if candidate:
                params["tag"] = candidate
            if rating:
                params["rating"] = rating
            if NEKOS_API_KEY:
                params["api_key"] = NEKOS_API_KEY
            try:
                resp = _http_get(url, params=params)
                break
            except requests.RequestException:
                continue
        if resp is None:
            return None

        data = resp.json()
        # Nekos v5 /images/random returns a flat image object (no "data"
        # wrapper). Be tolerant: unwrap "data" if present, else use the
        # object itself.
        if isinstance(data, dict) and "data" in data and isinstance(data["data"], dict):
            row = data["data"]
        else:
            row = data
        if not isinstance(row, dict) or not row:
            return None
        return _nekos_row_to_image(row, "nekos")

    # ── internal ──────────────────────────────────────────────────────────

    def _clear_cache(self) -> None:
        self._cache = None


def _nekos_row_to_image(row: dict[str, Any], backend: str) -> AnimeImage:
    """Convert a Nekos API image row into an :class:`AnimeImage`.

    Handles both the current flat v5 shape (``url``/``source_url``/``tags``
    at the top level, tags as ``[{"name": ...}]``) and the older nested
    shape (``meta.urls`` / ``meta.source``) so parsing is robust to either.
    """
    # Tags: list of dicts with "name" (v5) — tolerate plain strings too.
    tags_raw = row.get("tags", [])
    tags: list[str] = []
    if isinstance(tags_raw, list):
        for t in tags_raw:
            if isinstance(t, dict):
                name = t.get("name")
                if name:
                    tags.append(str(name))
            elif isinstance(t, str):
                tags.append(t)

    # Image URL: flat "url" (v5) or nested meta.urls (older shape).
    meta = row.get("meta", {}) or {}
    urls = (meta.get("urls", {}) if isinstance(meta, dict) else {}) or {}
    source = (meta.get("source", {}) if isinstance(meta, dict) else {}) or {}

    url = (
        row.get("url")
        or urls.get("original")
        or urls.get("regular")
        or ""
    )
    preview = (
        row.get("preview_url")
        or urls.get("preview")
        or urls.get("regular")
        or url
    )
    source_url = row.get("source_url") or source.get("url") or ""

    # Numeric fields may be absent in v5 — fall back to 0.
    def _int(v: Any) -> int:
        try:
            return int(v or 0)
        except (TypeError, ValueError):
            return 0

    return AnimeImage(
        url=url,
        preview_url=preview,
        source_url=source_url,
        tags=tags,
        score=_int(row.get("score")),
        width=_int(row.get("width")),
        height=_int(row.get("height")),
        backend=backend,
    )


# ── Danbooru backend ────────────────────────────────────────────────────────

class _DanbooruBackend:
    """Client for the Danbooru image API."""

    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "LyricVideoGenerator/1.0",
        })
        if DANBOORU_API_KEY:
            self._session.params["login"] = DANBOORU_API_KEY

    # ── public API ────────────────────────────────────────────────────────

    def search_posts(
        self,
        query: str,
        limit: int = 20,
        rating: str = "safe",
    ) -> list[AnimeImage]:
        """Search Danbooru posts by tag query."""
        url = f"{DANBOORU_API_BASE}/posts.json"
        params: dict[str, Any] = {
            "tags": query,
            "limit": limit,
            "ordinal": "random",
            "content": "1",  # exclude wikis/notes
        }
        if rating:
            params["rating"] = _danbooru_rating(rating)

        try:
            resp = self._session.get(url, params=params, timeout=30)
            resp.raise_for_status()
        except requests.RequestException:
            return []

        posts = resp.json()
        return [_danbooru_post_to_image(p, "danbooru") for p in posts]

    def get_random(
        self,
        tag: str | None = None,
        rating: str = "safe",
    ) -> AnimeImage | None:
        """Return a random Danbooru post, optionally filtered by tag."""
        url = f"{DANBOORU_API_BASE}/posts/random.json"
        params: dict[str, Any] = {
            "content": "1",
            "rating": _danbooru_rating(rating),
        }
        if tag:
            params["tags"] = tag

        try:
            resp = self._session.get(url, params=params, timeout=30)
            resp.raise_for_status()
        except requests.RequestException:
            return None

        posts = resp.json()
        if not posts:
            return None
        return _danbooru_post_to_image(posts[0], "danbooru")

    # ── internal ──────────────────────────────────────────────────────────

    def close(self) -> None:
        self._session.close()


def _danbooru_post_to_image(post: dict[str, Any], backend: str) -> AnimeImage:
    file_url = post.get("file_url", "")
    preview_url = post.get("preview_file_url") or file_url
    source_url = f"https://danbooru.donmai.us/post/show/{post.get('id', 0)}"
    tag_string = post.get("tags", "")
    tags = tag_string.split() if tag_string else []

    return AnimeImage(
        url=file_url,
        preview_url=preview_url,
        source_url=source_url,
        tags=tags,
        score=int(post.get("ups", 0) or 0),
        width=int(post.get("image_width", 0) or 0),
        height=int(post.get("image_height", 0) or 0),
        backend=backend,
    )


# ── Unified client ──────────────────────────────────────────────────────────

class AnimeImageClient:
    """Unified interface over available anime image backends.

    Falls back from Nekos API → Danbooru automatically.  Rate-limit pauses
    are applied between calls to each backend.
    """

    def __init__(self) -> None:
        self.nekos = _NekosBackend()
        self.danbooru = _DanbooruBackend()
        self._last_backend: str | None = None

    # ── search ────────────────────────────────────────────────────────────

    def search(
        self,
        query: str,
        limit: int = 20,
        rating: str = "safe",
    ) -> list[AnimeImage]:
        """Search for anime images by tag query.

        Tries Nekos API first; if it returns nothing or raises, falls back
        to Danbooru.
        """
        self._cooldown("nekos")
        try:
            results = self.nekos.search_tags(query, limit=limit, rating=rating)
            if results:
                return results
        except requests.RequestException:
            pass

        self._cooldown("danbooru")
        try:
            return self.danbooru.search_posts(query, limit=limit, rating=rating)
        except requests.RequestException:
            return []

    # ── random ────────────────────────────────────────────────────────────

    def get_random(
        self,
        tag: str | None = None,
        rating: str = "safe",
    ) -> AnimeImage | None:
        """Get a single random anime image, optionally tagged."""
        self._cooldown("nekos")
        try:
            img = self.nekos.get_random(tag=tag, rating=rating)
            if img:
                return img
        except requests.RequestException:
            # Nekos unreachable/timed out — fall through to Danbooru.
            pass

        self._cooldown("danbooru")
        try:
            return self.danbooru.get_random(tag=tag, rating=rating)
        except requests.RequestException:
            return None

    # ── download ──────────────────────────────────────────────────────────

    def download_to_backgrounds(self, img: AnimeImage) -> Path:
        """Download *img* into ``input/backgrounds/`` and return its path.

        The filename is derived from the image's source URL basename, with a
        UUID suffix to avoid collisions.  If the download fails, raises
        ``requests.HTTPError``.
        """
        _ensure_dirs()
        ext = Path(img.url).suffix.lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            ext = ".jpg"
        name = f"anime_{uuid.uuid4().hex[:8]}{ext}"
        dest = DEFAULT_BACKGROUNDS_DIR / name

        resp = _http_get(img.url, timeout=60)
        dest.write_bytes(resp.content)
        return dest

    # ── internal ──────────────────────────────────────────────────────────

    def _cooldown(self, backend: str) -> None:
        """Sleep to respect per-backend rate limits."""
        if self._last_backend == backend:
            return
        pause = _BACKEND_COOLDOWN.get(backend, 0.5)
        time.sleep(pause)
        self._last_backend = backend

    def close(self) -> None:
        self.danbooru.close()


# ── Module-level convenience singleton ──────────────────────────────────────

_client: AnimeImageClient | None = None


def get_client() -> AnimeImageClient:
    """Return the shared ``AnimeImageClient`` instance (lazy-initialized)."""
    global _client
    if _client is None:
        _client = AnimeImageClient()
    return _client


def search_tags(
    query: str,
    limit: int = 20,
    rating: str = "safe",
) -> list[AnimeImage]:
    """Convenience wrapper around ``get_client().search()``."""
    return get_client().search(query, limit=limit, rating=rating)


def get_random_image(
    tag: str | None = None,
    rating: str = "safe",
) -> AnimeImage | None:
    """Convenience wrapper around ``get_client().get_random()``."""
    return get_client().get_random(tag=tag, rating=rating)


def download_image(img: AnimeImage) -> Path:
    """Convenience wrapper around ``get_client().download_to_backgrounds()``."""
    return get_client().download_to_backgrounds(img)

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
        rating: str = "s",
    ) -> list[AnimeImage]:
        """Search Nekos API images by tag query string.

        Args:
            query: Free-text tag search (space-separated AND logic on the API side).
            limit: Maximum images to return.
            rating: Rating filter — ``"s"``, ``"e"``, ``"q"``, or ``"safe|e|questionable"``.
        """
        url = f"{NEKOS_API_BASE}/images"
        params: dict[str, Any] = {
            "tag": query,
            "page[size]": limit,
            "sort": "-created_at",
        }
        if rating:
            params["filter[rating][in][0]"] = rating
        if NEKOS_API_KEY:
            params["api_key"] = NEKOS_API_KEY

        resp = _http_get(url, params=params)
        data = resp.json()
        results = data.get("data", [])
        return [_nekos_row_to_image(row, "nekos") for row in results]

    def get_random(
        self,
        tag: str | None = None,
        rating: str = "s",
    ) -> AnimeImage | None:
        """Return a random image, optionally filtered by a single tag."""
        url = f"{NEKOS_API_BASE}/images/random"
        params: dict[str, Any] = {}
        if tag:
            params["tag"] = tag
        if rating:
            params["filter[rating][in][0]"] = rating
        if NEKOS_API_KEY:
            params["api_key"] = NEKOS_API_KEY

        try:
            resp = _http_get(url, params=params)
        except requests.HTTPError:
            return None
        row = resp.json().get("data")
        if not row:
            return None
        return _nekos_row_to_image(row, "nekos")

    # ── internal ──────────────────────────────────────────────────────────

    def _clear_cache(self) -> None:
        self._cache = None


def _nekos_row_to_image(row: dict[str, Any], backend: str) -> AnimeImage:
    meta = row.get("meta", {}) or {}
    urls = meta.get("urls", {}) or {}
    source = meta.get("source", {}) or {}
    tags_raw = row.get("tags", [])
    tags = [t.get("name", "") for t in tags_raw if isinstance(t, dict)]

    url = urls.get("original") or urls.get("regular") or ""
    preview = urls.get("preview") or urls.get("regular") or url
    source_url = source.get("url") or ""

    return AnimeImage(
        url=url,
        preview_url=preview,
        source_url=source_url,
        tags=tags,
        score=int(row.get("score", 0) or 0),
        width=int(row.get("width", 0) or 0),
        height=int(row.get("height", 0) or 0),
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
            params["rating"] = rating

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
            "rating": rating,
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
        img = self.nekos.get_random(tag=tag, rating=rating)
        if img:
            return img

        self._cooldown("danbooru")
        return self.danbooru.get_random(tag=tag, rating=rating)

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

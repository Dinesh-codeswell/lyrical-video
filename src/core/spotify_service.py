"""
Spotify song download service using spotDL library.

Provides search and download capabilities for the lyric video generator.
This module wraps the spotDL library to provide a clean API for our application.

NOTE: This feature is for personal/educational use only.
Users are responsible for complying with copyright laws and platform ToS.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import requests
import shutil
import sys
import threading
from pathlib import Path
from typing import Any, Callable, Optional, Tuple

logger = logging.getLogger(__name__)

# Optional import - spotDL may not be installed
# We check at runtime rather than import time to allow graceful degradation
# NOTE: probe state lives in _SPOTDL_MODULES (dict = loaded, False = failed,
# None = not probed yet). Do NOT use the SPOTDL_AVAILABLE global for logic —
# writing it from inside _check_spotdl_available() defeats mock.patch targets
# and made batch test runs order-dependent.
SPOTDL_AVAILABLE = False
_SPOTDL_MODULES = None

def _check_spotdl_available() -> bool:
    """Check if spotDL is available at runtime (cached, order-independent)."""
    global _SPOTDL_MODULES

    if isinstance(_SPOTDL_MODULES, dict):
        return True
    if _SPOTDL_MODULES is False:
        return False

    try:
        from spotdl.download.downloader import Downloader
        from spotdl.types.song import Song
        from spotdl.utils.search import get_search_results

        _SPOTDL_MODULES = {
            'Downloader': Downloader,
            'Song': Song,
            'get_search_results': get_search_results,
        }
        logger.info("spotDL successfully loaded")
        return True
    except ImportError as e:
        logger.debug(f"spotDL import check failed: {e}")
        _SPOTDL_MODULES = False
        return False
    except Exception as e:
        logger.warning(f"spotDL loaded but initialization error: {e}")
        _SPOTDL_MODULES = False
        return False


def _get_spotdl_module(name: str):
    """Get a spotDL module, raising if not available."""
    if not _check_spotdl_available():
        raise SpotifyServiceUnavailable(
            "spotDL is not installed. Install it with: uv pip install spotdl"
        )
    
    if not _SPOTDL_MODULES:
        raise SpotifyServiceUnavailable("spotDL modules not loaded")
    
    return _SPOTDL_MODULES.get(name)


_SPOTIFY_CLIENT_INITIALIZED = False


def _ensure_spotify_client() -> None:
    """Initialize spotDL's Spotify client (required before search/download).

    spotDL 4.x requires SpotifyClient.init() to be called once before any
    search or metadata fetch. We use spotDL's bundled default credentials
    (the same ones its own CLI uses), overridable via environment variables:
        SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
    """
    global _SPOTIFY_CLIENT_INITIALIZED
    if _SPOTIFY_CLIENT_INITIALIZED:
        return

    from spotdl.utils.spotify import SpotifyClient
    from spotdl.utils.config import SPOTIFY_OPTIONS

    SpotifyClient.init(
        client_id=os.environ.get("SPOTIFY_CLIENT_ID", SPOTIFY_OPTIONS["client_id"]),
        client_secret=os.environ.get(
            "SPOTIFY_CLIENT_SECRET", SPOTIFY_OPTIONS["client_secret"]
        ),
        user_auth=False,
        # Official Spotify Web API client (spotipy client-credentials flow).
        # The default "free" client mints access tokens via third-party
        # secrets providers (spotdl's secretDict from code.thetadev.de and
        # friends) with no timeouts — that path hangs for minutes on end,
        # which is exactly the endless-loop behaviour seen in the dashboard.
        # The official API is fast and reliable (token in ~0.2s).
        use_official_api=True,
    )
    _SPOTIFY_CLIENT_INITIALIZED = True
    logger.info("spotDL Spotify client initialized (official Web API)")


def _run_with_timeout(fn, timeout_secs: float, *args, **kwargs):
    """Run *fn* in a daemon worker thread, raising after timeout_secs.

    A daemon thread is essential: spotipy sleeps for Retry-After seconds
    (up to 24h once the shared bundled credentials' quota is exhausted)
    inside the call, and a ThreadPoolExecutor would block forever on its
    own shutdown waiting for that stranded worker. The daemon thread dies
    with the process instead.
    """
    box: dict[str, Any] = {}

    def _target() -> None:
        try:
            box["value"] = fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            box["error"] = exc

    worker = threading.Thread(target=_target, daemon=True)
    worker.start()
    worker.join(timeout=timeout_secs)
    if worker.is_alive():
        raise SpotifyDownloadError(
            f"Spotify search timed out after {timeout_secs:.0f}s (no network "
            "response or credentials quota exhausted). Set your own "
            "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET for reliable access."
        )
    if "error" in box:
        raise box["error"]
    return box.get("value")


class _SpotifyTrack:
    """Duck-typed stand-in for spotdl's Song with just the fields the
    search-result conversion needs (name, artists, album, duration, url)."""

    def __init__(self, track_id: str, name: str, artists: list[str],
                 album: str, duration: float) -> None:
        self.song_id = track_id
        self.name = name
        self.artists = artists
        self.artist = artists[0] if artists else "Unknown"
        self.album = album
        self.duration = duration
        self.url = f"https://open.spotify.com/track/{track_id}"


def _spotify_token() -> str:
    """Mint a client-credentials access token (fast, ~0.2s)."""
    from spotdl.utils.config import SPOTIFY_OPTIONS
    cid = os.environ.get("SPOTIFY_CLIENT_ID", SPOTIFY_OPTIONS["client_id"])
    csec = os.environ.get("SPOTIFY_CLIENT_SECRET", SPOTIFY_OPTIONS["client_secret"])
    resp = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        auth=(cid, csec),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _search_spotify(query: str, limit: int = 10) -> list:
    """Search Spotify via the Web API directly (good for plain-requirement).

    This deliberately bypasses spotDL's search helpers: spotipy sleeps for
    Retry-After seconds *inside* the library (up to 24h on the shared
    bundled credentials' exhausted app quota), which is what made the UI
    hang. Here a 429 simply returns [] immediately and the caller falls
    back to the iTunes Search API.
    """
    if not query or not query.strip():
        return []

    headers = {"Authorization": f"Bearer {_spotify_token()}"}

    # Spotify URL → fetch that exact track.
    track_url_match = re.search(r"open\.spotify\.com/track/([A-Za-z0-9]+)", query)
    if track_url_match:
        track_id = track_url_match.group(1)
        resp = requests.get(f"https://api.spotify.com/v1/tracks/{track_id}", headers=headers, timeout=15)
        if resp.status_code != 200:
            return []
        t = resp.json()
        return [_SpotifyTrack(
            track_id=t["id"],
            name=t.get("name", "Unknown"),
            artists=[a.get("name", "") for a in t.get("artists", [])],
            album=(t.get("album") or {}).get("name", ""),
            duration=float(t.get("duration_ms") or 0) / 1000.0,
        )]

    # Regular lyrics/icon searches use the search endpoint.
    resp = requests.get(
        "https://api.spotify.com/v1/search",
        params={"q": query, "type": "track", "limit": max(1, min(int(limit or 10), 50))},
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 429:
        # App-level quota exhausted (shared bundled credentials) — fail fast
        # and let the caller use the iTunes fallback.
        logger.warning("Spotify Web API rate-limited (429) — failing fast")
        return []
    resp.raise_for_status()
    items = (resp.json().get("tracks") or {}).get("items") or []
    return [
        _SpotifyTrack(
            track_id=item["id"],
            name=item.get("name", "Unknown"),
            artists=[a.get("name", "") for a in item.get("artists", [])],
            album=(item.get("album") or {}).get("name", ""),
            duration=float(item.get("duration_ms") or 0) / 1000.0,
        )
        for item in items]



def _itunes_search(query: str, limit: int = 10) -> list[SpotifySearchResult]:
    """Search the iTunes Search API (no auth, no rate limit) as a fallback.

    The bundled spotDL credentials are shared by thousands of users, so the
    Spotify Web API regularly answers 429 (app-level daily quota) — in that
    state NO amount of retrying helps; the search would hang or fail.
    iTunes returns rich, reliable results instantly instead.

    NOTE: results carry no spotify_url, so the spotDL downloader cannot run
    on them until real Spotify credentials are configured via the
    SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars.
    """
    try:
        import requests as _requests
        resp = _requests.get(
            "https://itunes.apple.com/search",
            params={"term": query, "media": "music", "entity": "musicTrack", "limit": limit},
            timeout=10,
        )
        resp.raise_for_status()
        items = resp.json().get("results", []) or []
    except Exception as exc:
        logger.error("iTunes fallback search failed: %s", exc)
        return []

    results: list[SpotifySearchResult] = []
    for item in items:
        title = item.get("trackName") or "Unknown"
        artist = item.get("artistName") or "Unknown"
        duration_ms = item.get("trackTimeMillis") or 0
        results.append(SpotifySearchResult(
            spotify_url="",
            title=title,
            artist=artist,
            album=item.get("collectionName") or "",
            duration=round(duration_ms / 1000.0, 1),
            spotify_id="",
            artwork_url=item.get("artworkUrl100") or "",
            source="itunes",
        ))
    return results


class SpotifyDownloadError(Exception):
    """Raised when Spotify download fails."""


class SpotifyServiceUnavailable(SpotifyDownloadError):
    """Raised when spotDL is not installed or Spotify service is unavailable."""


class SpotifySearchResult:
    """Represents a search result from Spotify."""

    def __init__(
        self,
        spotify_url: str,
        title: str,
        artist: str,
        album: str = "",
        duration: float = 0.0,
        spotify_id: str = "",
        artwork_url: str = "",
        source: str = "spotify",
    ):
        self.spotify_url = spotify_url
        self.title = title
        self.artist = artist
        self.album = album
        self.duration = duration
        self.spotify_id = spotify_id
        self.artwork_url = artwork_url
        # "spotify" = resolvable/downloadable via Spotify API;
        # "itunes" = metadata-only fallback (download needs user creds).
        self.source = source

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "spotify_url": self.spotify_url,
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "duration": self.duration,
            "spotify_id": self.spotify_id,
            "artwork_url": self.artwork_url,
            "source": self.source,
        }


class SpotifyService:
    """
    Service for searching and downloading songs from Spotify via YouTube.

    This class wraps the spotDL library to provide a clean, application-specific
    API for searching and downloading music.

    Usage:
        service = SpotifyService(output_dir=Path("input/audio"))
        results = service.search("Bohemian Rhapsody Queen")
        audio_path, metadata = service.download(results[0].spotify_url)
    """

    def __init__(
        self,
        output_dir: Path,
        ffmpeg_path: Optional[Path] = None,
    ):
        """
        Initialize the Spotify service.

        Args:
            output_dir: Directory to save downloaded audio files
            ffmpeg_path: Optional path to ffmpeg executable

        Raises:
            SpotifyServiceUnavailable: If spotDL is not installed
        """
        if not _check_spotdl_available():
            raise SpotifyServiceUnavailable(
                "spotDL is not installed. Install it with: uv pip install spotdl"
            )

        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # FFmpeg path for audio conversion
        self.ffmpeg_path = ffmpeg_path
        if ffmpeg_path is None:
            # Try to find ffmpeg in PATH
            ffmpeg_path = shutil.which("ffmpeg")
            if ffmpeg_path:
                self.ffmpeg_path = Path(ffmpeg_path)
            else:
                logger.warning("ffmpeg not found in PATH - downloads may fail")

        # Initialize downloader with application-specific settings
        self._init_downloader()

        # Initialize spotDL's Spotify client (required for search/metadata)
        _ensure_spotify_client()

    def _init_downloader(self) -> None:
        """Initialize the spotDL Downloader with our settings."""
        from spotdl.download.downloader import Downloader
        
        settings = {
            "audio_providers": ["youtube"],
            "lyrics_providers": [],  # We use our own lyrics fetcher
            "format": "mp3",
            "output": str(self.output_dir / "%(title)s [%(id)s].%(ext)s"),
            "overwrite": "skip",
            "threads": 1,
            "scan_for_songs": False,
            "print_errors": False,
            "simple_tui": True,
            "generate_lrc": False,  # We handle lyrics separately
            "ffmpeg": str(self.ffmpeg_path) if self.ffmpeg_path else "ffmpeg",
        }

        self.downloader = Downloader(settings=settings)
        logger.debug("Spotify service initialized with output_dir: %s", self.output_dir)

    def search(
        self,
        query: str,
        limit: int = 10,
    ) -> list[SpotifySearchResult]:
        """
        Search for songs on Spotify.

        Args:
            query: Search query (song name, artist, or Spotify URL)
            limit: Maximum number of results to return

        Returns:
            List of matching songs with metadata

        Raises:
            SpotifyDownloadError: If search fails
        """
        if not query or not query.strip():
            return []

        if not _check_spotdl_available():
            raise SpotifyServiceUnavailable("spotDL is not installed")

        try:
            logger.info("Searching Spotify for: %s", query)

            # Use spotDL's search functions, guarded by a hard timeout so a
            # hung network call can never loop the endpoint forever. Note:
            # spotipy sleeps for Retry-After *inside* the call (up to 24h on
            # the shared bundled credentials' exhausted quota) — the timeout
            # is what turns that into a clean failure.
            try:
                songs = _run_with_timeout(_search_spotify, 45, query, limit)
            except Exception as sp_exc:
                logger.warning(
                    "Spotify Web API search failed (%s) — falling back to the "
                    "iTunes Search API",
                    sp_exc,
                )
                songs = []

            if not songs:
                # Spotify-side failure (rate limit, quota, no results) falls
                # back to the always-available iTunes Search API so the user
                # still sees results instead of a dead UI. Those results have
                # no spotify_url — downloading needs real Spotify credentials
                # (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET).
                return _itunes_search(query, limit)

            results = []
            for song in songs[:limit]:
                # Handle both Song objects and dicts
                if hasattr(song, 'url'):
                    song_obj = song
                else:
                    # Try to create Song from dict
                    from spotdl.types.song import Song
                    song_obj = Song.from_dict(song)

                result = SpotifySearchResult(
                    spotify_url=song_obj.url,
                    title=song_obj.name or "Unknown",
                    artist=song_obj.artists[0] if song_obj.artists else song_obj.artist or "Unknown",
                    album=song_obj.album or "",
                    duration=float(song_obj.duration) if song_obj.duration else 0.0,
                    spotify_id=song_obj.song_id or "",
                )
                results.append(result)
                logger.debug(
                    "Found: %s by %s (ID: %s)",
                    result.title,
                    result.artist,
                    result.spotify_id,
                )

            logger.info("Found %d results for: %s", len(results), query)
            return results

        except Exception as e:
            logger.error("Search failed for query '%s': %s", query, e)
            raise SpotifyDownloadError(f"Search failed: {e}") from e

    async def download(
        self,
        spotify_url: str,
        progress_callback: Optional[Callable[[dict], None]] = None,
    ) -> Tuple[Path, dict[str, Any]]:
        """
        Download a song from Spotify URL.

        Args:
            spotify_url: Spotify song URL
            progress_callback: Optional callback for progress updates
                Receives dict with keys: status, progress, message

        Returns:
            Tuple of (path to downloaded file, metadata dict)

        Raises:
            SpotifyDownloadError: If download fails
        """
        if not spotify_url or not spotify_url.startswith("http"):
            raise SpotifyDownloadError("Invalid Spotify URL")

        if not _check_spotdl_available():
            raise SpotifyServiceUnavailable("spotDL is not installed")

        logger.info("Downloading: %s", spotify_url)

        try:
            # Notify progress
            if progress_callback:
                progress_callback({
                    "status": "searching",
                    "message": "Searching for song...",
                    "progress": 0.1,
                })

            # Create song object from URL
            loop = asyncio.get_running_loop()
            song = await loop.run_in_executor(None, lambda: Song.from_url(spotify_url))

            if not song:
                raise SpotifyDownloadError("Could not find song from URL")

            if progress_callback:
                progress_callback({
                    "status": "downloading",
                    "message": f"Downloading '{song.name}'...",
                    "progress": 0.3,
                })

            # Download the song
            result = await loop.run_in_executor(
                None,
                lambda: self.downloader.download_song(song)
            )

            song_obj, audio_path = result

            if audio_path is None or not audio_path.exists():
                raise SpotifyDownloadError(
                    f"Download failed for '{song.name}' - no file returned"
                )

            if progress_callback:
                progress_callback({
                    "status": "complete",
                    "message": f"Downloaded '{song.name}'",
                    "progress": 1.0,
                })

            # Build metadata
            metadata = {
                "title": song_obj.name or "Unknown",
                "artist": song_obj.artists[0] if song_obj.artists else song_obj.artist or "Unknown",
                "album": song_obj.album or "",
                "duration": float(song_obj.duration) if song_obj.duration else 0.0,
                "spotify_url": song_obj.url,
                "spotify_id": song_obj.song_id or "",
            }

            logger.info(
                "Downloaded: %s by %s -> %s",
                metadata["title"],
                metadata["artist"],
                audio_path,
            )

            return audio_path, metadata

        except SpotifyDownloadError:
            raise
        except Exception as e:
            logger.error("Download failed for '%s': %s", spotify_url, e)
            raise SpotifyDownloadError(f"Download failed: {e}") from e

    def download_sync(
        self,
        spotify_url: str,
    ) -> Tuple[Path, dict[str, Any]]:
        """
        Synchronous download (for use in threads or non-async contexts).

        Args:
            spotify_url: Spotify song URL

        Returns:
            Tuple of (path to downloaded file, metadata dict)
        """
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(self.download(spotify_url))
            finally:
                loop.close()
        except RuntimeError:
            # Event loop already running (e.g., in async context)
            return asyncio.run(self.download(spotify_url))

    def move_to_song_directory(
        self,
        audio_path: Path,
        song_slug: str,
    ) -> Path:
        """
        Move downloaded audio to the standard song directory location.

        Args:
            audio_path: Path to the downloaded audio file
            song_slug: Song name/slug for the target filename

        Returns:
            Path to the moved file
        """
        target_dir = self.output_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        # Determine target filename
        target_ext = audio_path.suffix
        target_path = target_dir / f"{song_slug}{target_ext}"

        # If target exists, add a number suffix
        counter = 1
        original_target = target_path
        while target_path.exists():
            target_path = target_dir / f"{song_slug}_{counter}{target_ext}"
            counter += 1

        # Move the file
        shutil.move(str(audio_path), str(target_path))
        logger.info("Moved %s -> %s", audio_path, target_path)

        return target_path

    def check_ffmpeg(self) -> bool:
        """
        Check if ffmpeg is available.

        Returns:
            True if ffmpeg is available, False otherwise
        """
        if self.ffmpeg_path:
            return self.ffmpeg_path.exists()
        return shutil.which("ffmpeg") is not None

    def get_status(self) -> dict[str, Any]:
        """
        Get the current status of the service.

        Returns:
            Dictionary with service status information
        """
        return {
            "available": _check_spotdl_available(),
            "credentials_configured": bool(
                os.environ.get("SPOTIFY_CLIENT_ID") and os.environ.get("SPOTIFY_CLIENT_SECRET")
            ),
            "ffmpeg_available": self.check_ffmpeg(),
            "output_dir": str(self.output_dir),
            "output_dir_exists": self.output_dir.exists(),
        }


# Convenience function for quick downloads
async def download_spotify_song(
    spotify_url: str,
    output_dir: Path,
    song_slug: Optional[str] = None,
    progress_callback: Optional[Callable[[dict], None]] = None,
) -> Tuple[Path, dict[str, Any]]:
    """
    Convenience function to download a Spotify song in one call.

    Args:
        spotify_url: Spotify song URL
        output_dir: Directory to save the audio file
        song_slug: Optional slug for naming the file
        progress_callback: Optional progress callback

    Returns:
        Tuple of (path to downloaded file, metadata dict)
    """
    service = SpotifyService(output_dir)
    audio_path, metadata = await service.download(spotify_url, progress_callback)

    if song_slug:
        audio_path = service.move_to_song_directory(audio_path, song_slug)

    return audio_path, metadata


# For backward compatibility and easy testing
if __name__ == "__main__":
    import json

    logging.basicConfig(level=logging.INFO)

    # Example usage
    if len(sys.argv) < 2:
        print("Usage: python spotify_service.py <spotify_url_or_search_query>")
        print("Example: python spotify_service.py 'https://open.spotify.com/track/...'")
        print("         python spotify_service.py 'Bohemian Rhapsody Queen'")
        sys.exit(1)

    query = sys.argv[1]
    output_dir = Path("input/audio")

    service = SpotifyService(output_dir)

    # Check if it's a URL or search query
    if query.startswith("http"):
        # Direct download
        print(f"Downloading: {query}")
        audio_path, metadata = asyncio.run(
            service.download(query, lambda p: print(f"Progress: {p}"))
        )
        print(f"\nDownloaded to: {audio_path}")
        print(f"Metadata: {json.dumps(metadata, indent=2)}")
    else:
        # Search first
        print(f"Searching for: {query}")
        results = service.search(query, limit=5)

        if not results:
            print("No results found.")
            sys.exit(1)

        print(f"\nFound {len(results)} results:")
        for i, result in enumerate(results, 1):
            print(f"  {i}. {result.title} by {result.artist}")
            print(f"     URL: {result.spotify_url}")

        # Download first result
        choice = input("\nEnter number to download (or 0 to cancel): ").strip()
        if choice and choice.isdigit():
            idx = int(choice)
            if 1 <= idx <= len(results):
                print(f"\nDownloading result {idx}...")
                audio_path, metadata = asyncio.run(service.download(results[idx - 1].spotify_url))
                print(f"\nDownloaded to: {audio_path}")
                print(f"Metadata: {json.dumps(metadata, indent=2)}")

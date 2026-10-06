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
import shutil
import sys
from pathlib import Path
from typing import Any, Callable, Optional, Tuple

logger = logging.getLogger(__name__)

# Optional import - spotDL may not be installed
# We check at runtime rather than import time to allow graceful degradation
SPOTDL_AVAILABLE = False
_SPOTDL_MODULES = None

def _check_spotdl_available() -> bool:
    """Check if spotDL is available at runtime."""
    global _SPOTDL_MODULES, SPOTDL_AVAILABLE
    
    if SPOTDL_AVAILABLE:
        return True
    
    if _SPOTDL_MODULES is not None:
        return SPOTDL_AVAILABLE
    
    try:
        from spotdl.download.downloader import Downloader
        from spotdl.types.song import Song
        from spotdl.utils.search import get_search_results
        
        _SPOTDL_MODULES = {
            'Downloader': Downloader,
            'Song': Song,
            'get_search_results': get_search_results,
        }
        SPOTDL_AVAILABLE = True
        logger.info("spotDL successfully loaded")
        return True
    except ImportError as e:
        logger.debug(f"spotDL import check failed: {e}")
        _SPOTDL_MODULES = False
        SPOTDL_AVAILABLE = False
        return False
    except Exception as e:
        logger.warning(f"spotDL loaded but initialization error: {e}")
        _SPOTDL_MODULES = False
        SPOTDL_AVAILABLE = False
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


def _search_spotify(query: str, limit: int = 10) -> list:
    """Search Spotify using spotDL's search functions."""
    from spotdl.utils.search import get_search_results, parse_query
    
    try:
        # Try to parse as Spotify URL first
        song = parse_query(query)
        if song:
            return [song]
    except Exception:
        pass
    
    # Otherwise do a text search
    results = get_search_results(query)
    # Apply limit manually
    return results[:limit] if results else []


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
    ):
        self.spotify_url = spotify_url
        self.title = title
        self.artist = artist
        self.album = album
        self.duration = duration
        self.spotify_id = spotify_id

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "spotify_url": self.spotify_url,
            "title": self.title,
            "artist": self.artist,
            "album": self.album,
            "duration": self.duration,
            "spotify_id": self.spotify_id,
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

            # Use spotDL's search functions
            songs = _search_spotify(query, limit)

            if not songs:
                logger.info("No results found for: %s", query)
                return []

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
            loop = asyncio.get_event_loop()
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
            "available": SPOTDL_AVAILABLE,
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

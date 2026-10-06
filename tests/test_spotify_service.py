"""
Tests for the Spotify service module.

These tests verify the Spotify download service functionality.
Some tests require spotDL to be installed and an internet connection.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add src to path
sys.path.insert(0, "/c/lyric-video-generator/src")

# Try to import the service
try:
    from src.core.spotify_service import (
        SpotifyService,
        SpotifySearchResult,
        SpotifyDownloadError,
        SpotifyServiceUnavailable,
        SPOTDL_AVAILABLE,
        download_spotify_song,
    )
    SPOTIFY_AVAILABLE = SPOTDL_AVAILABLE
except ImportError as e:
    SPOTIFY_AVAILABLE = False
    SpotifyService = None
    SpotifySearchResult = None
    SpotifyDownloadError = None
    SpotifyServiceUnavailable = None
    download_spotify_song = None


class TestSpotifySearchResult:
    """Test SpotifySearchResult dataclass."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        if not SpotifySearchResult:
            pytest.skip("spotDL not available")

        result = SpotifySearchResult(
            spotify_url="https://open.spotify.com/track/12345",
            title="Test Song",
            artist="Test Artist",
            album="Test Album",
            duration=180.5,
            spotify_id="12345",
        )

        expected = {
            "spotify_url": "https://open.spotify.com/track/12345",
            "title": "Test Song",
            "artist": "Test Artist",
            "album": "Test Album",
            "duration": 180.5,
            "spotify_id": "12345",
        }

        assert result.to_dict() == expected


class TestSpotifyServiceInitialization:
    """Test SpotifyService initialization."""

    def test_initialization_without_spotdl(self):
        """Test that initialization fails gracefully when spotDL is not installed."""
        if SpotifyService is None:
            pytest.skip("spotDL not available for testing")

        # This should raise an error if spotDL is not available
        with patch("src.core.spotify_service.SPOTDL_AVAILABLE", False):
            with pytest.raises(SpotifyServiceUnavailable):
                SpotifyService(output_dir=Path("/tmp/test"))

    def test_initialization_creates_output_dir(self):
        """Test that output directory is created if it doesn't exist."""
        if SpotifyService is None:
            pytest.skip("spotDL not available for testing")

        test_dir = Path("/tmp/test_spotify_output")
        # Clean up if exists
        if test_dir.exists():
            import shutil
            shutil.rmtree(test_dir)

        try:
            service = SpotifyService(output_dir=test_dir)
            assert test_dir.exists()
            assert test_dir.is_dir()
        finally:
            # Clean up
            if test_dir.exists():
                import shutil
                shutil.rmtree(test_dir)

    def test_ffmpeg_check(self):
        """Test ffmpeg availability check."""
        if SpotifyService is None:
            pytest.skip("spotDL not available for testing")

        service = SpotifyService(output_dir=Path("/tmp/test"))
        status = service.get_status()

        assert "ffmpeg_available" in status
        assert isinstance(status["ffmpeg_available"], bool)


class TestSpotifyServiceSearch:
    """Test Spotify search functionality."""

    def test_search_empty_query(self):
        """Test that empty query returns empty list."""
        if SpotifyService is None:
            pytest.skip("spotDL not available for testing")

        service = SpotifyService(output_dir=Path("/tmp/test"))
        results = service.search("")
        assert results == []

        results = service.search("   ")
        assert results == []

    def test_search_invalid_url_format(self):
        """Test that invalid URL format raises error."""
        if SpotifyService is None:
            pytest.skip("spotDL not available for testing")

        service = SpotifyService(output_dir=Path("/tmp/test"))

        with pytest.raises(SpotifyDownloadError):
            service.download("not-a-valid-url")

    @pytest.mark.skipif(not SPOTIFY_AVAILABLE, reason="spotDL not available")
    @pytest.mark.skipif(not sys.stdout.reconfigure, reason="Unicode not supported")
    def test_search_real_query(self):
        """Test search with a real query (requires internet)."""
        service = SpotifyService(output_dir=Path("/tmp/test"))
        results = service.search("Bohemian Rhapsody", limit=5)

        assert len(results) > 0
        assert all(isinstance(r, SpotifySearchResult) for r in results)

        # First result should be relevant
        first = results[0]
        assert "bohemian" in first.title.lower() or "queen" in first.artist.lower()


class TestSpotifyServiceDownload:
    """Test Spotify download functionality."""

    @pytest.mark.skipif(not SPOTIFY_AVAILABLE, reason="spotDL not available")
    def test_download_sync_exists(self):
        """Test that download_sync method exists."""
        if SpotifyService is None:
            pytest.skip("spotDL not available for testing")

        service = SpotifyService(output_dir=Path("/tmp/test"))

        # Check that the method exists
        assert hasattr(service, "download_sync")
        assert callable(service.download_sync)


class TestErrorHandling:
    """Test error handling."""

    def test_spotify_download_error_inheritance(self):
        """Test that SpotifyDownloadError inherits from Exception."""
        if SpotifyDownloadError is None:
            pytest.skip("spotDL not available")

        assert issubclass(SpotifyDownloadError, Exception)

    def test_spotify_service_unavailable_inheritance(self):
        """Test that SpotifyServiceUnavailable inherits from SpotifyDownloadError."""
        if SpotifyServiceUnavailable is None or SpotifyDownloadError is None:
            pytest.skip("spotDL not available")

        assert issubclass(SpotifyServiceUnavailable, SpotifyDownloadError)


class TestConvenienceFunction:
    """Test the convenience download_spotify_song function."""

    def test_convenience_function_signature(self):
        """Test that the convenience function has the right signature."""
        if download_spotify_song is None:
            pytest.skip("spotDL not available")

        import inspect
        sig = inspect.signature(download_spotify_song)

        params = list(sig.parameters.keys())
        assert "spotify_url" in params
        assert "output_dir" in params
        assert "song_slug" in params
        assert "progress_callback" in params


class TestAPIIntegration:
    """Test API integration (requires running server)."""

    @pytest.mark.asyncio
    async def test_spotify_status_endpoint(self):
        """Test the /api/spotify/status endpoint."""
        # This would require a test client setup
        pytest.skip("Requires test client setup")

    @pytest.mark.asyncio
    async def test_spotify_search_endpoint(self):
        """Test the /api/spotify/search endpoint."""
        pytest.skip("Requires test client setup")

    @pytest.mark.asyncio
    async def test_spotify_download_endpoint(self):
        """Test the /api/spotify/download endpoint."""
        pytest.skip("Requires test client setup")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

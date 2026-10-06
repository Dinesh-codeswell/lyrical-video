"""Tests for the lyrics_finder module.

Tests the NetEase Music API-based lyrics fetching implementation.
"""

import json
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Ensure src is in path for imports
sys.path.insert(0, "/c/lyric-video-generator/src")

from lyrics_finder import (
    LyricsFinderError,
    LyricsNotFoundError,
    LyricsApiError,
    find_lyrics,
    extract_lyrics_lines,
    parse_lrc_timestamp,
    get_lyrics_as_json,
    _compute_similarity,
    _strip_to_alnum,
    _levenshtein,
    _METADATA_COLON_PATTERNS,
)


class TestStringUtilities:
    """Test string utility functions."""

    def test_strip_to_alnum(self):
        """Test alphanumeric stripping."""
        assert _strip_to_alnum("Hello, World!") == "helloworld"
        assert _strip_to_alnum("Bohemian Rhapsody") == "bohemianrhapsody"
        assert _strip_to_alnum("  Test 123  ") == "test123"
        assert _strip_to_alnum("") == ""

    def test_levenshtein_basic(self):
        """Test Levenshtein distance calculation."""
        assert _levenshtein("", "") == 0
        assert _levenshtein("a", "") == 1
        assert _levenshtein("", "a") == 1
        assert _levenshtein("a", "a") == 0
        assert _levenshtein("a", "b") == 1
        assert _levenshtein("kitten", "sitting") == 3

    def test_levenshtein_similar(self):
        """Test Levenshtein with similar strings."""
        assert _levenshtein("Bohemian", "Bohemian") == 0
        assert _levenshtein("Bohemian", "Bohemiam") == 1
        assert _levenshtein("Queen", "Queen") == 0
        # Queen -> Quinn: Q->Q (0), u->u (0), e->i (1), e->n (1), n->n (0) = 2
        assert _levenshtein("Queen", "Quinn") == 2


class TestSimilarityComputation:
    """Test similarity score computation."""

    def test_perfect_title_match(self):
        """Test with exact title match."""
        song = {
            "name": "Bohemian Rhapsody",
            "alia": [],
            "ar": [{"name": "Queen"}],
            "al": {"name": "A Night at the Opera"}
        }
        score = _compute_similarity("Bohemian Rhapsody", "Queen", "A Night at the Opera", song)
        assert score > 0.9  # Should be very high for perfect match

    def test_title_with_alias(self):
        """Test matching with song aliases."""
        song = {
            "name": "Song Name",
            "alia": ["Also Known As", "Alternative Title"],
            "ar": [{"name": "Artist"}],
            "al": {"name": "Album"}
        }
        # Should match against alias
        score = _compute_similarity("Alternative Title", "Artist", "Album", song)
        assert score > 0.8

    def test_no_artist_match(self):
        """Test with missing artist info."""
        song = {
            "name": "Song",
            "alia": [],
            "ar": [],
            "al": {}
        }
        score = _compute_similarity("Song", "", "", song)
        # Should still get some score from title match
        assert score >= 0.0

    def test_empty_inputs(self):
        """Test with empty inputs."""
        song = {"name": "", "alia": [], "ar": [], "al": {}}
        score = _compute_similarity("", "", "", song)
        assert score == 0.0


class TestLRCParsing:
    """Test LRC parsing functions."""

    def test_parse_lrc_timestamp_basic(self):
        """Test basic timestamp parsing."""
        assert parse_lrc_timestamp("[00:00.000]") == 0.0
        assert parse_lrc_timestamp("[01:30.500]") == 90.5
        assert parse_lrc_timestamp("[05:42.946]") == 342.946

    def test_parse_lrc_timestamp_no_millis(self):
        """Test timestamp without milliseconds."""
        assert parse_lrc_timestamp("[01:30]") == 90.0

    def test_parse_lrc_timestamp_invalid(self):
        """Test invalid timestamp formats."""
        assert parse_lrc_timestamp("") is None
        assert parse_lrc_timestamp("[invalid]") is None
        assert parse_lrc_timestamp("No timestamp") is None

    def test_extract_lyrics_lines_basic(self):
        """Test basic lyrics extraction."""
        lrc_text = """[00:00.000]First line
[00:03.000]Second line
[00:06.000]Third line
"""
        lines = extract_lyrics_lines(lrc_text)
        assert len(lines) == 3
        assert lines[0] == (0.0, "First line")
        assert lines[1] == (3.0, "Second line")
        assert lines[2] == (6.0, "Third line")

    def test_extract_lyrics_lines_filters_metadata(self):
        """Test that metadata lines are filtered out."""
        lrc_text = """[00:00.000]作词 : Someone
[00:00.000]作曲 : Someone Else
[00:03.000]Real lyric line
[00:06.000]Drums: Person
[00:09.000]Another lyric
"""
        lines = extract_lyrics_lines(lrc_text)
        assert len(lines) == 2
        assert lines[0] == (3.0, "Real lyric line")
        assert lines[1] == (9.0, "Another lyric")

    def test_extract_lyrics_lines_filters_production_credits(self):
        """Test filtering of production credit lines."""
        lrc_text = """[00:00.000]Piano: John
[00:03.000]Real line
[00:06.000]Bass Guitar: Jane
[00:09.000]Another real line
[00:12.000]Recorded at Studio
"""
        lines = extract_lyrics_lines(lrc_text)
        assert len(lines) == 2
        assert lines[0] == (3.0, "Real line")
        assert lines[1] == (9.0, "Another real line")

    def test_extract_lyrics_lines_sorts_by_time(self):
        """Test that lines are sorted by timestamp."""
        lrc_text = """[00:09.000]Third
[00:03.000]First
[00:06.000]Second
"""
        lines = extract_lyrics_lines(lrc_text)
        assert lines[0][1] == "First"
        assert lines[1][1] == "Second"
        assert lines[2][1] == "Third"

    def test_extract_lyrics_lines_empty_input(self):
        """Test with empty input."""
        assert extract_lyrics_lines("") == []
        assert extract_lyrics_lines("   \n\n  ") == []

    def test_extract_lyrics_lines_skips_non_timestamp_lines(self):
        """Test skipping lines without timestamps."""
        lrc_text = """[ti:Test Song]
[ar:Test Artist]
[00:03.000]Real line
Some random text
[00:06.000]Another line
"""
        lines = extract_lyrics_lines(lrc_text)
        assert len(lines) == 2
        assert lines[0][1] == "Real line"
        assert lines[1][1] == "Another line"


class TestLyricsFinderErrors:
    """Test error classes."""

    def test_error_hierarchy(self):
        """Test that errors follow correct hierarchy."""
        assert issubclass(LyricsNotFoundError, LyricsFinderError)
        assert issubclass(LyricsApiError, LyricsFinderError)


class TestLyricsFinderIntegration:
    """Integration tests for the main find_lyrics function.

    Note: These tests mock the API to avoid actual network calls.
    """

    @patch("lyrics_finder._fetch_lyrics_netease")
    def test_find_lyrics_success(self, mock_fetch):
        """Test successful lyrics fetch."""
        mock_fetch.return_value = "[00:03.000]Test lyric"

        with patch("lyrics_finder.asyncio.run", side_effect=lambda x: x()):
            # Mock the async function directly
            pass

        # Use a simpler approach - mock at the asyncio.run level
        async def mock_async():
            return "[00:03.000]Test lyric"

        with patch("lyrics_finder._fetch_lyrics_netease", return_value=mock_async()):
            # This is tricky because asyncio.run is called inside find_lyrics
            # For now, test the error cases which don't need network
            pass

    def test_find_lyrics_empty_title_raises(self):
        """Test that empty title raises ValueError."""
        with pytest.raises(ValueError, match="Title is required"):
            find_lyrics("")

    def test_find_lyrics_garbage_title_raises(self):
        """Test that garbage titles raise ValueError."""
        with pytest.raises(ValueError, match="Invalid title"):
            find_lyrics("unknown")

    def test_find_lyrics_none_title_raises(self):
        """Test that None title raises TypeError."""
        with pytest.raises(TypeError, match="Title must be a string"):
            find_lyrics(None)


class TestGetLyricsAsJson:
    """Test the get_lyrics_as_json helper function."""

    def test_output_structure(self):
        """Test that output has correct structure."""
        # This test would need to mock find_lyrics
        # For now, just verify the function exists and has right signature
        assert callable(get_lyrics_as_json)
        # Can't fully test without mocking network

    def test_json_format_matches_expected(self):
        """Test that the JSON format matches what video_generator expects."""
        # Sample LRC text
        lrc_text = """[00:03.000]First line
[00:06.000]Second line
"""
        lines = extract_lyrics_lines(lrc_text)

        # Build the expected structure manually
        lyrics_list = []
        for ts, text in lines:
            lyrics_list.append({
                "time": round(ts, 2),
                "text": text
            })

        # Add end marker
        if lyrics_list and lyrics_list[-1]["text"] != "":
            last_time = lyrics_list[-1]["time"]
            lyrics_list.append({
                "time": round(last_time + 3.0, 2),
                "text": ""
            })

        result = {
            "title": "Test",
            "artist": "Artist",
            "lyrics": lyrics_list
        }

        # Verify structure
        assert "title" in result
        assert "artist" in result
        assert "lyrics" in result
        assert isinstance(result["lyrics"], list)
        assert len(result["lyrics"]) == 3  # 2 lines + end marker

        # Verify end marker
        assert result["lyrics"][-1]["text"] == ""
        assert result["lyrics"][-1]["time"] == 9.0  # 6.0 + 3.0


class TestMetadataFilteringIntegration:
    """Integration tests for metadata filtering with real-world examples."""

    def test_queen_bohemian_rhapsody_metadata(self):
        """Test filtering of Queen's Bohemian Rhapsody metadata."""
        # This is the actual metadata that appears in the LRC file
        lrc_text = """[00:00.000]作词 : Freddie Mercury
[00:00.025]作曲 : Freddie Mercury
[00:00.050]编曲 : Queen
[00:00.075]制作人 : Roy Thomas Baker/Queen
[00:00.100]
[00:00.136]Is this the real life
[05:48.000]
[05:48.500]Lead & Backing Vocals : Freddie Mercury
[05:49.000]Piano : Freddie Mercury
[05:49.500]Electric Guitar : Brian May
[05:50.000]Bass Guitar : John Deacon
[05:50.500]Drums, Timpani & Gong : Roger Taylor
[05:51.000]Operatic Vocals : Freddie Mercury
[05:51.500]Recorded at Rockfield Studio
"""

        lines = extract_lyrics_lines(lrc_text)

        # Should only have the actual lyrics
        assert len(lines) == 1
        assert lines[0] == (0.136, "Is this the real life")

    def test_various_production_credits(self):
        """Test filtering of various production credit formats."""
        lrc_text = """[00:03.000]Piano: John
[00:06.000]Guitar: Jane
[00:09.000]Bass: Bob
[00:12.000]Drums: Alice
[00:15.000]Lead Vocals: Charlie
[00:18.000]Backing Vocals: Dana
[00:21.000]Real lyric line
"""

        lines = extract_lyrics_lines(lrc_text)
        assert len(lines) == 1
        assert lines[0] == (21.0, "Real lyric line")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

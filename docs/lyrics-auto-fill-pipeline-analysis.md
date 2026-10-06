# Lyrics Auto-Fill Pipeline Analysis

## Executive Summary

This document analyzes the complete end-to-end pipeline for automatically fetching lyrics with timestamps and populating them in the editing window. The goal is to enable users to search for a song, automatically download audio + fetch timestamped lyrics, and have everything pre-populated in the dashboard without manual intervention.

---

## Current State Assessment

### What EXISTS Today

| Component | Status | Description |
|-----------|--------|-------------|
| **NetEase Lyrics API** | ✅ Working | `src/core/lyrics_finder.py` fetches LRC lyrics with timestamps from music.163.com |
| **LRC Parser** | ✅ Working | `extract_lyrics_lines()` parses [mm:ss.xx] timestamps into (time, text) tuples |
| **JSON Formatter** | ✅ Working | `get_lyrics_as_json()` converts to video generator format |
| **API Endpoint** | ✅ Working | `/api/lyrics/finder?artist=X&title=Y` returns LRC text |
| **Dashboard Loading** | ✅ Working | Loads lyrics from `input/lyrics/<slug>.json` into editing window |
| **Spotify Search** | ⚠️ Partial | spotDL integration created but requires Spotify API credentials |
| **Spotify Download** | ⚠️ Partial | Downloads audio but doesn't fetch lyrics automatically |

### What's MISSING

| Gap | Impact |
|-----|--------|
| **No unified "Search & Auto-Fill" endpoint** | User must manually call lyrics API after downloading |
| **Spotify download doesn't fetch lyrics** | Downloads audio only, lyrics must be fetched separately |
| **No auto-matching of audio to lyrics** | If user downloads from Spotify, need to extract title/artist to fetch lyrics |
| **Dashboard has no "auto-fill from Spotify" button** | UI doesn't trigger the full pipeline |
| **No filename convention linking** | Downloaded audio file name doesn't automatically link to lyrics file |

---

## Complete End-to-End Pipeline Analysis

### Ideal User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER FLOWS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPTION A: Search by Song Name (Current lyrics_finder approach)            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. User enters "Bohemian Rhapsody Queen" in search box                    │
│  2. Backend searches NetEase Music API                                      │
│  3. Backend fetches LRC lyrics with timestamps                              │
│  4. Backend converts to JSON format                                         │
│  5. Dashboard auto-fills lyrics in editing window                           │
│  6. User still needs to provide audio file separately                       │
│                                                                             │
│  OPTION B: Spotify URL → Download + Auto-Fill Lyrics                       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. User pastes Spotify track URL                                           │
│  2. Backend downloads audio via spotDL                                      │
│  3. Backend extracts metadata (title, artist) from Spotify                 │
│  4. Backend uses metadata to fetch lyrics via NetEase                      │
│  5. Backend saves BOTH audio and lyrics files                              │
│  6. Dashboard auto-refreshes and loads song with lyrics                    │
│  7. Editing window shows timestamped lyrics ready to use                   │
│                                                                             │
│  OPTION C: Manual Upload (Current workflow)                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│  1. User uploads audio file                                                │
│  2. User uploads lyrics file (JSON/LRC/SRT)                               │
│  3. Dashboard loads both                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Current Data Flow for Lyrics

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ NetEase Music   │────▶│ lyrics_finder.py │────▶│ LRC Text String │
│ API             │     │ find_lyrics()    │     │ ([mm:ss.xx]text)│
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Dashboard       │◀────│ API Endpoint     │◀────│ extract_lyrics   │
│ loads from      │     │ /api/lyrics/     │     │ _lines()         │
│ input/lyrics/   │     │ finder           │     │ (time, text)     │
│ <slug>.json     │     └──────────────────┘     └────────┬────────┘
└─────────────────┘                                       │
                                                          ▼
                                                ┌─────────────────┐
                                                │ get_lyrics_as   │
                                                │ _json()         │
                                                │ → {title,       │
                                                │   artist,       │
                                                │   lyrics:[]}    │
                                                └─────────────────┘
```

---

## Gap Analysis: What Needs to Be Built

### Gap 1: Unified "Search Lyrics by Song Name" Endpoint

**Current**: `/api/lyrics/finder?artist=X&title=Y` returns raw LRC text

**Needed**: Endpoint that searches by song name, returns structured JSON with timestamps

```python
# Proposed new endpoint
@app.post("/api/lyrics/search")
async def search_lyrics_and_return_json(request: Request):
    """
    Search for a song and return lyrics with timestamps in dashboard-ready format.
    
    Body: { "query": "Bohemian Rhapsody Queen" } or { "title": "...", "artist": "..." }
    
    Returns: {
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "lyrics": [
            { "time": 0.14, "text": "Is this the real life" },
            { "time": 3.87, "text": "Is this just fantasy" },
            ...
            { "time": 342.95, "text": "" }  # End marker
        ]
    }
    """
```

### Gap 2: Spotify Download + Auto-Fetch Lyrics Pipeline

**Current**: Spotify download saves audio only

**Needed**: After download, automatically:
1. Extract metadata (title, artist) from downloaded song
2. Use metadata to fetch lyrics via NetEase API
3. Save lyrics as `<slug>.json` in `input/lyrics/`
4. Return both audio path and lyrics path

```python
# Modified spotify_download endpoint
@app.post("/api/spotify/download-with-lyrics")
async def spotify_download_with_lyrics(request: Request, background_tasks: BackgroundTasks):
    """
    Download song from Spotify AND auto-fetch lyrics with timestamps.
    
    Body: { "url": "https://open.spotify.com/track/...", "slug": "song-name" }
    
    Returns: {
        "job_id": "...",
        "status": "started"
    }
    
    On completion, jobs[job_id] contains:
    {
        "status": "completed",
        "audio_path": "input/audio/song-name.mp3",
        "lyrics_path": "input/lyrics/song-name.json",
        "metadata": {
            "title": "...",
            "artist": "...",
            "lyrics": [...]  # Timestamped lyrics
        }
    }
    """
```

### Gap 3: Dashboard "Auto-Fill Lyrics" Button

**Current**: Dashboard loads lyrics from file if exists

**Needed**: Add UI button that:
1. Searches for lyrics by current song's title/artist
2. On success, saves to `input/lyrics/<slug>.json`
3. Reloads the song to display lyrics in editing window

```tsx
// In Dashboard.tsx or StudioDrawer.tsx
const handleAutoFillLyrics = async () => {
  if (!songMetadata.title) return;
  
  try {
    // Search and fetch lyrics
    const resp = await fetch('/api/lyrics/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: songMetadata.title,
        artist: songMetadata.artist
      })
    });
    
    const data = await resp.json();
    
    if (data.lyrics && data.lyrics.length > 0) {
      // Save to file
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      formData.append('lyrics', blob, `${selectedSong}.json`);
      formData.append('slug', selectedSong);
      
      await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      // Reload song to display new lyrics
      await loadSong(selectedSong);
      showToast('Lyrics auto-filled with timestamps!');
    } else {
      showToast('No lyrics found', 'error');
    }
  } catch (e) {
    console.error('Auto-fill failed:', e);
    showToast('Failed to fetch lyrics', 'error');
  }
};
```

### Gap 4: Smart Filename Convention

**Current**: Files are saved as `<slug>.mp3` and `<slug>.json`

**Needed**: Ensure consistency so that when audio is downloaded, lyrics can be linked:

```python
# In spotify_service.py - after download
def save_lyrics_for_song(self, slug: str, lyrics_data: dict):
    """Save lyrics in the standard location that Dashboard expects."""
    lyrics_path = INPUT_LYRICS_DIR / f"{slug}.json"
    with open(lyrics_path, 'w', encoding='utf-8') as f:
        json.dump(lyrics_data, f, indent=2, ensure_ascii=False)
    return lyrics_path
```

---

## Phase-Wise Implementation Plan

### Phase 1: Lyrics Search API Enhancement (1-2 days)

**Goal**: Add endpoint that returns dashboard-ready JSON with timestamps

#### Files to Modify/Create

1. **`src/api/main.py`** - Add new endpoint
2. **`src/core/lyrics_finder.py`** - Already has `get_lyrics_as_json()`, just need to expose via API

#### Implementation

```python
# Add to src/api/main.py

@app.post("/api/lyrics/search")
async def search_lyrics(request: Request):
    """
    Search for lyrics by song title/artist and return timestamped JSON.
    
    This is the key endpoint that enables auto-fill in the dashboard.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    title = body.get("title", "").strip()
    artist = body.get("artist", "").strip()
    query = body.get("query", "").strip()
    
    # Support both query-style and title/artist-style requests
    if query:
        # Parse query to extract title/artist if possible
        # For now, require explicit title/artist
        pass
    
    if not title:
        raise HTTPException(status_code=400, detail="Title is required")
    
    try:
        # Use existing get_lyrics_as_json which handles:
        # 1. Searching NetEase Music API
        # 2. Fetching LRC with timestamps
        # 3. Parsing timestamps
        # 4. Converting to dashboard format
        lyrics_data = get_lyrics_as_json(title, artist)
        
        return {
            "success": True,
            "title": lyrics_data["title"],
            "artist": lyrics_data["artist"],
            "lyrics": lyrics_data["lyrics"],
            "lyrics_count": len([l for l in lyrics_data["lyrics"] if l["text"]])
        }
    except LyricsNotFoundError:
        raise HTTPException(status_code=404, detail="No lyrics found for this song")
    except LyricsApiError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        print(f"[lyrics/search] error: {e}")
        raise HTTPException(status_code=500, detail=f"Lyrics search failed: {str(e)}")
```

#### Testing

```python
# Test the new endpoint
def test_lyrics_search_endpoint(client):
    response = client.post('/api/lyrics/search', json={
        'title': 'Bohemian Rhapsody',
        'artist': 'Queen'
    })
    assert response.status_code == 200
    data = response.json()
    assert 'lyrics' in data
    assert len(data['lyrics']) > 0
    assert all('time' in l and 'text' in l for l in data['lyrics'])
```

---

### Phase 2: Spotify Download with Auto-Lyrics (2-3 days)

**Goal**: After downloading from Spotify, automatically fetch and save lyrics

#### Files to Modify

1. **`src/core/spotify_service.py`** - Add lyrics fetching after download
2. **`src/api/main.py`** - Add `/api/spotify/download-with-lyrics` endpoint

#### Implementation

```python
# In src/core/spotify_service.py

class SpotifyService:
    # ... existing methods ...
    
    async def download_with_lyrics(
        self,
        spotify_url: str,
        song_slug: str,
        progress_callback: Optional[Callable[[dict], None]] = None,
    ) -> Tuple[Path, Path, dict]:
        """
        Download song from Spotify AND fetch lyrics with timestamps.
        
        Returns: (audio_path, lyrics_path, metadata_with_lyrics)
        """
        # Step 1: Download audio
        if progress_callback:
            progress_callback({"status": "downloading_audio", "progress": 0.1})
        
        audio_path, metadata = await self.download(spotify_url, progress_callback)
        
        # Step 2: Extract title/artist from metadata
        title = metadata.get("title", song_slug)
        artist = metadata.get("artist", "")
        
        if progress_callback:
            progress_callback({"status": "fetching_lyrics", "progress": 0.7})
        
        # Step 3: Fetch lyrics using our NetEase integration
        try:
            from src.core.lyrics_finder import get_lyrics_as_json
            
            lyrics_data = get_lyrics_as_json(title, artist)
            
            # Step 4: Save lyrics to standard location
            lyrics_path = self.save_lyrics(song_slug, lyrics_data)
            
            # Add lyrics to metadata for return
            metadata["lyrics"] = lyrics_data["lyrics"]
            metadata["lyrics_path"] = str(lyrics_path)
            
            if progress_callback:
                progress_callback({"status": "complete", "progress": 1.0})
            
            return audio_path, lyrics_path, metadata
            
        except Exception as e:
            logger.warning(f"Could not fetch lyrics: {e}")
            # Still return audio, just without lyrics
            return audio_path, None, metadata
    
    def save_lyrics(self, slug: str, lyrics_data: dict) -> Path:
        """Save lyrics to input/lyrics/<slug>.json"""
        from src.core.song_resolver import INPUT_LYRICS_DIR
        
        lyrics_path = INPUT_LYRICS_DIR / f"{slug}.json"
        with open(lyrics_path, 'w', encoding='utf-8') as f:
            json.dump(lyrics_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved lyrics to {lyrics_path}")
        return lyrics_path
```

#### API Endpoint

```python
# In src/api/main.py

@app.post("/api/spotify/download-with-lyrics")
async def spotify_download_with_lyrics(request: Request, background_tasks: BackgroundTasks):
    """
    Download song from Spotify AND automatically fetch timestamped lyrics.
    
    This is the "magic" endpoint that does everything in one call.
    """
    if not SPOTIFY_AVAILABLE:
        raise HTTPException(status_code=503, detail="Spotify service not available")
    
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    spotify_url = body.get("url", "").strip()
    song_slug = body.get("slug", "").strip()
    
    if not spotify_url:
        raise HTTPException(status_code=400, detail="Spotify URL is required")
    if not song_slug:
        raise HTTPException(status_code=400, detail="Song slug is required")
    
    try:
        service = SpotifyService(INPUT_AUDIO_DIR)
        
        job_id = str(uuid.uuid4())
        jobs[job_id] = {
            "status": "downloading",
            "progress": 0,
            "type": "spotify_download_with_lyrics",
            "slug": song_slug,
        }
        
        async def download_task():
            try:
                audio_path, lyrics_path, metadata = await service.download_with_lyrics(
                    spotify_url,
                    song_slug,
                    progress_callback=lambda p: jobs[job_id].update(p)
                )
                
                jobs[job_id].update({
                    "status": "completed",
                    "progress": 100,
                    "audio_path": str(audio_path),
                    "lyrics_path": str(lyrics_path) if lyrics_path else None,
                    "metadata": metadata,
                })
            except Exception as e:
                jobs[job_id].update({
                    "status": "failed",
                    "error": str(e),
                })
        
        background_tasks.add_task(download_task)
        return {"job_id": job_id, "status": "started"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
```

---

### Phase 3: Dashboard Integration (2-3 days)

**Goal**: Add UI controls for auto-filling lyrics

#### Files to Modify

1. **`web/src/pages/Dashboard.tsx`** - Add auto-fill button and logic
2. **`web/src/components/dashboard/StudioDrawer.tsx`** - Add lyrics tab controls

#### Implementation

```tsx
// In Dashboard.tsx - add state and handler

const [lyricsStatus, setLyricsStatus] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');

const handleAutoFillLyrics = async () => {
  if (!selectedSong || !songMetadata.title) {
    showToast('No song selected or missing metadata', 'error');
    return;
  }
  
  setLyricsStatus('searching');
  
  try {
    // Step 1: Search for lyrics
    const searchResp = await fetch('/api/lyrics/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: songMetadata.title,
        artist: songMetadata.artist
      })
    });
    
    if (!searchResp.ok) {
      const err = await searchResp.json();
      throw new Error(err.detail || 'Lyrics search failed');
    }
    
    const lyricsData = await searchResp.json();
    
    if (!lyricsData.lyrics || lyricsData.lyrics.length === 0) {
      throw new Error('No lyrics found');
    }
    
    // Step 2: Save lyrics to file
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(lyricsData, null, 2)], { 
      type: 'application/json' 
    });
    formData.append('lyrics', blob, `${selectedSong}.json`);
    formData.append('slug', selectedSong);
    
    const uploadResp = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResp.ok) {
      throw new Error('Failed to save lyrics');
    }
    
    // Step 3: Reload song to display lyrics
    await handleSongSelect(selectedSong);
    
    setLyricsStatus('found');
    showToast(`Lyrics loaded: ${lyricsData.lyrics_count} timestamped lines`);
    
  } catch (e) {
    console.error('Auto-fill lyrics failed:', e);
    setLyricsStatus('error');
    showToast(`Failed: ${e.message}`, 'error');
  } finally {
    setLyricsStatus('idle');
  }
};

// In the render method - add button
<button
  type="button"
  className="btn-auto-fill-lyrics"
  onClick={handleAutoFillLyrics}
  disabled={lyricsStatus !== 'idle' || !songMetadata.title}
  title="Search and auto-fill lyrics with timestamps"
>
  {lyricsStatus === 'searching' ? 'Searching...' : 
   lyricsStatus === 'found' ? '✓ Lyrics Loaded' : 
   'Auto-Fill Lyrics'}
</button>
```

---

### Phase 4: Polish & Edge Cases (1-2 days)

**Goal**: Handle edge cases and improve user experience

#### Items to Address

1. **Filename conflicts**: Handle case where `<slug>.json` already exists
2. **Partial lyrics**: Some songs have incomplete timestamps
3. **Language detection**: Show warning if lyrics are in different language
4. **Retry logic**: If NetEase fails, try alternative approach
5. **Progress updates**: Show detailed progress during download+lyrics fetch
6. **Error messages**: Clear messages for different failure modes

#### Implementation

```python
# In spotify_service.py - enhanced error handling

async def download_with_lyrics(self, ...):
    try:
        # ... download audio ...
    except Exception as e:
        logger.error(f"Audio download failed: {e}")
        raise SpotifyDownloadError(f"Audio download failed: {e}")
    
    try:
        # ... fetch lyrics ...
    except LyricsNotFoundError:
        logger.warning(f"No lyrics found for {title} - audio downloaded without lyrics")
        # Don't fail the whole operation
        metadata["lyrics_warning"] = "No lyrics found - you can add them manually"
    except Exception as e:
        logger.warning(f"Lyrics fetch failed: {e}")
        metadata["lyrics_warning"] = f"Lyrics fetch failed: {str(e)}"
```

---

## Testing Strategy

### Unit Tests

```python
# tests/test_lyrics_pipeline.py

def test_get_lyrics_as_json_structure():
    """Test that get_lyrics_as_json returns correct structure."""
    from src.core.lyrics_finder import get_lyrics_as_json
    
    # Mock the API call
    with patch('src.core.lyrics_finder.find_lyrics') as mock_find:
        mock_find.return_value = "[00:03.000]Test lyric line"
        
        result = get_lyrics_as_json("Test Song", "Test Artist")
        
        assert "title" in result
        assert "artist" in result
        assert "lyrics" in result
        assert isinstance(result["lyrics"], list)
        assert len(result["lyrics"]) >= 2  # At least one line + end marker
        
        # Check structure of lyrics entries
        for entry in result["lyrics"]:
            assert "time" in entry
            assert "text" in entry
            assert isinstance(entry["time"], (int, float))
            assert isinstance(entry["text"], str)
        
        # Last entry should be end marker
        assert result["lyrics"][-1]["text"] == ""

def test_lyrics_search_endpoint_structure(client):
    """Test that /api/lyrics/search returns dashboard-ready structure."""
    with patch('src.api.main.get_lyrics_as_json') as mock_get:
        mock_get.return_value = {
            "title": "Test",
            "artist": "Artist",
            "lyrics": [
                {"time": 0.0, "text": "Line 1"},
                {"time": 3.0, "text": "Line 2"},
                {"time": 6.0, "text": ""}
            ]
        }
        
        response = client.post('/api/lyrics/search', json={
            "title": "Test",
            "artist": "Artist"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["lyrics_count"] == 2  # Excludes end marker
```

### Integration Tests

```python
# tests/test_spotify_lyrics_pipeline.py

@pytest.mark.skipif(not SPOTIFY_AVAILABLE, reason="spotDL not available")
def test_spotify_download_fetches_lyrics():
    """Test that Spotify download also fetches lyrics."""
    from src.core.spotify_service import SpotifyService
    from pathlib import Path
    import tempfile
    
    with tempfile.TemporaryDirectory() as tmpdir:
        service = SpotifyService(output_dir=Path(tmpdir))
        
        # This would need a real Spotify URL or mock
        # audio_path, lyrics_path, metadata = await service.download_with_lyrics(
        #     "https://open.spotify.com/track/...",
        #     "test-song"
        # )
        # 
        # assert audio_path.exists()
        # assert lyrics_path.exists()
        # assert "lyrics" in metadata
```

---

## Summary: Complete Pipeline After Implementation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           COMPLETE AUTO-FILL PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  USER ACTION: Paste Spotify URL or enter song name                              │
│       │                                                                         │
│       ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 1: Search & Download (Backend)                                    │   │
│  │  - SpotDL searches Spotify, finds YouTube match                         │   │
│  │  - Downloads audio to input/audio/<slug>.mp3                           │   │
│  │  - Extracts metadata: title, artist, album, duration                   │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                       │
│                                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 2: Auto-Fetch Lyrics (Backend)                                    │   │
│  │  - Uses title+artist from Step 1                                        │   │
│  │  - Searches NetEase Music API via lyrics_finder.py                      │   │
│  │  - Fetches LRC with [mm:ss.xx] timestamps                               │   │
│  │  - Parses with extract_lyrics_lines()                                   │   │
│  │  - Converts with get_lyrics_as_json()                                   │   │
│  │  - Saves to input/lyrics/<slug>.json                                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                       │
│                                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  STEP 3: Dashboard Refresh (Frontend)                                   │   │
│  │  - Polls job status or receives webhook                                 │   │
│  │  - Calls handleSongSelect(slug)                                         │   │
│  │  - Loads audio from input/audio/<slug>.mp3                             │   │
│  │  - Loads lyrics from input/lyrics/<slug>.json                          │   │
│  │  - Parses JSON into LyricClip[] with start_time/end_time               │   │
│  │  - Displays in editing window with timestamps                           │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                       │
│                                          ▼                                       │
│  USER SEE: Editing window populated with timestamped lyrics ✓                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommendations

### Immediate Actions (This Week)

1. **Add `/api/lyrics/search` endpoint** - This is the key missing piece
   - Uses existing `get_lyrics_as_json()` function
   - Returns dashboard-ready JSON with timestamps
   - Enables manual auto-fill from dashboard

2. **Add "Auto-Fill Lyrics" button to Dashboard**
   - Simple UI that calls the new endpoint
   - Saves results and reloads song

### Short-Term (Next Week)

3. **Enhance Spotify download to fetch lyrics**
   - Modify `spotify_service.py` to call lyrics API after download
   - Save lyrics alongside audio

4. **Add `download-with-lyrics` endpoint**
   - One-call solution for Spotify URL → audio + lyrics

### Medium-Term (Next Sprint)

5. **Handle edge cases**
   - Missing lyrics, partial timestamps, language warnings
   - Retry logic and better error messages

6. **Add progress UI**
   - Show detailed progress during download+lyrics fetch
   - Indicate when lyrics are being searched/fetched

---

## Files Modified/Created Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/api/main.py` | MODIFY | Add `/api/lyrics/search` and `/api/spotify/download-with-lyrics` endpoints |
| `src/core/spotify_service.py` | MODIFY | Add `download_with_lyrics()` and `save_lyrics()` methods |
| `web/src/pages/Dashboard.tsx` | MODIFY | Add auto-fill button and handler |
| `tests/test_lyrics_pipeline.py` | CREATE | Tests for lyrics search endpoint |
| `tests/test_spotify_lyrics.py` | CREATE | Tests for Spotify+lyrics integration |
| `docs/lyrics-auto-fill-pipeline-analysis.md` | CREATE | This document |

---

## Conclusion

**The core algorithm EXISTS** - `lyrics_finder.py` can fetch timestamped lyrics and convert them to the right format. What's missing is:

1. A unified API endpoint that the dashboard can call
2. Integration with the Spotify download flow
3. UI controls to trigger the auto-fill

The implementation is straightforward because we're mostly wiring existing components together rather than building new algorithms. The key insight is that `get_lyrics_as_json()` already does exactly what we need - it just needs to be exposed via an API endpoint and integrated into the download flow.

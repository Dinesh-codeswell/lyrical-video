# Spotify Downloader Integration Analysis

## Executive Summary

This document analyzes the integration of **spotDL v4.5.2** (spotify-downloader) into the Lyric Video Generator project to enable Spotify song downloads directly from the dashboard. The integration would significantly improve user experience by allowing users to search and download Spotify tracks, automatically saving them to the input/audio directory for immediate video generation.

---

## 1. spotDL Project Analysis

### 1.1 Overview

**spotDL** is a mature, open-source (MIT licensed) Spotify music downloader with:
- **Version**: 4.5.2
- **Python Requirement**: 3.10-3.14
- **Key Features**:
  - Download songs from Spotify playlists via YouTube
  - Fetch album art and embed metadata (ID3 tags)
  - Generate synchronized lyrics (.lrc files)
  - Support for multiple audio providers (YouTube, YouTube Music, SoundCloud, BandCamp, Piped)
  - Support for multiple lyrics providers (Genius, Musixmatch, AZLyrics, Synced)
  - Web interface option
  - Playlist synchronization

### 1.2 Architecture

```
spotdl/
├── console/           # CLI commands (download, save, sync, web, url, meta)
├── download/          # Core downloader logic
│   └── downloader.py  # Main Downloader class (~850 lines)
├── providers/
│   ├── audio/         # Audio sources (YouTube, YT Music, SoundCloud, etc.)
│   └── lyrics/        # Lyrics providers (Genius, Musixmatch, AZLyrics, Synced)
├── types/             # Data models (Song, Album, Playlist, Options)
├── utils/             # Utilities (ffmpeg, matching, metadata, lrc generation)
└── __init__.py        # Package entry point
```

### 1.3 Key Components

| Component | Purpose | Relevance to Integration |
|-----------|---------|--------------------------|
| `Downloader` class | Core download orchestration | **Primary integration point** |
| `AudioProvider` | Search & download from YouTube | Used for finding audio |
| `LyricsProvider` | Fetch lyrics from various sources | Can supplement our NetEase lyrics |
| ` Song` type | Song metadata model | Could map to our data structures |
| `generate_lrc` | Create synchronized lyrics | **High value** - auto-generates timed lyrics |

### 1.4 Dependencies

spotDL requires:
- `spotipy` / `spotipyFree` - Spotify API client
- `ytmusicapi` - YouTube Music API
- `yt-dlp` - YouTube download engine
- `mutagen` - Metadata editing
- `fastapi` + `uvicorn` - Web interface
- `ffmpeg` - Audio processing (already required by our project)

**Additional dependencies to install**: ~15 packages

### 1.5 Critical Limitation: Spotify Client Initialization

**IMPORTANT**: spotDL v4 requires Spotify API credentials to be initialized before use:

```python
from spotdl.utils.spotify import SpotifyClient
SpotifyClient.init(
    client_id="your_client_id",
    client_secret="your_client_secret",
    user_auth=False,
    headless=True
)
```

This means:
1. **A Spotify Developer Account is required** to get client_id and client_secret
2. **Authentication is mandatory** even for search operations
3. **This is a significant barrier** for casual users

**Workaround options**:
- Option A: Require users to provide their own Spotify credentials
- Option B: Use a pre-configured service account (not recommended for production)
- Option C: Consider alternative approaches that don't require Spotify API

---

## 2. Current Project Architecture

### 2.1 How Audio Currently Works

```
┌─────────────────────────────────────────────────────────────┐
│                     CURRENT FLOW                              │
├─────────────────────────────────────────────────────────────┤
│  User                                      ┌──────────────┐ │
│  selects song ────────────────────────────►│ song_resolver│ │
│                                             │              │ │
│                                             │  Looks in    │ │
│                                             │  input/audio/│ │
│                                             │  for .mp3    │ │
│                                             └──────┬───────┘ │
│                                                    │          │
│                                                    ▼          │
│                                             ┌──────────────┐ │
│  User must manually ───────────────────────►│ video_gen    │ │
│  download & place                       │  erate()     │ │
│  audio file there                           │              │ │
└─────────────────────────────────────────────────────────────┘
```

**Problem**: Users must manually:
1. Find the song on Spotify/YouTube
2. Download the audio file
3. Place it in `input/audio/<song_name>.mp3`
4. Create matching lyrics file

### 2.2 Dashboard Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DASHBOARD (React/TypeScript)            │
├─────────────────────────────────────────────────────────────┤
│  Dashboard.tsx                                              │
│  ├── Song Selector (left panel)                             │
│  ├── Preview Stage (center)                                │
│  ├── Timeline Editor (bottom)                              │
│  └── Studio Drawer (tabs: Media, Theme, Lyrics, etc.)     │
│                                                             │
│  Communicates with:                                         │
│  └── Flask API (src/api/main.py)                           │
│      ├── /api/songs - List available songs                  │
│      ├── /api/songs/<slug> - Get file paths                 │
│      ├── /api/upload - Upload files                         │
│      └── /api/generate - Trigger video generation           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Integration Scope

### 3.1 What Would Be Added

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Spotify Search** | Search Spotify tracks from dashboard | Medium |
| **Download Button** | Download selected track to input/audio | Medium |
| **Auto-Lyrics Fetch** | Optionally fetch lyrics during download | Medium |
| **Metadata Extraction** | Extract title/artist from Spotify | Low |
| **Progress UI** | Show download progress in dashboard | Low |
| **Background Processing** | Run download in background thread/task | Medium |

### 3.2 What Would NOT Be Added

| Feature | Reason |
|---------|--------|
| Full spotDL CLI | Too complex, overkill |
| Web interface | Already have our own dashboard |
| Playlist sync | Not needed for single-song workflow |
| Multi-provider audio search | YouTube-only is sufficient |
| SponsorBlock integration | Not relevant for lyric videos |

### 3.3 Recommended Integration Approach

**Use spotDL as a library, not a CLI tool**. Specifically:

1. **Import `spotdl.download.Downloader`** directly in our API
2. **Use `spotdl.types.Song`** for metadata
3. **Optionally use `spotdl.providers.lyrics`** for supplementary lyrics
4. **Skip the CLI console module entirely**

This gives us:
- Clean Python API
- No CLI overhead
- Full control over workflow
- Easy to embed in our existing API

---

## 4. Legal & Ethical Considerations

### 4.1 Spotify Terms of Service

spotDL's README includes this disclaimer:
> "Users are responsible for their actions and potential legal consequences. We do not support unauthorized downloading of copyrighted material and take no responsibility for user actions."

**Implications**:
- Spotify's ToS technically prohibits downloading without permission
- spotDL uses YouTube as the audio source (not Spotify's servers)
- This is a gray area - similar to many YouTube downloaders

### 4.2 Our Project's Position

For a production tool, we should:
1. **Include a disclaimer** in the UI about responsible use
2. **Not promote copyright infringement**
3. **Make it clear this is for personal/educational use**
4. **Consider requiring Spotify authentication** (adds legitimacy)

### 4.3 Recommendation

**Phase the rollout**:
- **Phase 1**: Internal testing, document limitations
- **Phase 2**: Add with clear user agreement/disclaimer
- **Phase 3**: Consider Spotify API authentication for production

---

## 5. Technical Implementation Plan

### Phase 1: Core Integration (Backend)

**Goal**: Enable downloading a Spotify track via API endpoint

#### 1.1 Install Dependencies

```bash
# In addition to existing dependencies
uv pip install spotdl
# Or add to pyproject.toml/requirements.txt
```

#### 1.2 Create Spotify Service Module

Create `src/core/spotify_service.py`:

```python
"""
Spotify song download service using spotDL library.
Provides search and download capabilities for the lyric video generator.
"""

import asyncio
import shutil
from pathlib import Path
from typing import Optional, Tuple

from spotdl.download.downloader import Downloader
from spotdl.types.song import Song
from spotdl.utils.search import Search


class SpotifyDownloadError(Exception):
    """Raised when Spotify download fails."""
    pass


class SpotifyService:
    """
    Service for searching and downloading songs from Spotify via YouTube.
    """

    def __init__(self, output_dir: Path):
        """
        Initialize the Spotify service.

        Args:
            output_dir: Directory to save downloaded audio files
        """
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Initialize downloader with minimal settings
        self.downloader = Downloader(
            settings={
                "audio_providers": ["youtube"],
                "lyrics_providers": [],  # We use our own lyrics fetcher
                "format": "mp3",
                "output": str(output_dir / "%(title)s.%(ext)s"),
                "overwrite": "skip",
                "threads": 1,
                "scan_for_songs": False,
                "print_errors": False,
                "simple_tui": True,
            }
        )

    def search_spotify(self, query: str) -> list[dict]:
        """
        Search for songs on Spotify.

        Args:
            query: Search query (song name, artist, or Spotify URL)

        Returns:
            List of matching songs with metadata
        """
        try:
            # Use spotDL's search functionality
            songs = Search().search(query)
            return [
                {
                    "spotify_url": song.url,
                    "title": song.name,
                    "artist": song.artists[0] if song.artists else song.artist,
                    "album": song.album,
                    "duration": song.duration,
                    "spotify_id": song.song_id,
                }
                for song in songs[:10]  # Limit to 10 results
            ]
        except Exception as e:
            raise SpotifyDownloadError(f"Search failed: {e}")

    async def download_song(
        self,
        song_url: str,
        progress_callback: callable = None,
    ) -> Tuple[Path, dict]:
        """
        Download a song from Spotify URL.

        Args:
            song_url: Spotify song URL
            progress_callback: Optional callback for progress updates

        Returns:
            Tuple of (download path, metadata dict)
        """
        try:
            # Create song object from URL
            song = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: Search(). Song.from_url(song_url)
            )

            # Download the song
            result = self.downloader.download_song(song)

            if result[1] is None:
                raise SpotifyDownloadError("Download failed - no file returned")

            # Get metadata
            metadata = {
                "title": song.name,
                "artist": song.artists[0] if song.artists else song.artist,
                "album": song.album,
                "duration": song.duration,
                "spotify_url": song.url,
            }

            return result[1], metadata

        except Exception as e:
            raise SpotifyDownloadError(f"Download failed: {e}")

    def download_song_sync(
        self,
        song_url: str,
    ) -> Tuple[Path, dict]:
        """
        Synchronous download (for use in threads/non-async contexts).
        """
        return self.downloader.download_song(
            Song.from_url(song_url)
        )
```

#### 1.3 Add API Endpoint

Add to `src/api/main.py`:

```python
@app.route('/api/spotify/search', methods=['POST'])
def spotify_search():
    """Search Spotify for songs."""
    data = request.get_json()
    query = data.get('query', '')

    if not query:
        return jsonify({'error': 'Query required'}), 400

    try:
        service = SpotifyService(Path(app.config['INPUT_AUDIO_DIR']))
        results = service.search_spotify(query)
        return jsonify({'results': results})
    except SpotifyDownloadError as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/spotify/download', methods=['POST'])
def spotify_download():
    """Download a Spotify song."""
    data = request.get_json()
    song_url = data.get('url')
    song_slug = data.get('slug')  # For naming the file

    if not song_url:
        return jsonify({'error': 'Spotify URL required'}), 400

    try:
        service = SpotifyService(Path(app.config['INPUT_AUDIO_DIR']))

        # Run in thread to avoid blocking
        result = asyncio.run(
            service.download_song(song_url)
        )

        # Rename to match our naming convention
        audio_path = result[0]
        metadata = result[1]

        # Move to proper location: input/audio/<slug>.mp3
        if song_slug:
            target_path = Path(app.config['INPUT_AUDIO_DIR']) / f"{song_slug}.mp3"
            shutil.move(str(audio_path), str(target_path))
            audio_path = target_path

        return jsonify({
            'success': True,
            'path': str(audio_path),
            'metadata': metadata
        })
    except SpotifyDownloadError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500
```

---

### Phase 2: Frontend Integration (Dashboard)

**Goal**: Add Spotify search and download UI to the dashboard

#### 2.1 Add Spotify Tab to Studio Drawer

Modify `StudioDrawer.tsx` to include a "Spotify" tab:

```tsx
// In StudioDrawer.tsx
type StudioTab = 'media' | 'theme' | 'lyrics' | 'spotify' | 'transitions';

// Add Spotify search component
const SpotifySearch: React.FC<{
  onSongSelect: (song: SpotifyResult) => void;
  onDownload: (url: string, slug: string) => Promise<void>;
}> = ({ onSongSelect, onDownload }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await resp.json();
      setResults(data.results || []);
    } catch (e) {
      console.error('Search failed:', e);
    }
    setLoading(false);
  };

  const handleDownload = async (song: SpotifyResult) => {
    if (!selectedSong) return;
    setDownloading(true);
    try {
      await onDownload(song.spotify_url, selectedSong);
      showToast(`Downloaded "${song.title}" by ${song.artist}`);
      // Refresh song paths
      const resp = await fetch(`/api/songs/${selectedSong}`);
      const paths = await resp.json();
      onSongPathsChange(paths);
    } catch (e) {
      console.error('Download failed:', e);
      showToast('Download failed', 'error');
    }
    setDownloading(false);
  };

  return (
    <div className="spotify-tab">
      <input
        type="text"
        placeholder="Search Spotify (e.g., 'Bohemian Rhapsody Queen')"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && search()}
      />
      <button onClick={search} disabled={loading}>
        {loading ? 'Searching...' : 'Search'}
      </button>

      {results.length > 0 && (
        <div className="spotify-results">
          {results.map(song => (
            <div key={song.spotify_id} className="spotify-result">
              <div className="spotify-result-info">
                <span className="spotify-result-title">{song.title}</span>
                <span className="spotify-result-artist">{song.artist}</span>
              </div>
              <button
                onClick={() => handleDownload(song)}
                disabled={downloading}
              >
                {downloading ? 'Downloading...' : 'Download'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

#### 2.2 Add Spotify Result Type

```typescript
// In web/src/types/index.ts
export interface SpotifyResult {
  spotify_url: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  spotify_id: string;
}
```

---

### Phase 3: Optional Lyrics Integration

**Goal**: Optionally fetch lyrics during Spotify download

spotDL can fetch lyrics from Genius, Musixmatch, etc. We could:
1. Enable lyrics fetching during download
2. Save lyrics as `.lrc` file alongside audio
3. Convert `.lrc` to our JSON format using existing parser

```python
# In spotify_service.py - optional lyrics feature
def download_with_lyrics(
    self,
    song_url: str,
    fetch_lyrics: bool = True,
) -> Tuple[Path, Optional[Path], dict]:
    """
    Download song with optional lyrics.

    Returns: (audio_path, lyrics_path_or_None, metadata)
    """
    settings = {
        "audio_providers": ["youtube"],
        "lyrics_providers": ["genius", "musixmatch"] if fetch_lyrics else [],
        # ... other settings
    }

    # spotDL generates .lrc file if generate_lrc=True
    # We can then parse it with our lyrics_parser
```

---

### Phase 4: Production Hardening

**Goal**: Make the feature production-ready

1. **Error handling**:
   - Handle network timeouts gracefully
   - Show clear error messages
   - Retry logic for failed downloads

2. **Rate limiting**:
   - Limit search requests
   - Prevent abuse

3. **Authentication** (optional):
   - Integrate Spotify OAuth for legitimate API access
   - Store tokens securely

4. **Logging**:
   - Log download attempts
   - Track failures for debugging

5. **User agreement**:
   - Add disclaimer in UI
   - Require acknowledgment for first use

---

## 6. File Structure Changes

### Backend

```
src/
├── core/
│   ├── spotify_service.py    # NEW - spotDL integration
│   └── __init__.py
├── api/
│   └── main.py              # MODIFY - add /api/spotify/* endpoints
└── ...
```

### Frontend

```
web/src/
├── components/
│   └── dashboard/
│       ├── SpotifySearch.tsx    # NEW - Spotify search component
│       └── StudioDrawer.tsx    # MODIFY - add Spotify tab
├── types/
│   └── index.ts                 # MODIFY - add SpotifyResult type
└── ...
```

### Configuration

```
pyproject.toml or requirements.txt
├── Add: spotdl>=4.5.2
├── Add: spotipy>=2.26.0
├── Add: ytmusicapi>=1.12.1
└── Add: yt-dlp>=2026.07.04
```

---

## 7. Testing Strategy

### Unit Tests

```python
# tests/test_spotify_service.py
import pytest
from pathlib import Path
from src.core.spotify_service import SpotifyService, SpotifyDownloadError

class TestSpotifyService:
    def test_initialization(self):
        service = SpotifyService(Path("/tmp/test"))
        assert service.output_dir.exists()

    def test_search_empty_query(self):
        service = SpotifyService(Path("/tmp/test"))
        # Should handle gracefully
        results = service.search_spotify("")
        assert results == []

    @pytest.mark.skipif(not SPOTIFY_ACCESS, reason="No Spotify access")
    def test_search_real_query(self):
        service = SpotifyService(Path("/tmp/test"))
        results = service.search_spotify("Bohemian Rhapsody")
        assert len(results) > 0
        assert results[0]["title"] == "Bohemian Rhapsody"
```

### Integration Tests

```python
# tests/test_spotify_api.py
def test_spotify_search_endpoint(client):
    response = client.post('/api/spotify/search', json={
        'query': 'test song'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert 'results' in data

def test_spotify_download_endpoint(client):
    response = client.post('/api/spotify/download', json={
        'url': 'https://open.spotify.com/track/...',
        'slug': 'test-song'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] == True
    assert Path(data['path']).exists()
```

---

## 8. Recommendations

### 8.1 Do It

**Yes, this is worth implementing** because:

1. **User Experience**: Eliminates the biggest friction point (manual audio acquisition)
2. **Competitive Advantage**: Most lyric video tools don't offer this
3. **Feasibility**: spotDL is mature, well-maintained, and MIT licensed
4. **Alignment**: Fits perfectly with the existing workflow

### 8.2 Implementation Order

1. **Phase 1** (1-2 days): Backend service + API endpoints
2. **Phase 2** (2-3 days): Frontend UI + integration
3. **Phase 3** (optional, 1 day): Lyrics auto-fetch
4. **Phase 4** (1 day): Testing + hardening

**Total effort**: ~5-7 days for a solid implementation

### 8.3 Risks to Mitigate

| Risk | Mitigation |
|------|------------|
| YouTube/Spotify API changes | Monitor spotDL updates, pin versions |
| Download failures | Good error messages, retry logic |
| Copyright concerns | Clear disclaimer, consider auth |
| Performance impact | Run downloads in background threads |
| Dependency bloat | Only import what we need from spotDL |

### 8.4 Alternative Approaches Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **spotDL library** (recommended) | Full feature set, well-tested | Adds ~15 dependencies | ✅ Best choice |
| Write custom YouTube downloader | No extra deps | Reinventing wheel, maintenance burden | ❌ Too much work |
| Use yt-dlp directly | Simpler than spotDL | Need to implement Spotify search ourselves | ⚠️ More work |
| Third-party API service | No local processing | Cost, privacy, reliability concerns | ❌ Not ideal |

---

## 9. Quick Start Implementation

If you want to start immediately, here's the minimal viable implementation:

### 9.1 Install spotDL

```bash
cd /c/lyric-video-generator
.venv/Scripts/python -m pip install spotdl
```

### 9.2 Create Minimal Service

```python
# src/core/spotify_service.py (minimal version)
from pathlib import Path
from spotdl.download.downloader import Downloader
from spotdl.types.song import Song

class SpotifyService:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.downloader = Downloader({
            "audio_providers": ["youtube"],
            "format": "mp3",
            "output": str(output_dir / "%(title)s.%(ext)s"),
            "overwrite": "skip",
            "threads": 1,
        })

    def download(self, spotify_url: str) -> Path:
        song = Song.from_url(spotify_url)
        result = self.downloader.download_song(song)
        return result[1]  # Returns path to downloaded file
```

### 9.3 Add API Endpoint

```python
# In src/api/main.py
@app.route('/api/spotify/download', methods=['POST'])
def spotify_download():
    data = request.get_json()
    url = data.get('url')
    slug = data.get('slug')

    service = SpotifyService(Path('input/audio'))
    audio_path = service.download(url)

    # Rename to standard location
    target = Path('input/audio') / f"{slug}.mp3"
    audio_path.rename(target)

    return jsonify({'path': str(target), 'success': True})
```

### 9.4 Add Frontend Button

Add a simple "Download from Spotify" button that:
1. Prompts for Spotify URL
2. Calls `/api/spotify/download`
3. Refreshes the song list

---

## 10. Conclusion

Integrating spotDL is a **high-value, feasible enhancement** that would significantly improve the user experience. The recommended approach is to:

1. **Start with Phase 1** (backend service) to validate the approach
2. **Add Phase 2** (frontend UI) for user-facing functionality
3. **Consider Phase 3** (lyrics) if there's demand
4. **Implement Phase 4** (hardening) before production release

The integration leverages spotDL's mature codebase while maintaining control over the user experience through our existing dashboard and API architecture.

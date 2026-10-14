import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Theme, LyricClip } from '../../types';
import { THEME_PRESETS, VISUAL_EFFECTS } from '../../types';
import { BLEND_MODES, FILTER_EFFECTS, getFilterEffect } from '../../lib/filters';
import { TRANSITIONS_CATALOG, getTransitionById, TRANSITION_DIRECTIONS } from '../../lib/transitions';
import { ANIMATION_CATALOG, LINE_ANIMATIONS, ENTRANCE_STYLES, EXIT_STYLES, WORD_ANIMATIONS, easeOutBack } from '../../lib/animations';
import { BUNDLED_FONTS, findBundledFont } from '../../lib/fonts';

// Used for Phase 1 wiring: ensure registries are referenced so they are not dropped.
void BLEND_MODES;
void FILTER_EFFECTS;
void TRANSITIONS_CATALOG;
void ANIMATION_CATALOG;
void LINE_ANIMATIONS;
void ENTRANCE_STYLES;
void EXIT_STYLES;
void WORD_ANIMATIONS;
void getFilterEffect;
void getTransitionById;
void TRANSITION_DIRECTIONS;
void easeOutBack;
void BUNDLED_FONTS;
void findBundledFont;
import { 
  FolderPlus,  Palette, Type, Wand2, Mic2, SlidersHorizontal, 
  ChevronLeft, ChevronRight, X, Smartphone, Monitor, Square, 
  AlignLeft, AlignCenter, AlignRight, Check, Sparkles, Layers,
  Search, Sliders, Music, Download, AlertCircle, Loader2, Film, Image
} from 'lucide-react';
import { SongSelector } from './SongSelector';
import './StudioDrawer.css';

export type StudioTab = 'media' | 'presets' | 'transitions' | 'effects' | 'lyrics' | 'spotify' | 'text' | 'motion' | 'karaoke' | 'canvas' | 'assets' | 'anime';

interface StudioDrawerProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  selectedSong: string | null;
  onSongSelect: (slug: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeTab?: StudioTab;
  onTabChange?: (tab: StudioTab) => void;
  clips?: LyricClip[];
  onClipsChange?: (clips: LyricClip[], actionName?: string) => void;
  songPaths?: any;
}

interface LyricsFinderState {
  query: string;
  suggestions: { artist: string; title: string }[];
  selected: { artist: string; title: string } | null;
  lyrics: string | null;
  // Server-provided per-line timestamps from /api/lyrics/search (LRC).
  // Empty when only plain (untimed) lyrics were fetched.
  structuredLyrics: { time: number; text: string }[];
  loading: boolean;
  error: string | null;
  copied: boolean;
  applied: string | null;
}

const LyricsFinderTab: React.FC<{
  selectedSong: string | null;
  onSongSelect: (slug: string) => void;
  clips?: LyricClip[];
  onClipsChange?: (clips: LyricClip[], actionName?: string) => void;
  songPaths?: any;
}> = ({ selectedSong, clips, onClipsChange, songPaths }) => {
  // NOTE: `clips` is accepted for interface consistency with other tabs; the
  // current implementation replaces the entire clip list on apply.
  void clips;
  const [state, setState] = useState<LyricsFinderState>({
    query: '',
    suggestions: [],
    selected: null,
    lyrics: null,
    structuredLyrics: [],
    loading: false,
    error: null,
    copied: false,
    applied: null,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = async (term: string) => {
    if (!term.trim()) {
      setState((s) => ({ ...s, suggestions: [], selected: null }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const resp = await fetch(`/api/lyrics/suggest?term=${encodeURIComponent(term)}`);
      const data = await resp.json();
      setState((s) => ({ ...s, suggestions: data.suggestions || [], loading: false }));
    } catch (err) {
      setState((s) => ({ ...s, suggestions: [], loading: false, error: 'Suggestions unavailable' }));
    }
  };

  const handleQueryChange = (value: string) => {
    setState((s) => ({ ...s, query: value, suggestions: [], selected: null, lyrics: null, error: null }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 250);
  };

  const selectSuggestion = (sug: { artist: string; title: string }) => {
    setState((s) => ({
      ...s,
      selected: sug,
      query: `${sug.artist} — ${sug.title}`,
      suggestions: [],
    }));
  };

  const fetchLyrics = async () => {
    const s = state.selected;
    if (!s) return;
    setState((st) => ({ ...st, loading: true, error: null, lyrics: null, structuredLyrics: [] }));
    try {
      // Use the POST /api/lyrics/search endpoint which expects { title, artist }
      const resp = await fetch('/api/lyrics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: s.title, artist: s.artist }),
      });
      const data = await resp.json();
      if (resp.ok && data.success && data.lyrics) {
        // Keep server timestamps (real LRC times from NetEase) so Apply can
        // use them instead of a blanket 3.5s-per-line guess.
        const structured: { time: number; text: string }[] = data.lyrics
          .filter((l: { text: string }) => l.text)
          .map((l: { time: number; text: string }) => ({
            time: typeof l.time === 'number' ? l.time : 0,
            text: l.text as string,
          }));
        // Format the display text as LRC ([mm:ss.xx] line) so the timestamps
        // survive copy/paste into other LRC-aware importers.
        const plainLyrics = structured
          .map(({ time, text }) => {
            const mm = String(Math.floor(time / 60)).padStart(2, '0');
            const ss = String(Math.floor(time % 60)).padStart(2, '0');
            const xx = String(Math.floor(Math.round((time % 1) * 100) % 100)).padStart(2, '0');
            return `[${mm}:${ss}.${xx}]${text}`;
          })
          .join('\r\n');
        setState((st) => ({
          ...st,
          lyrics: plainLyrics,
          structuredLyrics: structured,
          loading: false,
        }));
      } else {
        setState((st) => ({ ...st, loading: false, error: data.detail || data.error || 'No lyrics found' }));
      }
    } catch (err) {
      setState((st) => ({ ...st, loading: false, error: 'Failed to fetch lyrics' }));
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void s;
  };

  const copyLyrics = async () => {
    if (!state.lyrics) return;
    try {
      await navigator.clipboard.writeText(state.lyrics);
      setState((st) => ({ ...st, copied: true }));
      setTimeout(() => setState((st) => ({ ...st, copied: false })), 2000);
    } catch {
      // Fallback: select text in the lyrics box is not trivial; ignore.
    }
  };

  const applyToSong = () => {
    if (!state.lyrics || !selectedSong || !onClipsChange) return;

    // Derive title/artist from the loaded song metadata when available.
    const songLabel = songPaths?.lyrics ? 'loaded song' : String(selectedSong ?? 'the current song');

    // Real server-provided timestamps ([mm:ss.xx] LRC kept in the text, and
    // structuredLyrics from /api/lyrics/search) take precedence; the 3.5s
    // per-line spacing is only a fallback for untimed lyrics.
    const rawLines = state.lyrics.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return;

    // TypeScript note: replace \r\n literals with escaped CRLF guards.
    const parseLrcTimestamp = (line: string): { time: number | null; text: string } => {
      const m = line.match(/^\[(\d{1,2}):(\d{2})\.(\d{1,3})\](.*)$/);
      if (!m) return { time: null, text: line };
      const time = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3].padEnd(2, '0'), 10) / 100;
      return { time, text: m[4].trim() };
    };

    const parsed = rawLines.map(parseLrcTimestamp);
    const structured = state.structuredLyrics;
    // If the text carries no bracket times, fall back to structured times.
    const textHasTimes = parsed.some((p) => p.time !== null);

    const newClips: LyricClip[] = rawLines.map((lineText, i) => {
      let start: number;
      let text: string;
      if (textHasTimes) {
        const p = parsed[i];
        start = p.time !== null ? p.time : (i === 0 ? 0 : Math.round(i * 3.5 * 10) / 10);
        text = p.time !== null ? p.text : lineText;
      } else {
        const st = structured[i];
        start = st && st.text === lineText ? st.time : Math.round(i * 3.5 * 10) / 10;
        text = lineText;
      }
      // End time: next line's start, else +3.5s.
      let end: number;
      if (i + 1 < rawLines.length) {
        const nxt = textHasTimes ? parsed[i + 1] : null;
        const nextStartRaw = nxt && nxt.time !== null
          ? nxt.time
          : (structured[i + 1] && !textHasTimes && structured[i + 1].text === rawLines[i + 1]
              ? structured[i + 1].time
              : null);
        if (nextStartRaw !== null) {
          end = Math.round(nextStartRaw * 10) / 10;
        } else {
          end = Math.round((start + 3.5) * 10) / 10;
        }
      } else {
        end = Math.round((start + 3.5) * 10) / 10;
      }
      if (end <= start) end = Math.round((start + 0.2) * 10) / 10;
      return {
        id: `lf-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        start_time: Math.round(start * 10) / 10,
        end_time: end,
        text,
      };
    });
    onClipsChange(newClips, `Lyrics Finder: ${state.selected!.artist} — ${state.selected!.title}`);
    const usedServerTimes = (textHasTimes || structured.length > 0);
    setState((st) => ({
      ...st,
      applied: `${newClips.length} lines applied to “${songLabel}”${usedServerTimes ? ' with original timestamps' : ' (default 3.5s pacing)'}`,
    }));
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void songPaths;
  void clips;
  void songPaths;

  const hasSelectedSong = Boolean(selectedSong);
  const canApply = hasSelectedSong && state.lyrics && !state.loading;

  return (
    <div className="drawer-section lyrics-tab-content">
      <div className="section-instruction mb-2">
        Search for a song and fetch its lyrics from the online lyrics database.
      </div>

      <div className="lyrics-finder-search">
        <input
          type="text"
          value={state.query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Artist — Song (e.g. Pink Floyd — Wish You Were Here)"
          className="pro-text-input"
          autoComplete="off"
        />
        {state.loading && state.suggestions.length === 0 && (
          <div className="lyrics-finder-status">Fetching suggestions…</div>
        )}
      </div>

      {state.suggestions.length > 0 && (
        <div className="lyrics-finder-suggestions">
          {state.suggestions.slice(0, 12).map((sug, idx) => (
            <button
              key={idx}
              type="button"
              className={`lyrics-suggestion-item ${state.selected && state.selected.artist === sug.artist && state.selected.title === sug.title ? 'selected' : ''}`}
              onClick={() => selectSuggestion(sug)}
            >
              <span className="lyrics-suggestion-artist">{sug.artist}</span>
              <span className="lyrics-suggestion-sep">—</span>
              <span className="lyrics-suggestion-title">{sug.title}</span>
            </button>
          ))}
        </div>
      )}

      {state.selected && !state.lyrics && !state.loading && (
        <button
          type="button"
          className="lyrics-finder-fetch-btn"
          onClick={fetchLyrics}
          disabled={state.loading}
        >
          Fetch Lyrics
        </button>
      )}

      {state.error && (
        <div className="lyrics-finder-error">
          {state.error}
        </div>
      )}

      {state.lyrics && (
        <div className="lyrics-finder-result">
          <div className="lyrics-finder-header">
            <div className="lyrics-finder-title">
              <span className="lyrics-result-artist">{state.selected!.artist}</span>
              <span className="lyrics-result-sep">—</span>
              <span className="lyrics-result-title">{state.selected!.title}</span>
            </div>
            <div className="lyrics-finder-actions">
              <button type="button" className="lyrics-action-btn" onClick={copyLyrics}>
                {state.copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                className={`lyrics-action-btn ${canApply ? 'primary' : ''}`}
                onClick={applyToSong}
                disabled={!canApply}
                title={hasSelectedSong ? 'Replace the current song’s lyrics with these' : 'Select a song first'}
              >
                {hasSelectedSong ? 'Use for Current Song' : 'No Song Loaded'}
              </button>
            </div>
          </div>
          <div className="lyrics-finder-text">
            <pre>{state.lyrics}</pre>
          </div>
        </div>
      )}

      {state.applied && (
        <div className="lyrics-finder-toast">
          {state.applied}
        </div>
      )}

      {!selectedSong && state.lyrics && (
        <div className="lyrics-finder-hint">
          Load a song (media tab) to apply fetched lyrics to it.
        </div>
      )}
    </div>
  );
};


interface SpotifySearchState {
  query: string;
  results: { spotify_url: string; title: string; artist: string; album: string; duration: number; spotify_id: string; artwork_url?: string; source?: string }[];
  loading: boolean;
  error: string | null;
  status: { available: boolean; reason?: string } | null;
  downloadJobId: string | null;
  downloadStatus: { status: string; progress: number; error?: string } | null;
}

interface Asset {
  id: number;
  site: string;
  title: string;
  source_url: string;
  download_url: string;
  resolution: string;
  duration: string;
  status: string;
  local_path: string;
}

interface AnimeImageResult {
  url: string;
  preview_url: string;
  source_url: string;
  tags: string[];
  score: number;
  width: number;
  height: number;
  backend: string;
}

const AnimeImagesTab: React.FC<{
  onImageSelected?: (image: AnimeImageResult) => void;
}> = ({ onImageSelected }) => {
  const [images, setImages] = useState<AnimeImageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<AnimeImageResult | null>(null);

  // Defensive normalizer: ensures an object is a usable AnimeImageResult with
  // a tags array, so a malformed/error payload can never crash the grid render.
  const sanitizeImage = (raw: any): AnimeImageResult | null => {
    if (!raw || typeof raw !== 'object' || typeof raw.url !== 'string' || !raw.url) return null;
    return {
      url: raw.url,
      preview_url: typeof raw.preview_url === 'string' && raw.preview_url ? raw.preview_url : raw.url,
      source_url: typeof raw.source_url === 'string' ? raw.source_url : '',
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t: any) => typeof t === 'string') : [],
      score: typeof raw.score === 'number' ? raw.score : 0,
      width: typeof raw.width === 'number' ? raw.width : 0,
      height: typeof raw.height === 'number' ? raw.height : 0,
      backend: typeof raw.backend === 'string' ? raw.backend : '',
    };
  };

  const searchImages = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/anime/search?q=${encodeURIComponent(query)}&limit=30`);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const list = Array.isArray(data.results) ? data.results : [];
      setImages(list.map(sanitizeImage).filter(Boolean) as AnimeImageResult[]);
    } catch (err) {
      console.error('Anime image search failed:', err);
      setImages([]);
      alert(`Anime image search failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const pickRandom = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/anime/random');
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }
      const img = sanitizeImage(await resp.json());
      if (!img) throw new Error('Random endpoint returned no usable image');
      setImages([img]);
      setSelectedImage(img);
    } catch (err) {
      console.error('Anime random failed:', err);
      alert(`Could not fetch random anime image: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadSelected = async () => {
    const img = selectedImage || images[0];
    if (!img) return;
    try {
      const form = new FormData();
      form.append('image_url', img.url);
      form.append('filename', img.tags[0] || 'anime');
      const dlResp = await fetch('/api/anime/download', {
        method: 'POST',
        body: form,
      });
      const data = await dlResp.json();
      if (data.status === 'ok') {
        onImageSelected?.(img);
        alert(`Image saved to backgrounds: ${data.filename}`);
      }
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download image');
    }
  };

  return (
    <div className="drawer-section anime-tab-content">
      <p className="section-instruction">
        Search for anime images via the Nekos API to use as video backgrounds.
      </p>

      <div className="anime-search-box">
        <input
          type="text"
          className="pro-input"
          placeholder="e.g. watame, demon slayer, sparkle"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-secondary" onClick={searchImages} disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
        <button className="btn-secondary" onClick={pickRandom} disabled={loading} style={{ marginLeft: 8 }}>
          Random
        </button>
      </div>

      <div className="anime-grid">
        {images.map((img, idx) => (
          <div
            key={idx}
            className={`anime-image-card ${selectedImage === img ? 'selected' : ''}`}
          >
            <div className="anime-image-preview">
              <img src={img.preview_url || img.url} alt="anime preview" loading="lazy" />
              {selectedImage === img && (
                <div className="anime-selected-overlay">Selected</div>
              )}
            </div>
            <div className="anime-image-info">
              <span className="anime-tags">{(img.tags ?? []).slice(0, 3).join(', ')}</span>
              <span className="anime-score">Score: {img.score}</span>
            </div>
            <div className="anime-image-actions">
              <button
                className="btn-ghost small"
                onClick={() => { setSelectedImage(img); downloadSelected(); }}
              >
                Use as BG
              </button>
            </div>
          </div>
        ))}
        {images.length === 0 && !loading && (
          <div className="anime-empty">
            Search for anime images or click Random to get a random one.
          </div>
        )}
      </div>
    </div>
  );
};

const AssetsTab: React.FC<{
  onAssetDownloaded?: (asset: Asset) => void;
}> = ({ onAssetDownloaded }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [siteFilter, setSiteFilter] = useState('');
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [liveSearchNote, setLiveSearchNote] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (siteFilter) params.set('site', siteFilter);
      if (search) params.set('search', search);
      const resp = await fetch(`/api/assets?${params}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setAssets(data.assets || []);
      setLiveSearchNote(null);
    } catch (err) {
      console.error('Failed to load assets:', err);
      setLiveSearchNote(`Failed to load assets: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [siteFilter, search]);

  // Live-search the external clip sites (editpacks / animeclipsraw) for the
  // entered query, then render the freshly indexed results.
  const runLiveSearch = useCallback(async () => {
    const q = search.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/assets/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({} as any));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      setAssets(data.assets || []);
      const searched = data.searched && typeof data.searched === 'object' ? data.searched : {};
      const siteInfo = Object.entries(searched).map(([s, n]) => `${s}: ${n}`).join(', ') || 'no new';
      setLiveSearchNote(`Searched sites (${siteInfo}). ${data.count ?? 0} results.`);
    } catch (err) {
      console.error('Live asset search failed:', err);
      setLiveSearchNote(`Live search failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [search, loading]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const startDownload = async (asset: Asset) => {
    if (!asset.download_url) return;
    setDownloadingId(asset.id);
    try {
      const resp = await fetch(`/api/assets/${asset.id}/download`, { method: 'POST' });
      const data = await resp.json();
      if (data.job_id) {
        // Poll for completion
        const poll = async () => {
          const statusResp = await fetch(`/api/assets/${asset.id}/download-status?job_id=${data.job_id}`);
          const statusData = await statusResp.json();
          if (statusData.status === 'completed') {
            setDownloadingId(null);
            onAssetDownloaded?.(asset);
            loadAssets();
          } else if (statusData.status === 'failed') {
            setDownloadingId(null);
            alert(`Download failed: ${statusData.error || 'unknown'}`);
          } else {
            setTimeout(poll, 1000);
          }
        };
        poll();
      }
    } catch (err) {
      setDownloadingId(null);
      alert('Download request failed');
    }
  };

  const siteColors: Record<string, string> = {
    editpacks: '#3b82f6',
    youpro: '#8b5cf6',
    motionvault: '#10b981',
    animeclipsraw: '#f59e0b',
    ninjaclips: '#ef4444',
  };

  return (
    <div className="drawer-section assets-tab-content">
      <p className="section-instruction">
        Browse external clip/pack libraries. Downloaded clips are copied to your
        backgrounds folder and available in the song import dialog.
      </p>

      <div className="control-group" style={{ marginBottom: 12 }}>
        <input
          type="text"
          className="pro-input"
          placeholder="Search clip sites (e.g. Spider-Man, Jujutsu Kaisen) — fires live site search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') runLiveSearch(); }}
          style={{ width: '100%', marginBottom: 8 }}
        />
        <select
          className="pro-select"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">All sites</option>
          <option value="editpacks">editpacks</option>
          <option value="youpro">youpro</option>
          <option value="motionvault">motionvault</option>
          <option value="animeclipsraw">animeclipsraw</option>
          <option value="ninjaclips">ninjaclips</option>
        </select>
        <button
          className="btn-secondary"
          onClick={runLiveSearch}
          disabled={loading || !search.trim()}
          style={{ marginTop: 8, marginRight: 8 }}
          title="Query the sites live and index fresh results"
        >
          {loading ? 'Searching…' : 'Search Sites'}
        </button>
        <button
          className="btn-ghost small"
          onClick={loadAssets}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          Refresh
        </button>
        {liveSearchNote && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
            {liveSearchNote}
          </div>
        )}
      </div>

      <div className="assets-grid">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className={`asset-card ${asset.status === 'downloaded' ? 'downloaded' : ''}`}
            style={{ borderLeftColor: siteColors[asset.site] || '#6b7280' }}
          >
            <div className="asset-card-header">
              <span className="asset-site" style={{ color: siteColors[asset.site] || '#6b7280' }}>
                {asset.site}
              </span>
              <span className="asset-status">
                {asset.status === 'downloaded' ? '✓ Downloaded' : asset.download_url ? 'Download available' : 'No download'}
              </span>
            </div>
            <div className="asset-title">{asset.title}</div>
            <div className="asset-meta">
              {asset.resolution && <span>{asset.resolution}</span>}
              {asset.duration && <span> · {asset.duration}</span>}
            </div>
            <div className="asset-card-actions">
              {asset.download_url && asset.status !== 'downloaded' && (
                <button
                  className="btn-ghost small"
                  onClick={() => startDownload(asset)}
                  disabled={downloadingId === asset.id}
                >
                  {downloadingId === asset.id ? 'Downloading…' : 'Download'}
                </button>
              )}
              {asset.status === 'downloaded' && (
                <button
                  className="btn-ghost small"
                  onClick={() => window.open(`/api/assets/${asset.id}/file`, '_blank')}
                >
                  View
                </button>
              )}
            </div>
          </div>
        ))}
        {assets.length === 0 && !loading && (
          <div className="assets-empty">No assets found matching your filters.</div>
        )}
      </div>
    </div>
  );
};

const SpotifyTab: React.FC<{
  selectedSong: string | null;
  onSongSelect: (slug: string) => void;
}> = ({ selectedSong, onSongSelect }) => {
  const [state, setState] = useState<SpotifySearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
    status: null,
    downloadJobId: null,
    downloadStatus: null,
  });

  // Check Spotify availability on mount
  useEffect(() => {
    fetch('/api/spotify/status')
      .then(r => r.json())
      .then(data => setState(s => ({ ...s, status: data })))
      .catch(() => setState(s => ({ ...s, status: { available: false, reason: 'Unable to reach API' } })));
  }, []);

  const searchSpotify = async () => {
    if (!state.query.trim()) return;
    setState(s => ({ ...s, loading: true, error: null, results: [] }));
    try {
      const resp = await fetch('/api/spotify/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: state.query, limit: 10 }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setState(s => ({ ...s, loading: false, error: data.detail || 'Search failed' }));
      } else {
        setState(s => ({ ...s, loading: false, results: data.results || [] }));
      }
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: 'Network error' }));
    }
  };

  const handleQueryChange = (value: string) => {
    setState(s => ({ ...s, query: value, error: null }));
  };

  const downloadSong = async (spotifyUrl: string) => {
    if (!selectedSong) {
      // Auto-select a song slug from the current selection or prompt
      return;
    }
    setState(s => ({ ...s, downloadJobId: null, downloadStatus: null }));
    try {
      const resp = await fetch('/api/spotify/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: spotifyUrl, slug: selectedSong }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setState(s => ({ ...s, error: data.detail || 'Download failed' }));
      } else {
        setState(s => ({ ...s, downloadJobId: data.job_id }));
        // Poll for completion
        const poll = setInterval(async () => {
          try {
            const statusResp = await fetch(`/api/spotify/download-status/${data.job_id}`);
            const statusData = await statusResp.json();
            setState(s => ({ ...s, downloadStatus: statusData }));
            if (statusData.status === 'completed' || statusData.status === 'failed') {
              clearInterval(poll);
              if (statusData.status === 'completed' && onSongSelect) {
                // Refresh song list by re-selecting the current song
                onSongSelect(selectedSong);
              }
            }
          } catch {
            clearInterval(poll);
          }
        }, 1000);
      }
    } catch (err) {
      setState(s => ({ ...s, error: 'Download request failed' }));
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isAvailable = state.status?.available;

  return (
    <div className="drawer-section spotify-tab-content">
      <div className="section-instruction mb-2">
        Search and download songs from Spotify. Requires <code>spotDL</code> on the server.
      </div>

      {!isAvailable && state.status && (
        <div className="spotify-unavailable">
          <AlertCircle size={20} />
          <div>
            <strong>Spotify not available</strong>
            <p className="spotify-unavailable-reason">{state.status.reason || 'Unknown reason'}</p>
            <p className="spotify-unavailable-hint">
              Run <code>uv pip install spotdl</code> on the server to enable.
            </p>
          </div>
        </div>
      )}

      <div className="spotify-search-box">
        <input
          type="text"
          value={state.query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder="Artist — Song (e.g. ABBA — Winner Takes It All)"
          className="pro-text-input"
          onKeyDown={e => e.key === 'Enter' && searchSpotify()}
        />
        <button
          type="button"
          className="btn-spotify-search"
          onClick={searchSpotify}
          disabled={state.loading || !state.query.trim()}
        >
          {state.loading ? <><Loader2 size={16} className="animate-spin" /> Searching…</> : <><Search size={16} /> Search</>}
        </button>
      </div>

      {state.error && (
        <div className="spotify-error">
          <AlertCircle size={14} /> {state.error}
        </div>
      )}

      {state.results.length > 0 && (
        <div className="spotify-results">
          {state.results.map((r, idx) => (
            <div key={idx} className="spotify-result-item">
              {r.artwork_url && (
                <img src={r.artwork_url} alt="" loading="lazy" className="spotify-result-art" />
              )}
              <div className="spotify-result-info">
                <span className="spotify-result-title">{r.title}</span>
                <span className="spotify-result-artist">{r.artist}</span>
                {r.album && <span className="spotify-result-album">{r.album}</span>}
              </div>
              <div className="spotify-result-actions">
                <span className="spotify-result-duration">{formatDuration(r.duration)}</span>
                <button
                  type="button"
                  className="btn-spotify-download"
                  onClick={() => r.spotify_url && downloadSong(r.spotify_url)}
                  disabled={!selectedSong || !r.spotify_url}
                  title={
                    !r.spotify_url
                      ? 'Metadata-only result (Spotify API quota exhausted) — set SPOTIFY_CLIENT_ID/SECRET for downloads'
                      : selectedSong ? 'Download to current song' : 'Select a song first'
                  }
                >
                  <Download size={14} />
                  {r.source === 'itunes' && r.spotify_url === ''
                    ? 'Preview only'
                    : selectedSong ? 'Download' : 'No Song'}
                </button>
              </div>
            </div>
          ))}

          {state.results.every(r => !r.spotify_url) && (
            <div className="spotify-hint">
              Note: Spotify's shared search credentials are rate-limited, so results shown are
              iTunes metadata (no direct download). To enable downloads, set SPOTIFY_CLIENT_ID and
              SPOTIFY_CLIENT_SECRET to your own Spotify app credentials on the server.
            </div>
          )}
        </div>
      )}

      {state.downloadStatus && (
        <div className="spotify-download-status">
          {state.downloadStatus.status === 'completed' && (
            <div className="spotify-status-success">
              <Check size={14} /> Download complete! Song added to library.
            </div>
          )}
          {state.downloadStatus.status === 'downloading' && (
            <div className="spotify-status-progress">
              <Loader2 size={14} className="animate-spin" />
              Downloading… {Math.round((state.downloadStatus.progress || 0) * 100)}%
            </div>
          )}
          {state.downloadStatus.status === 'failed' && (
            <div className="spotify-status-error">
              <AlertCircle size={14} /> Download failed: {state.downloadStatus.error}
            </div>
          )}
        </div>
      )}

      {!selectedSong && (
        <div className="spotify-hint">
          Select a song from the Media tab first to download Spotify tracks to it.
        </div>
      )}
    </div>
  );
};

export const StudioDrawer: React.FC<StudioDrawerProps> = ({
  theme,
  onThemeChange,
  selectedSong,
  onSongSelect,
  isOpen,
  onToggleOpen,
  activeTab: controlledTab,
  onTabChange,
  clips,
  onClipsChange,
  songPaths: _songPaths
}) => {
  const [internalTab, setInternalTab] = useState<StudioTab>('media');
  const [effectCategory, setEffectCategory] = useState<'all' | 'color' | 'texture' | 'retro'>('all');
  const [transitionCategory, setTransitionCategory] = useState<'all' | 'dissolve' | 'wipe' | 'motion' | 'light'>('all');
  const currentTab = controlledTab || internalTab;
  const [spotifyStatus, setSpotifyStatus] = useState<{ available: boolean } | null>(null);

  // Check Spotify API availability for the drawer header badge
  useEffect(() => {
    fetch('/api/spotify/status')
      .then(r => r.json())
      .then((data: { available: boolean }) => setSpotifyStatus(data))
      .catch(() => setSpotifyStatus({ available: false }));
  }, []);

  const handleSelectTab = (tab: StudioTab) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);

    if (!isOpen) {
      onToggleOpen();
    }
  };

  const handleChange = (key: keyof Theme, value: any) => {
    onThemeChange({ ...theme, [key]: value });
  };

  const handleApplyPreset = (presetTheme: Partial<Theme>) => {
    onThemeChange({
      ...theme,
      ...presetTheme,
      aspect_ratio: theme.aspect_ratio, // Preserve aspect ratio
    });
  };

  const handleGradientChange = (index: number, value: number) => {
    const newGrad = [...theme.inactive_text_opacity_gradient];
    newGrad[index] = value;
    handleChange('inactive_text_opacity_gradient', newGrad);
  };

  return (
    <div className={`studio-drawer-wrapper ${isOpen ? 'drawer-open' : 'drawer-collapsed'}`}>
      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 1. Primary Tool Rail (56px Icon Column)                           */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <nav className="studio-tool-rail">
        <div className="tool-rail-top">
          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'media' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('media')}
            title="Project Media & Import"
          >
            <FolderPlus size={18} />
            <span className="rail-tab-label">Media</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'presets' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('presets')}
            title="Curated Style Presets"
          >
            <Palette size={18} />
            <span className="rail-tab-label">Presets</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'transitions' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('transitions')}
            title="Inter-Clip Transitions & Wipes"
          >
            <Layers size={18} />
            <span className="rail-tab-label">Transitions</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'effects' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('effects')}
            title="Visual Effects, Film Filters & Shaders"
          >
            <Sparkles size={18} />
            <span className="rail-tab-label">Effects</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'lyrics' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('lyrics')}
            title="Lyrics Finder — search & fetch lyrics online"
          >
            <Search size={18} />
            <span className="rail-tab-label">Lyrics</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'spotify' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('spotify')}
            title="Spotify — search & download tracks"
          >
            <Music size={18} />
            <span className="rail-tab-label">Spotify</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'text' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('text')}
            title="Typography & Text Styling"
          >
            <Type size={18} />
            <span className="rail-tab-label">Text</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'motion' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('motion')}
            title="Motion & Animation Engine"
          >
            <Wand2 size={18} />
            <span className="rail-tab-label">Motion</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'karaoke' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('karaoke')}
            title="Karaoke Timing & Glow"
          >
            <Mic2 size={18} />
            <span className="rail-tab-label">Karaoke</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'canvas' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('canvas')}
            title="Canvas, Aspect Ratio & Brand"
          >
            <SlidersHorizontal size={18} />
            <span className="rail-tab-label">Canvas</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'assets' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('assets')}
            title="Clips Library — browse & download external clips"
          >
            <Film size={18} />
            <span className="rail-tab-label">Assets</span>
          </button>

          <button 
            type="button"
            className={`rail-tab-btn ${currentTab === 'anime' && isOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab('anime')}
            title="Anime Images — search Nekos API for backgrounds"
          >
            <Image size={18} />
            <span className="rail-tab-label">Anime</span>
          </button>
        </div>

        <div className="tool-rail-bottom">
          <button 
            type="button"
            className="rail-collapse-btn"
            onClick={onToggleOpen}
            title={isOpen ? "Collapse Studio Panel" : "Expand Studio Panel"}
          >
            {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </nav>

      {/* ───────────────────────────────────────────────────────────────── */}
      {/* 2. Drawer Content Panel (Focused section view)                    */}
      {/* ───────────────────────────────────────────────────────────────── */}
      <aside className="studio-drawer-panel">
        {/* Panel Header */}
        <div className="drawer-panel-header">
          <div className="drawer-title-group">
            {currentTab === 'media' && (
              <>
                <h3 className="drawer-title">Media & Import</h3>
                <span className="drawer-badge">{selectedSong ? selectedSong : 'Library'}</span>
              </>
            )}
            {currentTab === 'presets' && (
              <>
                <h3 className="drawer-title">Curated Presets</h3>
                <span className="drawer-badge">{THEME_PRESETS.length} Styles</span>
              </>
            )}
            {currentTab === 'transitions' && (
              <>
                <h3 className="drawer-title">Clip Transitions</h3>
                <span className="drawer-badge">{(theme.active_transition || 'CROSSFADE').toUpperCase()}</span>
              </>
            )}
            {currentTab === 'effects' && (
              <>
                <h3 className="drawer-title">Effects & Filters</h3>
                <span className="drawer-badge">{theme.active_filter.toUpperCase()}</span>
              </>
            )}
            {currentTab === 'text' && (
              <>
                <h3 className="drawer-title">Typography & Text</h3>
                <span className="drawer-badge">{theme.font_family}</span>
              </>
            )}
            {currentTab === 'motion' && (
              <>
                <h3 className="drawer-title">Motion Engine</h3>
                <span className="drawer-badge">{theme.animation_style.toUpperCase()}</span>
              </>
            )}
            {currentTab === 'karaoke' && (
              <>
                <h3 className="drawer-title">Karaoke Highlight</h3>
                <span className="drawer-badge">{theme.highlight_mode.toUpperCase()}</span>
              </>
            )}
            {currentTab === 'canvas' && (
              <>
                <h3 className="drawer-title">Canvas & Layout</h3>
                <span className="drawer-badge">{theme.aspect_ratio}</span>
              </>
            )}
            {currentTab === 'assets' && (
              <>
                <h3 className="drawer-title">Clips Library</h3>
                <span className="drawer-badge">Assets</span>
              </>
            )}
            {currentTab === 'spotify' && (
              <>
                <h3 className="drawer-title">Spotify Downloader</h3>
                <span className="drawer-badge">{spotifyStatus?.available ? 'Ready' : 'Unavailable'}</span>
              </>
            )}
          </div>

          <button 
            type="button" 
            className="drawer-close-btn"
            onClick={onToggleOpen}
            title="Close Panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Panel Body */}
        <div className="drawer-panel-body">
          {/* TAB 1: MEDIA & IMPORT */}
          {currentTab === 'media' && (
            <div className="drawer-section media-tab-content">
              <SongSelector onSelect={onSongSelect} />
            </div>
          )}

          {/* TAB 2: CURATED PRESETS */}
          {currentTab === 'presets' && (
            <div className="drawer-section presets-tab-content">
              <p className="section-instruction">
                Select a production-ready color and typographical aesthetic.
              </p>
              <div className="presets-grid-pro">
                {THEME_PRESETS.map((preset) => {
                  const isSelected = theme.name === preset.name;
                  return (
                    <div 
                      key={preset.id}
                      className={`preset-card-pro ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleApplyPreset(preset.theme)}
                    >
                      <div className="preset-card-header">
                        <span className="preset-name">{preset.name}</span>
                        <span className="preset-badge">{preset.badge}</span>
                      </div>
                      <p className="preset-desc">{preset.description}</p>

                      <div className="preset-card-actions">
                        <div className="preset-swatches-pro">
                          <span 
                            className="swatch-circle" 
                            style={{ backgroundColor: preset.theme.background_color }} 
                            title="Background Color" 
                          />
                          <span 
                            className="swatch-circle" 
                            style={{ backgroundColor: preset.theme.text_color }} 
                            title="Text Color" 
                          />
                          <span 
                            className="swatch-circle active-circle" 
                            style={{ 
                              backgroundColor: preset.theme.active_text_color,
                              boxShadow: preset.theme.active_glow_color ? `0 0 6px ${preset.theme.active_glow_color}` : 'none'
                            }} 
                            title="Active Glow" 
                          />
                        </div>
                        {isSelected && (
                          <div className="preset-active-check">
                            <Check size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: LYRICS FINDER */}
          {currentTab === 'lyrics' && (
            < LyricsFinderTab 
              selectedSong={selectedSong}
              onSongSelect={onSongSelect}
              clips={clips}
              onClipsChange={onClipsChange}
            />
          )}

          {/* TAB: SPOTIFY DOWNLOADER */}
          {currentTab === 'spotify' && (
            <SpotifyTab 
              selectedSong={selectedSong}
              onSongSelect={onSongSelect}
            />
          )}

          {/* TAB: CLIPS LIBRARY */}
          {currentTab === 'assets' && (
            <AssetsTab 
              onAssetDownloaded={() => {
                // Refresh backgrounds list when a clip is downloaded
                fetch('/api/backgrounds')
                  .then(r => r.json())
                  .then(() => {
                    // Forward to parent via callback if needed
                    onClipsChange?.(clips ?? [], 'asset-downloaded');
                  })
                  .catch(() => {});
              }}
            />
          )}

          {/* TAB: ANIME IMAGES */}
          {currentTab === 'anime' && (
            <AnimeImagesTab 
              onImageSelected={() => {
                fetch('/api/backgrounds').then(() => {}).catch(() => {});
              }}
            />
          )}

          {/* TAB: TRANSITIONS & WIPES */}
          {currentTab === 'transitions' && (
            <div className="drawer-section transitions-tab-content">
              {/* Transitions Showcase Header Banner */}
              <div className="transitions-showcase-banner">
                <img 
                  src="/assets/previews/transitions-showcase.jpg" 
                  alt="Transitions Showcase" 
                  className="transitions-banner-bg" 
                />
                <div className="transitions-banner-content">
                  <span className="transitions-banner-tag">OPENSHOT GPU SHADERS</span>
                  <div className="transitions-banner-title">Cinema Dynamic Wipes & Cuts</div>
                  <p className="transitions-banner-desc">Hardware-accelerated clip wipes, directional slides and organic light leaks</p>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="effects-category-filter">
                {(['all', 'dissolve', 'wipe', 'motion', 'light'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill-btn ${transitionCategory === cat ? 'active' : ''}`}
                    onClick={() => setTransitionCategory(cat)}
                  >
                    {cat === 'all' ? 'All Transitions' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              {/* Transition Duration Slider */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Transition Duration</label>
                  <span className="group-value-pill">{(theme.transition_duration || 0.4).toFixed(2)}s</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={theme.transition_duration || 0.4}
                  onChange={(e) => handleChange('transition_duration', parseFloat(e.target.value))}
                  className="pro-range"
                />
              </div>

              {/* Quick Action: Apply to All Clips */}
              {clips && clips.length > 0 && (
                <div className="transition-quick-actions">
                  <button
                    type="button"
                    className="btn-apply-all-transitions"
                    onClick={() => {
                      if (onClipsChange) {
                        const updated = clips.map(c => ({
                          ...c,
                          transition: theme.active_transition,
                          transition_duration: theme.transition_duration
                        }));
                        onClipsChange(updated, `Apply ${theme.active_transition} to All Clips`);
                      }
                    }}
                    title="Apply current transition to every lyric clip on the timeline"
                  >
                    <Layers size={13} />
                    <span>Apply "{theme.active_transition}" to All {clips.length} Clips</span>
                  </button>
                </div>
              )}

              {/* Transition Cards 2-Column Grid */}
              {TRANSITIONS_CATALOG.length > 12 && (
                <select 
                  value={theme.active_transition} 
                  onChange={(e) => handleChange('active_transition', e.target.value)} 
                  className="pro-select"
                >
                  {TRANSITIONS_CATALOG.map((trans) => (
                    <option key={trans.id} value={trans.id}>{trans.name}</option>
                  ))}
                </select>
              )}
              <div className="transitions-cards-grid">
                {TRANSITIONS_CATALOG
                  .filter(t => transitionCategory === 'all' || t.category === transitionCategory)
                  .map((trans) => {
                    const isSelected = theme.active_transition === trans.id;
                    return (
                      <div
                        key={trans.id}
                        className={`transition-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleChange('active_transition', trans.id)}
                      >
                        <div className="trans-card-preview">
                          <div className={`trans-anim-box ${trans.previewClass}`}>
                            <span className="anim-box-a">A</span>
                            <span className="anim-box-b">B</span>
                          </div>
                        </div>
                        <div className="trans-card-info">
                          <div className="trans-card-header">
                            <span className="trans-card-name">{trans.name}</span>
                            <span className="trans-card-tag">{trans.tag}</span>
                          </div>
                          <p className="trans-card-desc">{trans.description}</p>
                        </div>
                        {isSelected && (
                          <div className="trans-active-badge">
                            <Check size={12} />
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB: VISUAL EFFECTS & SHADERS */}
          {currentTab === 'effects' && (
            <div className="drawer-section effects-tab-content">
              {/* Category Filter Pills */}
              <div className="effects-category-filter">
                {(['all', 'color', 'texture', 'retro'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`cat-pill-btn ${effectCategory === cat ? 'active' : ''}`}
                    onClick={() => setEffectCategory(cat)}
                  >
                    {cat === 'all' ? 'All Filters' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              {/* Visual Effects & Shaders Grid with Generated Visual Thumbnails */}
              <div className="effects-grid">
                {VISUAL_EFFECTS.filter(e => effectCategory === 'all' || e.category === effectCategory).map((effect) => {
                  const isActive = theme.active_filter === effect.id;
                  return (
                    <div
                      key={effect.id}
                      className={`effect-card ${isActive ? 'selected' : ''}`}
                      onClick={() => handleChange('active_filter', effect.id)}
                    >
                      <div 
                        className="effect-preview-swatch"
                        style={{ background: effect.previewGradient }}
                      >
                        {effect.previewImage && (
                          <img 
                            src={effect.previewImage} 
                            alt={effect.name} 
                            className="effect-card-thumb-img" 
                            loading="lazy" 
                          />
                        )}
                        <span className="effect-category-badge">{effect.tag}</span>
                        {isActive && (
                          <div className="effect-check-indicator">
                            <Check size={14} />
                          </div>
                        )}
                      </div>

                      <div className="effect-info">
                        <div className="effect-name">{effect.name}</div>
                        <div className="effect-desc">{effect.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Filter Intensity Slider */}
              {theme.active_filter !== 'none' && (
                <div className="control-group">
                  <div className="group-header-flex">
                    <label className="group-label">Filter Intensity</label>
                    <span className="group-value-pill">{theme.filter_intensity || 80}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={theme.filter_intensity || 80}
                    onChange={(e) => handleChange('filter_intensity', parseInt(e.target.value))}
                    className="pro-range"
                  />
                </div>
              )}

              {/* ───────────────────────────────────────────────────────────── */}
              {/* OpenShot Pro VFX Engine Controls (Phase 2)                   */}
              {/* ───────────────────────────────────────────────────────────── */}
              <div className="section-divider-title">
                <Sliders size={13} />
                <span>OpenShot VFX Engine</span>
              </div>

              {/* Gaussian Defocus Background Blur */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Background Defocus Blur</label>
                  <span className="group-value-pill">{theme.background_blur || 0}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  value={theme.background_blur || 0}
                  onChange={(e) => handleChange('background_blur', parseInt(e.target.value))}
                  className="pro-range"
                />
                <span className="control-help-hint">Blurs video background to elevate lyric readability</span>
              </div>

              {/* Cinematic Letterbox Matte Bars */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Cinematic Letterbox Matte</label>
                  <span className="group-value-pill">{theme.letterbox_bars || 'none'}</span>
                </div>
                <div className="segmented-pill-group">
                  {[
                    { id: 'none', label: 'None' },
                    { id: '2.39:1', label: '2.39:1 Scope' },
                    { id: '1.85:1', label: '1.85:1 Flat' },
                    { id: '4:3', label: '4:3 Vintage' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`cat-pill-btn ${theme.letterbox_bars === b.id ? 'active' : ''}`}
                      onClick={() => handleChange('letterbox_bars', b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {theme.letterbox_bars !== 'none' && (
                  <div className="sub-control-row">
                    <span className="sub-label">Matte Bar Color</span>
                    <div className="color-picker-wrapper">
                      <input
                        type="color"
                        value={theme.letterbox_color || '#000000'}
                        onChange={(e) => handleChange('letterbox_color', e.target.value)}
                        className="pro-color-input"
                      />
                      <span className="color-hex">{theme.letterbox_color || '#000000'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ChromaKey Screen Removal */}
              <div className="toggle-card">
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">ChromaKey Screen Removal</div>
                    <div className="toggle-desc">Key out green or blue screen video backgrounds</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={theme.chroma_key_enabled || false}
                    onChange={(e) => handleChange('chroma_key_enabled', e.target.checked)}
                    className="pro-switch"
                  />
                </div>

                {theme.chroma_key_enabled && (
                  <div className="toggle-card-details">
                    <div className="chroma-presets-row">
                      <span className="sub-label">Key Color:</span>
                      <div className="color-presets-flex">
                        {[
                          { label: 'Green', color: '#00ff00' },
                          { label: 'Blue', color: '#0000ff' },
                          { label: 'Magenta', color: '#ff00ff' },
                        ].map((preset) => (
                          <button
                            key={preset.color}
                            type="button"
                            className={`chroma-color-chip ${theme.chroma_key_color?.toLowerCase() === preset.color ? 'active' : ''}`}
                            style={{ backgroundColor: preset.color }}
                            onClick={() => handleChange('chroma_key_color', preset.color)}
                            title={`Key ${preset.label}`}
                          >
                            {theme.chroma_key_color?.toLowerCase() === preset.color && <Check size={10} color="#000" />}
                          </button>
                        ))}
                        <input
                          type="color"
                          value={theme.chroma_key_color || '#00ff00'}
                          onChange={(e) => handleChange('chroma_key_color', e.target.value)}
                          className="pro-color-input-mini"
                          title="Custom Chroma Color"
                        />
                      </div>
                    </div>

                    <div className="control-group sub-group">
                      <div className="group-header-flex">
                        <label className="group-label">Tolerance / Fuzz</label>
                        <span className="group-value-pill">{theme.chroma_key_fuzz || 35}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={theme.chroma_key_fuzz || 35}
                        onChange={(e) => handleChange('chroma_key_fuzz', parseInt(e.target.value))}
                        className="pro-range"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Liquid Wave Distortion */}
              <div className="toggle-card">
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Liquid Wave Distortion</div>
                    <div className="toggle-desc">Dynamic fluid ripple and psychedelic wave warp</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={theme.wave_enabled || false}
                    onChange={(e) => handleChange('wave_enabled', e.target.checked)}
                    className="pro-switch"
                  />
                </div>

                {theme.wave_enabled && (
                  <div className="toggle-card-details">
                    <div className="control-group sub-group">
                      <div className="group-header-flex">
                        <label className="group-label">Wave Amplitude</label>
                        <span className="group-value-pill">{theme.wave_amplitude || 15}</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="50"
                        value={theme.wave_amplitude || 15}
                        onChange={(e) => handleChange('wave_amplitude', parseInt(e.target.value))}
                        className="pro-range"
                      />
                    </div>

                    <div className="control-group sub-group">
                      <div className="group-header-flex">
                        <label className="group-label">Wave Speed</label>
                        <span className="group-value-pill">{(theme.wave_speed || 1.0).toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="3.0"
                        step="0.1"
                        value={theme.wave_speed || 1.0}
                        onChange={(e) => handleChange('wave_speed', parseFloat(e.target.value))}
                        className="pro-range"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 8-Bit Mosaic Pixelate */}
              <div className="toggle-card">
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">8-Bit Mosaic Pixelate</div>
                    <div className="toggle-desc">Retro arcade block quantization mosaic filter</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={theme.pixelate_enabled || false}
                    onChange={(e) => handleChange('pixelate_enabled', e.target.checked)}
                    className="pro-switch"
                  />
                </div>

                {theme.pixelate_enabled && (
                  <div className="toggle-card-details">
                    <div className="control-group sub-group">
                      <div className="group-header-flex">
                        <label className="group-label">Mosaic Block Size</label>
                        <span className="group-value-pill">{theme.pixelate_block_size || 16}px</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="48"
                        step="2"
                        value={theme.pixelate_block_size || 16}
                        onChange={(e) => handleChange('pixelate_block_size', parseInt(e.target.value))}
                        className="pro-range"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Vignette Toggle */}
              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Cinematic Lens Vignette</div>
                  <div className="toggle-desc">Darken outer frame edges to focus lyrics</div>
                </div>
                <input
                  type="checkbox"
                  checked={theme.vignette_enabled || false}
                  onChange={(e) => handleChange('vignette_enabled', e.target.checked)}
                  className="pro-switch"
                />
              </div>

              {/* Ambient Dynamic Particles */}
              <div className="control-group">
                <label className="group-label">Ambient Particle Shaders</label>
                <div className="segmented-particle-selector">
                  {[
                    { id: 'none', label: 'Off' },
                    { id: 'starfield', label: 'Starfield' },
                    { id: 'dust-motes', label: 'Dust Motes' },
                    { id: 'audio-pulse', label: 'Pulse Wave' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`particle-pill-btn ${theme.ambient_particles === p.id ? 'active' : ''}`}
                      onClick={() => handleChange('ambient_particles', p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TYPOGRAPHY & TEXT */}
          {currentTab === 'text' && (
            <div className="drawer-section text-tab-content">
              {/* ── Font Family (bundled OFL first, then system fallbacks) ── */}
              <div className="control-group">
                <label className="group-label">Font Family</label>
                <select 
                  value={theme.font_family} 
                  onChange={(e) => handleChange('font_family', e.target.value)}
                  className="pro-select"
                >
                  <optgroup label="Bundled (self-hosted OFL)">
                    {BUNDLED_FONTS.map((font) => (
                      <option key={font.family} value={font.family}>
                        {font.label} — {font.category}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="System fallbacks">
                    <option value="Arial">Arial (Clean Sans)</option>
                    <option value="Roboto">Roboto (Android / Google)</option>
                    <option value="Georgia">Georgia (Editorial Serif)</option>
                  </optgroup>
                </select>
                {findBundledFont(theme.font_family) && (
                  <span className="control-help-hint">
                    Bundled — preview and render use the same TTF file.
                  </span>
                )}
              </div>

              {/* ── Font Weight (only for bundled fonts that ship the weight) ── */}
              {findBundledFont(theme.font_family) && (
                <div className="control-group">
                  <div className="group-header-flex">
                    <label className="group-label">Font Weight</label>
                    <span className="group-value-pill">{theme.font_weight}</span>
                  </div>
                  <div className="segmented-pill-group">
                    {findBundledFont(theme.font_family)!.weights.map((w) => (
                      <button
                        key={w}
                        type="button"
                        className={`cat-pill-btn ${theme.font_weight === w ? 'active' : ''}`}
                        onClick={() => handleChange('font_weight', w)}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Font Style ── */}
              <div className="control-group">
                <label className="group-label">Font Style</label>
                <div className="segmented-pill-group">
                  <button
                    type="button"
                    className={`cat-pill-btn ${theme.font_style === 'normal' ? 'active' : ''}`}
                    onClick={() => handleChange('font_style', 'normal')}
                  >
                    Normal
                  </button>
                  <button
                    type="button"
                    className={`cat-pill-btn ${theme.font_style === 'italic' ? 'active' : ''}`}
                    onClick={() => handleChange('font_style', 'italic')}
                  >
                    Italic
                  </button>
                </div>
                {!findBundledFont(theme.font_family) && theme.font_style === 'italic' && (
                  <span className="control-help-hint">
                    Faux italic (browser/browser-rendered). Not in Python render.
                  </span>
                )}
              </div>

              {/* ── Text Transform ── */}
              <div className="control-group">
                <label className="group-label">Text Transform</label>
                <div className="segmented-pill-group">
                  {['none', 'uppercase', 'lowercase', 'capitalize'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`cat-pill-btn ${theme.text_transform === t ? 'active' : ''}`}
                      onClick={() => handleChange('text_transform', t as 'none' | 'uppercase' | 'lowercase' | 'capitalize')}
                    >
                      {t === 'none' ? 'None' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Font Size ── */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Font Size</label>
                  <span className="group-value-pill">{theme.font_size}px</span>
                </div>
                <input 
                  type="range" 
                  min="24" 
                  max="144" 
                  value={theme.font_size} 
                  onChange={(e) => handleChange('font_size', parseInt(e.target.value))} 
                  className="pro-range"
                />
              </div>

              {/* ── Alignment ── */}
              <div className="control-group">
                <label className="group-label">Text Alignment</label>
                <div className="segmented-align-buttons">
                  <button 
                    type="button"
                    className={`align-btn ${theme.lyric_position === 'left' ? 'active' : ''}`}
                    onClick={() => handleChange('lyric_position', 'left')}
                    title="Align Left"
                  >
                    <AlignLeft size={16} />
                    <span>Left</span>
                  </button>
                  <button 
                    type="button"
                    className={`align-btn ${theme.lyric_position === 'center' ? 'active' : ''}`}
                    onClick={() => handleChange('lyric_position', 'center')}
                    title="Align Center"
                  >
                    <AlignCenter size={16} />
                    <span>Center</span>
                  </button>
                  <button 
                    type="button"
                    className={`align-btn ${theme.lyric_position === 'right' ? 'active' : ''}`}
                    onClick={() => handleChange('lyric_position', 'right')}
                    title="Align Right"
                  >
                    <AlignRight size={16} />
                    <span>Right</span>
                  </button>
                </div>
              </div>

              {/* ── Primary Text Color ── */}
              <div className="control-group">
                <label className="group-label">Main Text Color</label>
                <div className="color-picker-row">
                  <input 
                    type="color" 
                    value={theme.text_color} 
                    onChange={(e) => handleChange('text_color', e.target.value)} 
                    className="pro-color-swatch"
                  />
                  <input 
                    type="text" 
                    value={theme.text_color} 
                    onChange={(e) => handleChange('text_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* ── Line & Letter Spacing ── */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Line Spacing</label>
                  <span className="group-value-pill">{theme.line_spacing.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="1.0" 
                  max="3.0" 
                  step="0.1" 
                  value={theme.line_spacing} 
                  onChange={(e) => handleChange('line_spacing', parseFloat(e.target.value))} 
                  className="pro-range"
                />
              </div>

              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Letter Spacing</label>
                  <span className="group-value-pill">{theme.letter_spacing}px</span>
                </div>
                <input 
                  type="range" 
                  min="-10" 
                  max="50" 
                  step="1" 
                  value={theme.letter_spacing} 
                  onChange={(e) => handleChange('letter_spacing', parseInt(e.target.value))} 
                  className="pro-range"
                />
              </div>

              {/* ── Text Stroke ── */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Active Stroke Width</label>
                  <span className="group-value-pill">{theme.active_text_stroke_width}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="20" 
                  value={theme.active_text_stroke_width} 
                  onChange={(e) => handleChange('active_text_stroke_width', parseInt(e.target.value))} 
                  className="pro-range"
                />
                <div className="color-picker-row mt-2">
                  <span className="sub-label">Stroke Color:</span>
                  <input 
                    type="color" 
                    value={theme.active_text_stroke_color} 
                    onChange={(e) => handleChange('active_text_stroke_color', e.target.value)} 
                    className="pro-color-swatch-sm"
                  />
                  <input 
                    type="text" 
                    value={theme.active_text_stroke_color} 
                    onChange={(e) => handleChange('active_text_stroke_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* ── Entrance Animation (per-line, independent of highlight_mode) ── */}
              <div className="section-divider-title">
                <Type size={13} />
                <span>Entrance & Exit Animation</span>
              </div>

              <div className="control-group">
                <label className="group-label">Entrance Style</label>
                <div className="segmented-toggle-3">
                  {(['none', 'scroll', 'fade', 'slide-left', 'slide-right', 'typewriter', 'kinetic-pop', 'pop-scale', 'blur-in', 'rotate-in', 'drop-in', 'flip-up', 'wave', 'raindrop'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`toggle-option ${theme.entrance_style === s ? 'active' : ''}`}
                      onClick={() => handleChange('entrance_style', s)}
                    >
                      {s === 'none' ? 'None' : s.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <label className="group-label">Exit Style</label>
                <div className="segmented-toggle-3">
                  {(['none', 'fade-out-up', 'blur-out', 'scale-out', 'typewriter-delete'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`toggle-option ${theme.exit_style === s ? 'active' : ''}`}
                      onClick={() => handleChange('exit_style', s)}
                    >
                      {s === 'none' ? 'None' : s.replace('-', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Word Animation</label>
                  <span className="group-value-pill">{theme.word_animation}</span>
                </div>
                <div className="segmented-toggle-3">
                  {(['none', 'scale-pop', 'slide-up', 'blur-in'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`toggle-option ${theme.word_animation === s ? 'active' : ''}`}
                      onClick={() => handleChange('word_animation', s)}
                    >
                      {s === 'none' ? 'Off' : s.replace('-', ' ')}
                    </button>
                  ))}
                </div>
                {theme.word_animation !== 'none' && (
                  <div className="control-group sub-group mt-2">
                    <div className="group-header-flex">
                      <label className="group-label">Char Stagger (ms)</label>
                      <span className="group-value-pill">{theme.char_stagger_ms}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="120"
                      step="5"
                      value={theme.char_stagger_ms}
                      onChange={(e) => handleChange('char_stagger_ms', parseInt(e.target.value))}
                      className="pro-range"
                    />
                    <span className="control-help-hint">0 = words animate as a unit; {'>'}0 = per-char wave/raindrop stagger</span>
                  </div>
                )}
              </div>

              {/* ── Karaoke fill + Blend mode ── */}
              <div className="control-group">
                <label className="group-label">Karaoke Fill</label>
                <div className="segmented-pill-group">
                  <button
                    type="button"
                    className={`cat-pill-btn ${theme.karaoke_fill === 'flat' ? 'active' : ''}`}
                    onClick={() => handleChange('karaoke_fill', 'flat')}
                  >
                    Flat
                  </button>
                  <button
                    type="button"
                    className={`cat-pill-btn ${theme.karaoke_fill === 'gradient' ? 'active' : ''}`}
                    onClick={() => handleChange('karaoke_fill', 'gradient')}
                  >
                    Gradient Wipe
                  </button>
                </div>
              </div>

              <div className="control-group">
                <label className="group-label">Blend Mode</label>
                <select
                  value={theme.blend_mode}
                  onChange={(e) => handleChange('blend_mode', e.target.value)}
                  className="pro-select"
                >
                  {(['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'color-dodge', 'difference'] as const).map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1).replace('-', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Bloom + Chromatic Aberration ── */}
              <div className="section-divider-title">
                <Sparkles size={13} />
                <span>Compositor Layers</span>
              </div>

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Bloom / Glow</div>
                  <div className="toggle-desc">Bright-pass + blur + additive screen on highlights</div>
                </div>
                <input
                  type="checkbox"
                  checked={theme.bloom_enabled || false}
                  onChange={(e) => handleChange('bloom_enabled', e.target.checked)}
                  className="pro-switch"
                />
              </div>

              {theme.bloom_enabled && (
                <div className="control-group sub-group">
                  <div className="group-header-flex">
                    <label className="group-label">Bloom Intensity</label>
                    <span className="group-value-pill">{theme.bloom_intensity || 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={theme.bloom_intensity || 0}
                    onChange={(e) => handleChange('bloom_intensity', parseInt(e.target.value))}
                    className="pro-range"
                  />
                </div>
              )}

              <div className="toggle-row">
                <div>
                  <div className="toggle-label">Chromatic Aberration</div>
                  <div className="toggle-desc">RGB channel edge offset for edgy/retro look</div>
                </div>
                <input
                  type="checkbox"
                  checked={theme.chromatic_aberration || false}
                  onChange={(e) => handleChange('chromatic_aberration', e.target.checked)}
                  className="pro-switch"
                />
              </div>
            </div>
          )}

          {/* TAB 4: MOTION & ANIMATION */}
          {currentTab === 'motion' && (
            <div className="drawer-section motion-tab-content">
              <label className="group-label mb-2">Animation Engine</label>
              
              <div className="motion-styles-list">
                {[
                  { id: 'scroll', name: 'Continuous Scroll', badge: 'Classic', desc: 'Continuous smooth vertical roll synced to audio' },
                  { id: 'typewriter', name: 'Typewriter', badge: 'Retro', desc: 'Real-time letter typing effect with blinking cursor' },
                  { id: 'kinetic', name: 'Kinetic Pop', badge: 'Modern', desc: 'Punchy elastic bounce-in on each active line' },
                  { id: 'fade', name: 'Minimalist Fade', badge: 'Clean', desc: 'Subtle vertical rise with soft smooth opacity fade' },
                  { id: 'slide', name: 'Dynamic Slide', badge: 'Energetic', desc: 'Lateral entrance with high-speed deceleration' },
                ].map((style) => (
                  <div 
                    key={style.id}
                    className={`motion-style-card ${theme.animation_style === style.id ? 'active' : ''}`}
                    onClick={() => handleChange('animation_style', style.id)}
                  >
                    <div className="motion-card-top">
                      <span className="motion-name">{style.name}</span>
                      <span className="motion-badge">{style.badge}</span>
                    </div>
                    <p className="motion-desc">{style.desc}</p>
                  </div>
                ))}
              </div>

              {/* Speed Multiplier */}
              <div className="control-group mt-4">
                <div className="group-header-flex">
                  <label className="group-label">Motion Speed Multiplier</label>
                  <span className="group-value-pill">{theme.animation_speed.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="0.2" 
                  max="3.0" 
                  step="0.1" 
                  value={theme.animation_speed} 
                  onChange={(e) => handleChange('animation_speed', parseFloat(e.target.value))} 
                  className="pro-range"
                />
              </div>
            </div>
          )}

          {/* TAB 5: KARAOKE & GLOW */}
          {currentTab === 'karaoke' && (
            <div className="drawer-section karaoke-tab-content">
              {/* Highlight Mode */}
              <div className="control-group">
                <label className="group-label">Highlight Wipe Mode</label>
                <div className="segmented-toggle-3">
                  <button 
                    type="button"
                    className={`toggle-option ${theme.highlight_mode === 'line' ? 'active' : ''}`}
                    onClick={() => handleChange('highlight_mode', 'line')}
                  >
                    Line
                  </button>
                  <button 
                    type="button"
                    className={`toggle-option ${theme.highlight_mode === 'word' ? 'active' : ''}`}
                    onClick={() => handleChange('highlight_mode', 'word')}
                  >
                    Word (Karaoke)
                  </button>
                  <button 
                    type="button"
                    className={`toggle-option ${theme.highlight_mode === 'character' ? 'active' : ''}`}
                    onClick={() => handleChange('highlight_mode', 'character')}
                  >
                    Character
                  </button>
                </div>
              </div>

              {/* Active Text Color */}
              <div className="control-group">
                <label className="group-label">Active Highlight Fill</label>
                <div className="color-picker-row">
                  <input 
                    type="color" 
                    value={theme.active_text_color} 
                    onChange={(e) => handleChange('active_text_color', e.target.value)} 
                    className="pro-color-swatch"
                  />
                  <input 
                    type="text" 
                    value={theme.active_text_color} 
                    onChange={(e) => handleChange('active_text_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* Glow & Bold Styles */}
              <div className="control-group">
                <label className="group-label">Active Styling Effects</label>
                <div className="effects-toggles-row">
                  <label className="pro-checkbox-card">
                    <input 
                      type="checkbox" 
                      checked={theme.active_text_bold} 
                      onChange={(e) => handleChange('active_text_bold', e.target.checked)} 
                    />
                    <span>Bold Weight</span>
                  </label>

                  <label className="pro-checkbox-card">
                    <input 
                      type="checkbox" 
                      checked={theme.active_text_glow} 
                      onChange={(e) => handleChange('active_text_glow', e.target.checked)} 
                    />
                    <span>Neon Glow</span>
                  </label>
                </div>

                {theme.active_text_glow && (
                  <div className="color-picker-row mt-2">
                    <span className="sub-label">Glow Color:</span>
                    <input 
                      type="color" 
                      value={theme.active_glow_color || theme.active_text_color} 
                      onChange={(e) => handleChange('active_glow_color', e.target.value)} 
                      className="pro-color-swatch-sm"
                    />
                    <input 
                      type="text" 
                      value={theme.active_glow_color || theme.active_text_color} 
                      onChange={(e) => handleChange('active_glow_color', e.target.value)} 
                      className="pro-color-hex"
                    />
                  </div>
                )}
              </div>

              {/* Dim Alpha */}
              {(theme.highlight_mode === 'word' || theme.highlight_mode === 'character') && (
                <div className="control-group">
                  <div className="group-header-flex">
                    <label className="group-label">Inactive Word Dimming</label>
                    <span className="group-value-pill">{Math.round(theme.highlight_dim_alpha * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="0.8" 
                    step="0.05" 
                    value={theme.highlight_dim_alpha} 
                    onChange={(e) => handleChange('highlight_dim_alpha', parseFloat(e.target.value))} 
                    className="pro-range"
                  />
                </div>
              )}

              {/* Inactive Lines Gradient */}
              <div className="control-group">
                <label className="group-label">Context Lines Opacity</label>
                {theme.inactive_text_opacity_gradient.map((val, i) => (
                  <div key={i} className="gradient-slider-row">
                    <span className="sub-label">Line ±{i + 1}</span>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      value={val} 
                      onChange={(e) => handleGradientChange(i, parseFloat(e.target.value))} 
                      className="pro-range"
                    />
                    <span className="group-value-pill">{Math.round(val * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: CANVAS & BRAND */}
          {currentTab === 'canvas' && (
            <div className="drawer-section canvas-tab-content">
              {/* Aspect Ratio */}
              <div className="control-group">
                <label className="group-label">Aspect Ratio</label>
                <div className="aspect-options-grid">
                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '16:9' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '16:9')}
                  >
                    <Monitor size={18} />
                    <span className="aspect-title">16:9</span>
                    <span className="aspect-sub">YouTube / Desktop</span>
                  </button>

                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '9:16' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '9:16')}
                  >
                    <Smartphone size={18} />
                    <span className="aspect-title">9:16</span>
                    <span className="aspect-sub">TikTok / Reels / Shorts</span>
                  </button>

                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '1:1' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '1:1')}
                  >
                    <Square size={18} />
                    <span className="aspect-title">1:1</span>
                    <span className="aspect-sub">Square Feed</span>
                  </button>

                  <button 
                    type="button"
                    className={`aspect-option-card ${theme.aspect_ratio === '4:5' ? 'active' : ''}`}
                    onClick={() => handleChange('aspect_ratio', '4:5')}
                  >
                    <Smartphone size={18} />
                    <span className="aspect-title">4:5</span>
                    <span className="aspect-sub">Instagram Portrait</span>
                  </button>
                </div>
              </div>

              {/* Target FPS */}
              <div className="control-group">
                <label className="group-label">Export Frame Rate (FPS)</label>
                <select 
                  value={theme.fps} 
                  onChange={(e) => handleChange('fps', parseInt(e.target.value))}
                  className="pro-select"
                >
                  <option value={24}>24 FPS (Cinematic Look)</option>
                  <option value={30}>30 FPS (Standard Web Video)</option>
                  <option value={60}>60 FPS (Ultra Smooth Animation)</option>
                </select>
              </div>

              {/* Canvas Background Color */}
              <div className="control-group">
                <label className="group-label">Canvas Background Color</label>
                <div className="color-picker-row">
                  <input 
                    type="color" 
                    value={theme.background_color} 
                    onChange={(e) => handleChange('background_color', e.target.value)} 
                    className="pro-color-swatch"
                  />
                  <input 
                    type="text" 
                    value={theme.background_color} 
                    onChange={(e) => handleChange('background_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* Video Dimmer Overlay */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Background Video Dimmer</label>
                  <span className="group-value-pill">{theme.text_overlay_opacity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={theme.text_overlay_opacity} 
                  onChange={(e) => handleChange('text_overlay_opacity', parseInt(e.target.value))} 
                  className="pro-range"
                />
                <div className="color-picker-row mt-2">
                  <span className="sub-label">Overlay Tint:</span>
                  <input 
                    type="color" 
                    value={theme.text_overlay_color} 
                    onChange={(e) => handleChange('text_overlay_color', e.target.value)} 
                    className="pro-color-swatch-sm"
                  />
                  <input 
                    type="text" 
                    value={theme.text_overlay_color} 
                    onChange={(e) => handleChange('text_overlay_color', e.target.value)} 
                    className="pro-color-hex"
                  />
                </div>
              </div>

              {/* Text Column Width */}
              <div className="control-group">
                <div className="group-header-flex">
                  <label className="group-label">Text Column Width</label>
                  <span className="group-value-pill">{theme.column_width}px</span>
                </div>
                <input 
                  type="range" 
                  min="400" 
                  max="1920" 
                  step="20" 
                  value={theme.column_width} 
                  onChange={(e) => handleChange('column_width', parseInt(e.target.value))} 
                  className="pro-range"
                />
              </div>

              {/* Logo & Watermark */}
              <div className="control-group">
                <label className="group-label">Brand Logo / Watermark</label>
                <input 
                  type="text" 
                  value={theme.logo_path} 
                  placeholder="e.g. assets/logo.png" 
                  onChange={(e) => handleChange('logo_path', e.target.value)} 
                  className="pro-text-input" 
                />
                {theme.logo_path && (
                  <>
                    <div className="group-header-flex mt-2">
                      <span className="sub-label">Logo Width:</span>
                      <span className="group-value-pill">{theme.logo_width}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="50" 
                      max="800" 
                      step="10" 
                      value={theme.logo_width} 
                      onChange={(e) => handleChange('logo_width', parseInt(e.target.value))} 
                      className="pro-range"
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

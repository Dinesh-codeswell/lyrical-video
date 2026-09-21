import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Music, Upload, RefreshCw, FileJson, Video, Plus, X, Sparkles, Trash2, Settings2, Disc3, Key } from 'lucide-react';
import { Button } from '../ui/Button';
import './SongSelector.css';

export const SongSelector: React.FC<{ onSelect: (slug: string) => void }> = ({ onSelect }) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('assemblyai_api_key') || '');
  const [isEditing, setIsEditing] = useState(false);

  // New song state
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newLyrics, setNewLyrics] = useState('');
  const [creating, setCreating] = useState(false);

  // Import form state
  const [songName, setSongName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [availableBackgrounds, setAvailableBackgrounds] = useState<string[]>([]);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [autoGenerateAI, setAutoGenerateAI] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const [songsResp, bgResp] = await Promise.all([
        fetch('/api/songs'),
        fetch('/api/backgrounds')
      ]);
      const songsData = await songsResp.json();
      const bgData = await bgResp.json();
      setSongs(songsData);
      setAvailableBackgrounds(bgData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  const handleEdit = (song: Song) => {
    setSongName(song.name);
    setIsEditing(true);
    setShowImport(true);
  };

  const handleDelete = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${slug}"? This will remove all audio and lyric files.`)) {
      return;
    }

    try {
      const resp = await fetch(`/api/songs/${slug}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        fetchSongs();
        if (selectedSlug === slug) setSelectedSlug(null);
      } else {
        alert('Delete failed');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songName || (!audioFile && !isEditing)) {
      alert('Song name and Audio file are required');
      return;
    }

    setUploading(true);
    const slug = songName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    try {
      const formData = new FormData();
      formData.append('slug', slug);
      if (audioFile) formData.append('audio', audioFile);
      if (lyricsFile) formData.append('lyrics', lyricsFile);

      if (bgFile) {
        formData.append('background', bgFile);
      } else if (selectedBackground) {
        formData.append('background_preset', selectedBackground);
      }

      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (resp.ok) {
        setShowImport(false);
        setIsEditing(false);
        setSongName('');
        setAudioFile(null);
        setLyricsFile(null);
        setBgFile(null);
        setSelectedBackground(null);

        if (autoGenerateAI && !isEditing) {
          handleAIGenerate(null as any, slug);
        } else {
          fetchSongs();
        }
      } else {
        const error = await resp.json();
        alert('Action failed: ' + error.detail);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };


function parseLrcOrText(text: string): { time: number; text: string }[] {
  const timeRe = /\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
  const isLrc = timeRe.test(text);

  if (isLrc) {
    const lines: { time: number; text: string }[] = [];
    for (const rawLine of text.split('\n')) {
      const l = rawLine.trim();
      if (!l) continue;
      const matches = [...l.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g)];
      if (matches.length > 0) {
        const lyric = l.replace(/\[(\d{1,2}):(\d{2})(?:[.:](\d{2,3}))?\]/g, '').replace(/<\d{1,2}:\d{2}(?:[.:]\d{2,3})?>/g, '').trim();
        for (const m of matches) {
          const mins = parseInt(m[1]);
          const secs = parseInt(m[2]);
          const ms = m[3] ? parseFloat('0.' + m[3]) : 0;
          lines.push({ time: Math.round((mins * 60 + secs + ms) * 100) / 100, text: lyric });
        }
      }
    }
    if (lines.length > 0) {
      lines.sort((a, b) => a.time - b.time);
      return lines;
    }
  }

  // Plain text fallback: space lines by 3.5s automatically so they span the timeline
  const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return rawLines.map((l, i) => ({ time: Math.round(i * 3.5 * 10) / 10, text: l }));
}

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newLyrics) {
      alert('Title and Lyrics are required');
      return;
    }

    setCreating(true);
    const slug = newTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const parsedLines = parseLrcOrText(newLyrics);
    
    const payload = {
      title: newTitle,
      artist: newArtist,
      lyrics: parsedLines
    };
    if (payload.lyrics.length > 0) {
      payload.lyrics.push({ time: payload.lyrics[payload.lyrics.length - 1].time + 4.0, text: "" });
    }

    try {
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      formData.append('lyrics', blob, `${slug}.json`);
      formData.append('slug', slug);
      
      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (resp.ok) {
        setShowNew(false);
        setNewTitle('');
        setNewArtist('');
        setNewLyrics('');
        fetchSongs();
      } else {
        const error = await resp.json();
        alert('Creation failed: ' + error.detail);
      }
    } catch (err) {
      console.error('Creation error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleAIGenerate = async (e: React.MouseEvent | null, slug: string) => {
    if (e) e.stopPropagation();
    setLoadingAI(slug);
    try {
      const headers: Record<string, string> = {};
      const savedKey = localStorage.getItem('assemblyai_api_key');
      if (savedKey) {
        headers['x-assemblyai-key'] = savedKey;
      }

      const resp = await fetch(`/api/auto-lyrics/${slug}`, {
        method: 'POST',
        headers,
      });

      if (resp.ok) {
        fetchSongs();
        onSelect(slug);
      } else {
        const err = await resp.json();
        const detailMsg = err.detail || 'Failed to generate AI lyrics';
        if (detailMsg.toLowerCase().includes('api key') || detailMsg.toLowerCase().includes('assemblyai')) {
          setShowApiKeyModal(true);
        }
        alert('AI Notice: ' + detailMsg);
      }
    } catch (err) {
      console.error('AI Request failed:', err);
      alert('AI Request failed. Please check network connection.');
    } finally {
      setLoadingAI(null);
    }
  };

  return (
    <div className="song-selector">
      <div className="selector-actions">
        <Button variant="ghost" size="sm" onClick={fetchSongs} disabled={loading} title="Refresh Songs">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New
        </Button>
        <Button variant="ghost" size="sm" className="import-btn" onClick={() => setShowImport(true)}>
          <Upload size={14} /> Import
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowApiKeyModal(true)}
          title={apiKey ? "AssemblyAI API Key Configured" : "Configure AssemblyAI API Key"}
          style={{ color: apiKey ? 'var(--electric-blue, #00f3ff)' : 'var(--soft-stone, #9ca3af)' }}
        >
          <Key size={14} />
        </Button>
      </div>

      <div className="song-list">
        {songs.length === 0 && !loading && (
          <div className="empty-songs-studio">
            <div className="empty-disc-halo">
              <Disc3 size={32} className="spin-slow" />
            </div>
            <h4 className="empty-title">Media Bin is Empty</h4>
            <p className="empty-desc">
              No audio tracks loaded yet. Import an MP3/WAV or stem track to synchronize with lyrics.
            </p>
            <div className="empty-actions">
              <button 
                type="button"
                className="empty-cta-btn primary"
                onClick={() => setShowImport(true)}
              >
                <Upload size={13} />
                <span>Import Audio & Lyrics</span>
              </button>
              <button 
                type="button"
                className="empty-cta-btn ghost"
                onClick={() => setShowNew(true)}
              >
                <Plus size={13} />
                <span>Create New Project</span>
              </button>
            </div>
            <div className="empty-drop-hint">
              <span>Supports .mp3, .wav, .lrc, .srt</span>
            </div>
          </div>
        )}
        
        {songs.map((song) => {
          const isLoadable = song.has_audio || song.has_lyrics;
          const isProcessing = loadingAI === song.name;

          return (
            <div 
              key={song.name} 
              className={`song-item ${selectedSlug === song.name ? 'selected' : ''} ${!isLoadable ? 'incomplete' : ''}`}
              onClick={() => setSelectedSlug(song.name)}
            >
              <div className="song-info">
                <div className="song-main">
                  <div className="song-name">{song.name}</div>
                  <div className="song-status">
                    <Music size={12} className={song.has_audio ? 'ready' : 'missing'} />
                    <FileJson size={12} className={song.has_lyrics ? 'ready' : 'missing'} />
                  </div>
                </div>
                
                <div className="song-actions">
                  <button 
                    className="action-icon-btn edit" 
                    onClick={(e) => { e.stopPropagation(); handleEdit(song); }}
                    title="Edit/Reconfigure Song"
                  >
                    <Settings2 size={14} />
                  </button>
                  <button 
                    className="action-icon-btn delete" 
                    onClick={(e) => handleDelete(e, song.name)}
                    title="Delete Song"
                  >
                    <Trash2 size={14} />
                  </button>

                  {song.has_audio && !song.has_lyrics && (
                    <button 
                      className={`ai-magic-btn ${isProcessing ? 'loading' : ''}`} 
                      onClick={(e) => handleAIGenerate(e, song.name)}
                      disabled={!!loadingAI}
                      title="AI Auto-Generate Lyrics"
                    >
                      {isProcessing ? <RefreshCw size={14} className="spin" /> : <Sparkles size={14} />}
                      <span className="btn-label">{isProcessing ? 'Thinking...' : 'Magic'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="load-action">
        <Button 
          variant="primary" 
          disabled={!selectedSlug || (!songs.find(s => s.name === selectedSlug)?.has_audio && !songs.find(s => s.name === selectedSlug)?.has_lyrics)}
          onClick={() => selectedSlug && onSelect(selectedSlug)}
          style={{ width: '100%' }}
        >
          Load Song
        </Button>
      </div>

      {showNew && typeof document !== 'undefined' && createPortal(
        <div 
          className="import-modal-overlay" 
          onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}
        >
          <div className="import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Song from Text</h3>
              <button type="button" onClick={() => setShowNew(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateNew} className="import-form">
              <div className="form-group">
                <label>Song Title</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. My Great Song" />
              </div>
              <div className="form-group">
                <label>Artist (Optional)</label>
                <input type="text" value={newArtist} onChange={(e) => setNewArtist(e.target.value)} placeholder="e.g. Artist Name" />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Lyrics (one per line or pasted .lrc)</label>
                  <span style={{ fontSize: '10px', background: 'rgba(0, 243, 255, 0.1)', color: 'var(--electric-blue)', padding: '2px 6px', borderRadius: '4px' }}>
                    Auto-detects [mm:ss]
                  </span>
                </div>
                <textarea 
                  value={newLyrics} 
                  onChange={(e) => setNewLyrics(e.target.value)} 
                  placeholder="Paste lyrics here (plain text line-by-line, or [00:12.34] timestamped LRC)..."
                  rows={8}
                  className="text-area"
                />
              </div>
              <div className="modal-footer">
                <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Lyrics'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showImport && typeof document !== 'undefined' && createPortal(
        <div 
          className="import-modal-overlay" 
          onClick={(e) => { 
            if (e.target === e.currentTarget) { 
              setShowImport(false); 
              setIsEditing(false); 
              setSongName(''); 
            } 
          }}
        >
          <div className="import-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isEditing ? 'Re-Configure Song' : 'Import Song'}</h3>
              <button type="button" onClick={() => { setShowImport(false); setIsEditing(false); setSongName(''); }}><X size={18} /></button>
            </div>
            <form onSubmit={handleImport} className="import-form">
              <div className="form-group">
                <label>Song Name</label>
                <input 
                  type="text" 
                  value={songName} 
                  onChange={(e) => setSongName(e.target.value)} 
                  placeholder="e.g. My Great Song"
                  readOnly={isEditing}
                />
              </div>
              <div className="form-group">
                <label>Audio File (MP3/WAV)</label>
                <input type="file" accept=".mp3,.wav" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              </div>

              <div className="ai-magic-option">
                <label className="checkbox-label magic-highlight">
                  <input 
                    type="checkbox" 
                    checked={autoGenerateAI} 
                    onChange={(e) => setAutoGenerateAI(e.target.checked)} 
                  />
                  <Sparkles size={14} />
                  <span>Auto-generate lyrics using AI</span>
                </label>
              </div>

              <div className="form-group separator">
                <div className="divider-text">OR UPLOAD MANUALLY</div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ margin: 0 }}>Lyrics File (Optional)</label>
                  <span style={{ fontSize: '10px', background: 'rgba(0, 243, 255, 0.1)', color: 'var(--electric-blue)', padding: '2px 6px', borderRadius: '4px' }}>
                    JSON / LRC / SRT / VTT
                  </span>
                </div>
                <input 
                  type="file" 
                  accept=".json,.lrc,.srt,.vtt,.txt" 
                  onChange={(e) => setLyricsFile(e.target.files?.[0] || null)} 
                />
              </div>
              <div className="form-group">
                <label>Background Video (Optional)</label>
                <div className="bg-selector-grid">
                  {availableBackgrounds.map((bg) => (
                    <div 
                      key={bg} 
                      className={`bg-option ${selectedBackground === bg ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBackground(bg);
                        setBgFile(null);
                      }}
                      title={bg}
                    >
                      <div className="bg-preview-box">
                        <Video size={20} />
                      </div>
                      <span className="bg-name">{bg}</span>
                    </div>
                  ))}
                  
                  <div 
                    className={`bg-option custom-add ${bgFile ? 'selected' : ''}`}
                    onClick={() => document.getElementById('custom-bg-input')?.click()}
                  >
                    <div className="bg-preview-box">
                      {bgFile ? <Video size={20} className="ready" /> : <Plus size={24} />}
                    </div>
                    <span className="bg-name">{bgFile ? bgFile.name : 'Upload New'}</span>
                    <input 
                      id="custom-bg-input"
                      type="file" 
                      accept="video/*" 
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          setBgFile(file);
                          setSelectedBackground(null);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="ghost" onClick={() => setShowImport(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Import Song'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showApiKeyModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="import-modal-overlay" 
          onClick={(e) => { if (e.target === e.currentTarget) setShowApiKeyModal(false); }}
        >
          <div className="import-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} style={{ color: 'var(--electric-blue, #00f3ff)' }} />
                <h3>AssemblyAI Configuration</h3>
              </div>
              <button type="button" onClick={() => setShowApiKeyModal(false)}><X size={18} /></button>
            </div>
            <div className="import-form" style={{ gap: '16px' }}>
              <p style={{ fontSize: '13px', color: 'var(--soft-stone, #9ca3af)', lineHeight: 1.5, margin: 0 }}>
                Automatic AI transcription requires an AssemblyAI API key. You can get a free API key at{' '}
                <a 
                  href="https://www.assemblyai.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  style={{ color: 'var(--electric-blue, #00f3ff)', textDecoration: 'underline' }}
                >
                  assemblyai.com
                </a>.
              </p>
              <div className="form-group">
                <label>AssemblyAI API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="Paste your AssemblyAI API Key here..." 
                  autoFocus
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '4px' }}>
                <Button type="button" variant="ghost" onClick={() => setShowApiKeyModal(false)}>Cancel</Button>
                <Button 
                  type="button" 
                  variant="primary" 
                  onClick={() => {
                    localStorage.setItem('assemblyai_api_key', apiKey.trim());
                    setShowApiKeyModal(false);
                  }}
                >
                  Save Key
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

interface Song {
  name: string;
  has_lyrics: boolean;
  has_audio: boolean;
  is_loadable: boolean;
}

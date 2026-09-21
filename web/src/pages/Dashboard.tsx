import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { 
  Save, Undo, Redo, Download, HelpCircle, Maximize, Eye, EyeOff, 
  CheckCircle2, FolderPlus, Palette, Type, Wand2, Mic2, SlidersHorizontal
} from 'lucide-react';
import { StudioDrawer } from '../components/dashboard/StudioDrawer';
import type { StudioTab } from '../components/dashboard/StudioDrawer';
import { WebTimeline } from '../components/dashboard/WebTimeline';
import { DEFAULTS } from '../types';
import type { Theme, LyricClip, Marker } from '../types';
import './Dashboard.css';

const PRODUCTION_ERROR = 'Synchronizing with production services... This may take a moment if the server is waking up.';
const DEVELOPMENT_ERROR = 'Backend server unreachable. Please start the API using .\\venv\\Scripts\\python.exe -m src.api.main';

export const Dashboard: React.FC = () => {
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [songPaths, setSongPaths] = useState<any>(null);
  const [clips, setClips] = useState<LyricClip[]>([]);
  const [theme, setTheme] = useState<Theme>(DEFAULTS);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [songMetadata, setSongMetadata] = useState({ title: '', artist: '' });
  const [apiError, setApiError] = useState<string | null>(null);
  const [showSafeZones, setShowSafeZones] = useState(false);

  // Studio Track Visibility & Mute States
  const [isVideoVisible, setIsVideoVisible] = useState(true);
  const [isLyricsVisible, setIsLyricsVisible] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);

  // Section-Wise Studio Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [activeDrawerTab, setActiveDrawerTab] = useState<StudioTab>('media');
  const [workspaceMode, setWorkspaceMode] = useState<'default' | 'stage-focus' | 'timeline-focus'>('default');
  const [statusNotification, setStatusNotification] = useState<string | null>(null);

  // Functional Undo / Redo History Stack
  const [historyStack, setHistoryStack] = useState<LyricClip[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Base canvas dimensions for the current aspect ratio
  const baseDims = useMemo(() => {
    switch (theme.aspect_ratio) {
      case '9:16': return { width: 1080, height: 1920 };
      case '1:1': return { width: 1080, height: 1080 };
      case '4:5': return { width: 1080, height: 1350 };
      case '16:9':
      default: return { width: 1920, height: 1080 };
    }
  }, [theme.aspect_ratio]);

  // Dynamic Scaling State
  const [previewDimensions, setPreviewDimensions] = useState({ width: 0, height: 0 });
  const previewScale = (previewDimensions.width / baseDims.width) || 0.5;
  const stageHeight = previewDimensions.height || 540;
  const lineHeight = (theme.font_size * theme.line_spacing) * previewScale;

  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setPreviewDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selectedSong) {
      const songLabel = songMetadata.artist
        ? `${songMetadata.artist} - ${songMetadata.title || selectedSong}`
        : (songMetadata.title || selectedSong);
      document.title = `LyricGen Studio — ${songLabel}`;
    } else {
      document.title = 'LyricGen Studio — Multi-Track NLE Editor';
    }
  }, [selectedSong, songMetadata]);

  const toggleFullScreen = () => {
    if (stageRef.current) {
      if (!document.fullscreenElement) {
        stageRef.current.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // History Actions (Undo / Redo)
  // ──────────────────────────────────────────────────────────────────────────

  const handleClipsChange = useCallback((newClips: LyricClip[], actionName?: string) => {
    setClips(newClips);
    if (actionName) {
      setHistoryStack(prev => {
        const nextHistory = prev.slice(0, historyIndex + 1);
        const updated = [...nextHistory, newClips];
        return updated.slice(-50); // Keep max 50 states
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    }
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setClips(historyStack[prevIdx]);
      showToast('Undo performed');
    }
  }, [historyIndex, historyStack]);

  const handleRedo = useCallback(() => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setClips(historyStack[nextIdx]);
      showToast('Redo performed');
    }
  }, [historyIndex, historyStack]);

  const showToast = (message: string) => {
    setStatusNotification(message);
    setTimeout(() => setStatusNotification(null), 2500);
  };

  // Keyboard shortcuts for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // Determine active lyric index (for highlighting ONLY)
  const activeIndex = useMemo(() => {
    if (!clips.length) return -1;
    return clips.findIndex(clip => 
      currentTime >= clip.start_time && currentTime < clip.end_time
    );
  }, [currentTime, clips]);

  // Find the index of the lyric that started most recently
  const lastStartedIndex = useMemo(() => {
    if (!clips.length) return -1;
    for (let i = clips.length - 1; i >= 0; i--) {
      if (currentTime >= clips[i].start_time) return i;
    }
    return 0;
  }, [currentTime, clips]);

  // Calculate smooth interpolation for continuous scrolling
  const scrollOffset = useMemo(() => {
    if (clips.length === 0) return 0;
    
    if (lastStartedIndex === -1 || (lastStartedIndex === 0 && currentTime < clips[0].start_time)) {
       return 0;
    }

    const i = lastStartedIndex;
    if (i >= clips.length - 1) return i * lineHeight;

    const currentClip = clips[i];
    const nextClip = clips[i + 1];
    const totalGap = nextClip.start_time - currentClip.start_time;
    
    if (totalGap <= 0) return i * lineHeight;

    const progress = (currentTime - currentClip.start_time) / totalGap;
    return (i + progress) * lineHeight;
  }, [currentTime, clips, lastStartedIndex, lineHeight]);

  // Logic to get visible lines
  const visibleLines = useMemo(() => {
    if (!selectedSong || !clips.length) return [];
    
    const centerIdx = lastStartedIndex >= 0 ? lastStartedIndex : 0;
    const range = 8;
    const start = Math.max(0, centerIdx - 4);
    const end = Math.min(clips.length, centerIdx + range);
    
    const lines = [];
    for (let i = start; i < end; i++) {
      lines.push({
        ...clips[i],
        index: i,
        y: i * lineHeight 
      });
    }
    return lines;
  }, [selectedSong, clips, lastStartedIndex, lineHeight]);

  // Animation Helpers
  const getLineStyles = (isCurrent: boolean, currentTheme: Theme): React.CSSProperties => ({
    fontSize: `${currentTheme.font_size * previewScale}px`, 
    color: isCurrent && currentTheme.highlight_mode === 'line' ? currentTheme.active_text_color : currentTheme.text_color,
    fontFamily: currentTheme.font_family,
    textAlign: currentTheme.lyric_position,
    fontWeight: (isCurrent && currentTheme.active_text_bold) ? 'bold' : 'normal',
    textShadow: (isCurrent && currentTheme.active_text_glow) ? `0 0 ${20 * previewScale}px ${currentTheme.active_glow_color || currentTheme.active_text_color}` : 'none',
    WebkitTextStroke: isCurrent ? `${currentTheme.active_text_stroke_width * previewScale}px ${currentTheme.active_text_stroke_color}` : 'none',
    letterSpacing: `${currentTheme.letter_spacing * previewScale}px`,
    maxWidth: `${currentTheme.column_width * previewScale}px`,
    width: '100%',
    padding: `0 ${40 * previewScale}px`,
  });

  const renderLineText = (line: LyricClip, isCurrent: boolean, currentTheme: Theme, time: number, activeClip: LyricClip) => {
    if (!isCurrent) return line.text;

    // Typewriter Logic
    if (currentTheme.animation_style === 'typewriter') {
      const dur = Math.max(0.1, activeClip.end_time - activeClip.start_time);
      const prog = Math.max(0, Math.min(1, (time - activeClip.start_time) / dur));
      const charCount = Math.floor(line.text.length * prog);
      return (
        <span>
          {line.text.substring(0, charCount)}
          <span className="typewriter-cursor">|</span>
        </span>
      );
    }

    // Word/Character Highlights (Karaoke mode)
    if (currentTheme.highlight_mode === 'word' || currentTheme.highlight_mode === 'character') {
      const dur = Math.max(0.1, activeClip.end_time - activeClip.start_time);
      const progress = Math.max(0, Math.min(1, (time - activeClip.start_time) / dur));
      
      if (currentTheme.highlight_mode === 'word') {
          const words = line.text.split(' ');
          const activeWordIdx = Math.floor(progress * words.length);
          return words.map((w, i) => {
            const isWordActive = i === activeWordIdx;
            const isWordDone = i < activeWordIdx;
            const wordColor = isWordActive 
              ? (currentTheme.active_glow_color || currentTheme.active_text_color)
              : (isWordDone ? currentTheme.active_text_color : currentTheme.text_color);
            const wordOpacity = (isWordActive || isWordDone) ? 1 : currentTheme.highlight_dim_alpha;

            return (
              <span 
                key={i} 
                style={{ 
                  color: wordColor,
                  opacity: wordOpacity,
                  display: 'inline-block',
                  transform: isWordActive ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.12s ease, color 0.1s ease',
                  marginRight: '0.28em'
                }}
              >
                {w}
              </span>
            );
          });
      } else if (currentTheme.highlight_mode === 'character') {
          const chars = line.text.split('');
          const activeCharIdx = Math.floor(progress * chars.length);
          return chars.map((c, i) => (
              <span 
                key={i} 
                style={{ 
                  color: i <= activeCharIdx ? currentTheme.active_text_color : currentTheme.text_color,
                  opacity: i <= activeCharIdx ? 1 : currentTheme.highlight_dim_alpha
                }}
              >
                  {c}
              </span>
          ));
      }
    }

    return line.text;
  };

  useEffect(() => {
    const checkApi = async () => {
      try {
        const resp = await fetch('/api/songs');
        if (resp.ok) setApiError(null);
        else throw new Error();
      } catch {
        setApiError(import.meta.env.PROD ? PRODUCTION_ERROR : DEVELOPMENT_ERROR);
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSongSelect = async (slug: string) => {
    setSelectedSong(slug);
    try {
      const resp = await fetch(`/api/songs/${slug}`);
      const paths = await resp.json();
      setSongPaths(paths);

      if (paths.lyrics) {
        const lyrResp = await fetch(`/api/download_raw?path=${paths.lyrics}`);
        const lyrData = await lyrResp.json();
        setSongMetadata({
          title: lyrData.title || slug,
          artist: lyrData.artist || 'Unknown Artist'
        });
        
        if (lyrData.lyrics && Array.isArray(lyrData.lyrics)) {
          const rawLyrics = lyrData.lyrics;
          const newClips: LyricClip[] = [];

          for (let i = 0; i < rawLyrics.length; i++) {
            const current = rawLyrics[i];
            if (current.text === "") continue;

            let startTime = current.time;
            if (i > 0 && startTime <= newClips[newClips.length - 1].start_time) {
              startTime = newClips[newClips.length - 1].end_time + 0.5;
            }

            let endTime = startTime + 2.0;
            if (i + 1 < rawLyrics.length) {
              const nextTime = rawLyrics[i + 1].time;
              if (nextTime > startTime) {
                endTime = nextTime;
              }
            }

            newClips.push({
              id: `clip-${i}-${Math.random().toString(36).substr(2, 9)}`,
              start_time: startTime,
              end_time: endTime,
              text: current.text
            });
          }
          setClips(newClips);
          setHistoryStack([newClips]);
          setHistoryIndex(0);
        }
      }

      if (paths.theme) {
        const themeResp = await fetch(`/api/download_raw?path=${paths.theme}`);
        const themeData = await themeResp.json();
        setTheme({ ...DEFAULTS, ...themeData });
      } else {
        setTheme(DEFAULTS);
      }

      showToast(`Loaded "${slug}" successfully`);
    } catch {
      console.error('Failed to load song details');
    }
  };

  const handleBackgroundUpdate = async (file: File) => {
    if (!selectedSong) return;
    try {
      const formData = new FormData();
      formData.append('slug', selectedSong);
      formData.append('background', file);
      
      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (resp.ok) {
        const pathsResp = await fetch(`/api/songs/${selectedSong}`);
        const paths = await pathsResp.json();
        setSongPaths(paths);
        showToast('Background video uploaded successfully');
      }
    } catch {
      console.error('Failed to update background');
    }
  };

  useEffect(() => {
    const handleNleUpload = (e: any) => handleBackgroundUpdate(e.detail);
    window.addEventListener('nle-bg-upload', handleNleUpload);
    return () => window.removeEventListener('nle-bg-upload', handleNleUpload);
  }, [selectedSong]);

  const handleExport = async () => {
    if (!selectedSong) return;
    setIsExporting(true);
    setRenderProgress(0);
    setJobId(null);
    try {
      const resp = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_slug: selectedSong,
          theme: theme,
          aspect_ratio: theme.aspect_ratio || '16:9',
          fps: theme.fps || 30
        }),
      });
      const data = await resp.json();
      setJobId(data.job_id);
      
      const poll = setInterval(async () => {
        try {
          const statusResp = await fetch(`/api/status/${data.job_id}`);
          const statusData = await statusResp.json();
          setRenderProgress(statusData.progress || 0);
          if (statusData.status === 'completed' || statusData.status === 'failed') {
            clearInterval(poll);
            setIsExporting(false);
            if (statusData.status === 'failed') alert('Export failed: ' + statusData.error);
          }
        } catch {
          console.error('Polling failed');
        }
      }, 1000);
    } catch {
      console.error('Export failed');
      setIsExporting(false);
    }
  };

  const handleSaveLyrics = async () => {
    if (!selectedSong || !songPaths?.lyrics) return;
    const payload = {
      title: songMetadata.title,
      artist: songMetadata.artist,
      lyrics: clips.map(c => ({ time: c.start_time, text: c.text })),
      theme: theme
    };
    if (clips.length > 0) {
      payload.lyrics.push({ time: clips[clips.length - 1].end_time, text: "" });
    }

    try {
      const formData = new FormData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      formData.append('lyrics', blob, `${selectedSong}.json`);
      formData.append('slug', selectedSong);
      
      await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      showToast('Lyrics & Theme saved successfully');
    } catch {
      console.error('Failed to save lyrics');
    }
  };

  return (
    <div className={`dashboard workspace-${workspaceMode}`}>
      {/* Toast Notification */}
      {statusNotification && (
        <div className="studio-toast-banner">
          <CheckCircle2 size={15} />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Main Studio Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <Link to="/" className="dashboard-brand">
            <span className="text-accent">LV</span> Studio
          </Link>
          <div className="divider"></div>
          <div className="song-title-display">
            {selectedSong ? `${songMetadata.artist} - ${songMetadata.title}` : 'Select a Song to Begin'}
          </div>
        </div>

        {/* Center: Quick Section Switcher */}
        <div className="header-section-shortcuts">
          <button 
            className={`shortcut-tab-btn ${isDrawerOpen && activeDrawerTab === 'media' ? 'active' : ''}`}
            onClick={() => { setActiveDrawerTab('media'); setIsDrawerOpen(true); }}
            title="Media Library & Import"
          >
            <FolderPlus size={14} />
            <span>Media</span>
          </button>
          <button 
            className={`shortcut-tab-btn ${isDrawerOpen && activeDrawerTab === 'presets' ? 'active' : ''}`}
            onClick={() => { setActiveDrawerTab('presets'); setIsDrawerOpen(true); }}
            title="Curated Style Presets"
          >
            <Palette size={14} />
            <span>Presets</span>
          </button>
          <button 
            className={`shortcut-tab-btn ${isDrawerOpen && activeDrawerTab === 'text' ? 'active' : ''}`}
            onClick={() => { setActiveDrawerTab('text'); setIsDrawerOpen(true); }}
            title="Typography & Text"
          >
            <Type size={14} />
            <span>Text</span>
          </button>
          <button 
            className={`shortcut-tab-btn ${isDrawerOpen && activeDrawerTab === 'motion' ? 'active' : ''}`}
            onClick={() => { setActiveDrawerTab('motion'); setIsDrawerOpen(true); }}
            title="Motion Engine"
          >
            <Wand2 size={14} />
            <span>Motion</span>
          </button>
          <button 
            className={`shortcut-tab-btn ${isDrawerOpen && activeDrawerTab === 'karaoke' ? 'active' : ''}`}
            onClick={() => { setActiveDrawerTab('karaoke'); setIsDrawerOpen(true); }}
            title="Karaoke & Glow"
          >
            <Mic2 size={14} />
            <span>Karaoke</span>
          </button>
          <button 
            className={`shortcut-tab-btn ${isDrawerOpen && activeDrawerTab === 'canvas' ? 'active' : ''}`}
            onClick={() => { setActiveDrawerTab('canvas'); setIsDrawerOpen(true); }}
            title="Canvas & Brand"
          >
            <SlidersHorizontal size={14} />
            <span>Canvas</span>
          </button>
        </div>

        <div className="header-right">
          {/* Workspace Layout Selector */}
          <div className="workspace-mode-selector">
            <button 
              className={`workspace-btn ${workspaceMode === 'stage-focus' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode(workspaceMode === 'stage-focus' ? 'default' : 'stage-focus')}
              title="Stage Focus (Large Video Preview)"
            >
              Stage Focus
            </button>
            <button 
              className={`workspace-btn ${workspaceMode === 'timeline-focus' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode(workspaceMode === 'timeline-focus' ? 'default' : 'timeline-focus')}
              title="Timeline Focus (Expanded Multi-Track)"
            >
              Timeline Focus
            </button>
          </div>

          <div className="divider"></div>

          {/* History Actions */}
          <div className="toolbar-group">
            <Button variant="ghost" size="sm" onClick={handleSaveLyrics} disabled={!selectedSong} title="Save Project">
              <Save size={14} /> Save
            </Button>
            <button 
              className={`header-action-icon-btn ${historyIndex > 0 ? 'active' : ''}`}
              onClick={handleUndo} 
              disabled={!selectedSong || historyIndex <= 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo size={14} />
            </button>
            <button 
              className={`header-action-icon-btn ${historyIndex < historyStack.length - 1 ? 'active' : ''}`}
              onClick={handleRedo} 
              disabled={!selectedSong || historyIndex >= historyStack.length - 1}
              title="Redo (Ctrl+Y)"
            >
              <Redo size={14} />
            </button>
          </div>

          <div className="divider"></div>

          <Button 
            variant="primary" 
            size="sm" 
            onClick={handleExport}
            disabled={!selectedSong || isExporting}
          >
            {isExporting ? `Rendering (${renderProgress}%)` : 'Export Video'}
          </Button>

          {jobId && !isExporting && (
            <a href={`/api/download/${jobId}`} download>
              <Button variant="ghost" size="sm" className="success-btn"><Download size={14} /> Download</Button>
            </a>
          )}
        </div>
      </header>

      {apiError && (
        <div className="api-error-banner">
          <HelpCircle size={16} />
          <span>{apiError}</span>
        </div>
      )}

      <div className="dashboard-layout">
        <main className="dashboard-main">
          {/* Top Row: Unified Studio Drawer + Maximized Preview Stage */}
          <div className="top-row">
            {/* Unified Section-Wise Studio Drawer */}
            <StudioDrawer 
              theme={theme}
              onThemeChange={setTheme}
              selectedSong={selectedSong}
              onSongSelect={handleSongSelect}
              isOpen={isDrawerOpen}
              onToggleOpen={() => setIsDrawerOpen(prev => !prev)}
              activeTab={activeDrawerTab}
              onTabChange={setActiveDrawerTab}
            />

            {/* Maximized Preview Stage */}
            <div className="preview-stage-container">
              <div className="stage-controls-bar">
                <span className="stage-aspect-tag">{theme.aspect_ratio}</span>
                {theme.aspect_ratio === '9:16' && (
                  <button
                    type="button"
                    className={`stage-tool-btn ${showSafeZones ? 'active' : ''}`}
                    onClick={() => setShowSafeZones(!showSafeZones)}
                    title="Toggle TikTok / Reels UI Safe Zones"
                  >
                    {showSafeZones ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span>Safe Zones</span>
                  </button>
                )}
                <button
                  type="button"
                  className="stage-tool-btn"
                  onClick={toggleFullScreen}
                  title="Toggle Fullscreen"
                >
                  <Maximize size={13} />
                </button>
              </div>

              <div 
                ref={stageRef}
                className={`unified-preview-stage aspect-${theme.aspect_ratio.replace(':', '-')}`} 
                style={{ 
                  backgroundColor: theme.background_color,
                  aspectRatio: theme.aspect_ratio.replace(':', '/'),
                }}
              >
                {/* Layer 1: Background Video */}
                {songPaths?.background && isVideoVisible && (
                  <video 
                    ref={bgVideoRef}
                    src={`/api/download_raw?path=${songPaths.background}`}
                    autoPlay 
                    loop 
                    muted 
                    className="compositor-layer layer-bg"
                  />
                )}

                {/* Layer 2: Theme Overlay */}
                <div 
                  className="compositor-layer layer-overlay" 
                  style={{ 
                    backgroundColor: theme.text_overlay_color,
                    opacity: theme.text_overlay_opacity / 100 
                  }} 
                />

                {/* Layer 3: Branding / Logo */}
                {theme.logo_path && (
                  <div className="compositor-layer layer-logo" style={{ textAlign: theme.logo_h_align }}>
                    <img 
                      src={`/api/download_raw?path=${theme.logo_path}`} 
                      alt="Logo"
                      style={{ width: `${theme.logo_width * previewScale}px`, height: 'auto' }}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}

                {/* Layer 4: Lyric Animation Engine */}
                {isLyricsVisible && (
                  <div className="compositor-layer layer-lyrics">
                    {theme.animation_style === 'scroll' ? (
                      <div 
                        className="lyrics-scroller"
                        style={{ 
                          transform: `translateY(${(stageHeight / 2) - scrollOffset}px)`,
                          transition: `transform ${0.3 / theme.animation_speed}s linear`
                        }}
                      >
                        {visibleLines.map((line) => {
                          const isCurrent = line.index === activeIndex;
                          const gradIdx = Math.abs(line.index - activeIndex) - 1;
                          const opacity = isCurrent ? 1 : (theme.inactive_text_opacity_gradient[gradIdx] ?? 0.1);
                          
                          return (
                            <div key={line.id} className="lyric-line-wrapper" style={{ top: `${line.y}px`, opacity }}>
                              <div className="lyric-line-text" style={getLineStyles(isCurrent, theme)}>
                                {renderLineText(line, isCurrent, theme, currentTime, clips[activeIndex])}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`lyrics-static-stage ${theme.animation_style}`}>
                        {clips[activeIndex] && (
                          <div 
                            key={clips[activeIndex].id} 
                            className="animate-current-line"
                            style={{
                              ...getLineStyles(true, theme),
                              animationDuration: `${0.5 / theme.animation_speed}s`
                            }}
                          >
                            {renderLineText(clips[activeIndex], true, theme, currentTime, clips[activeIndex])}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Layer 5: UI Overlays (Export Progress) */}
                {isExporting && (
                  <div className="compositor-layer layer-ui-overlay">
                    <div className="progress-container">
                      <div className="progress-label">RENDERING VIDEO... {renderProgress}%</div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${renderProgress}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Layer 6: Mobile Safe Zones Overlay */}
                {showSafeZones && theme.aspect_ratio === '9:16' && (
                  <div className="compositor-layer layer-safe-zones">
                    <div className="safe-zone-top-tag">Top Status Safe Area</div>
                    <div className="safe-zone-right-actions">
                      <div className="mock-action-circle" title="Profile" />
                      <div className="mock-action-circle" title="Like" />
                      <div className="mock-action-circle" title="Comment" />
                      <div className="mock-action-circle" title="Share" />
                      <div className="mock-action-disc" title="Audio Disc" />
                    </div>
                    <div className="safe-zone-bottom-desc">
                      <div className="mock-desc-line" />
                      <div className="mock-desc-line short" />
                    </div>
                  </div>
                )}

                {/* Fullscreen Trigger */}
                <button className="stage-fullscreen-btn" onClick={toggleFullScreen} title="Fullscreen Preview">
                  <Maximize size={16} />
                </button>
                
                {!selectedSong && (
                  <div className="preview-placeholder">Load a song from the Media tab to begin editing</div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Row: Pro Multi-Track Timeline */}
          <div className="timeline-area">
             <div className="unified-editor-container">
                <WebTimeline 
                  audioUrl={songPaths?.audio ? `/api/download_raw?path=${songPaths.audio}` : undefined}
                  bgUrl={songPaths?.background ? `/api/download_raw?path=${songPaths.background}` : undefined}
                  clips={clips}
                  onClipChange={handleClipsChange}
                  onTimeUpdate={setCurrentTime}
                  fps={theme.fps || 30}
                  isVideoVisible={isVideoVisible}
                  onToggleVideoVisible={() => setIsVideoVisible(v => !v)}
                  isLyricsVisible={isLyricsVisible}
                  onToggleLyricsVisible={() => setIsLyricsVisible(v => !v)}
                  isAudioMuted={isAudioMuted}
                  onToggleAudioMuted={() => setIsAudioMuted(m => !m)}
                  markers={markers}
                  onMarkersChange={setMarkers}
                />
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};

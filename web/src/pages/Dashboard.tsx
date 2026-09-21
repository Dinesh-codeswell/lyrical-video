import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Save, Undo, Redo, Download, HelpCircle, Maximize, Eye, EyeOff, 
  CheckCircle2
} from 'lucide-react';
import { StudioDrawer } from '../components/dashboard/StudioDrawer';
import type { StudioTab } from '../components/dashboard/StudioDrawer';
import { WebTimeline } from '../components/dashboard/WebTimeline';
import { DEFAULTS, VISUAL_EFFECTS } from '../types';
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

  // Visual Effects & OpenShot VFX Computation (Phase 2)
  const activeEffect = useMemo(() => {
    return VISUAL_EFFECTS.find(e => e.id === theme.active_filter);
  }, [theme.active_filter]);

  // ChromaKey Color Matrix Calculation (OpenShot ChromaKey)
  const chromaMatrixValues = useMemo(() => {
    if (!theme.chroma_key_enabled) return undefined;
    const hex = (theme.chroma_key_color || '#00ff00').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    
    const fuzzMult = 1.5 + (theme.chroma_key_fuzz || 35) / 25; // 1.9 to 4.7
    
    if (g >= r && g >= b) {
      // Key out green dominant screen
      return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 -${fuzzMult.toFixed(2)} 1 1 0`;
    } else if (b >= r && b >= g) {
      // Key out blue screen
      return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  1 1 -${fuzzMult.toFixed(2)} 1 0`;
    } else {
      // Key out red/magenta screen
      return `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -${fuzzMult.toFixed(2)} 1 1 1 0`;
    }
  }, [theme.chroma_key_enabled, theme.chroma_key_color, theme.chroma_key_fuzz]);

  const activeFilterCSS = useMemo(() => {
    const filters: string[] = [];

    // 1. OpenShot Defocus Background Blur
    if (theme.background_blur && theme.background_blur > 0) {
      filters.push(`blur(${theme.background_blur}px)`);
    }

    // 2. Curated Visual LUT / Color Filter
    if (activeEffect?.cssFilter && theme.active_filter !== 'none') {
      filters.push(activeEffect.cssFilter);
    }

    // 3. OpenShot Liquid Wave Distortion
    if (theme.wave_enabled || theme.active_filter === 'liquid-wave') {
      filters.push('url(#openshot-wave-filter)');
    }

    // 4. OpenShot ChromaKey Removal
    if (theme.chroma_key_enabled) {
      filters.push('url(#openshot-chroma-filter)');
    }

    return filters.length > 0 ? filters.join(' ') : undefined;
  }, [activeEffect, theme.active_filter, theme.background_blur, theme.wave_enabled, theme.chroma_key_enabled]);

  // OpenShot Cinematic Letterbox Bars Calculation
  const letterboxStyle = useMemo(() => {
    if (!theme.letterbox_bars || theme.letterbox_bars === 'none') return null;

    const barColor = theme.letterbox_color || '#000000';
    let targetRatio = 2.39;
    if (theme.letterbox_bars === '1.85:1') targetRatio = 1.85;
    if (theme.letterbox_bars === '4:3') targetRatio = 4 / 3;

    let frameRatio = 16 / 9;
    if (theme.aspect_ratio === '9:16') frameRatio = 9 / 16;
    if (theme.aspect_ratio === '1:1') frameRatio = 1;
    if (theme.aspect_ratio === '4:5') frameRatio = 4 / 5;

    if (targetRatio > frameRatio) {
      // Bars on top and bottom
      const visiblePercent = (frameRatio / targetRatio) * 100;
      const barHeightPercent = Math.max(0, (100 - visiblePercent) / 2);
      return {
        type: 'horizontal' as const,
        barPercent: barHeightPercent,
        color: barColor
      };
    } else {
      // Bars on left and right (pillarbox)
      const visiblePercent = (targetRatio / frameRatio) * 100;
      const barWidthPercent = Math.max(0, (100 - visiblePercent) / 2);
      return {
        type: 'vertical' as const,
        barPercent: barWidthPercent,
        color: barColor
      };
    }
  }, [theme.letterbox_bars, theme.letterbox_color, theme.aspect_ratio]);

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

  // Active Clip Transition Calculation
  const currentClip = clips[activeIndex];
  const activeTransType = currentClip?.transition || theme.active_transition || 'crossfade';
  const activeTransDuration = currentClip?.transition_duration || theme.transition_duration || 0.4;
  const timeInClip = currentClip ? Math.max(0, currentTime - currentClip.start_time) : 0;
  const isTransitioning = !!currentClip && timeInClip >= 0 && timeInClip < activeTransDuration;
  const transitionProgress = isTransitioning ? Math.min(1, Math.max(0, timeInClip / activeTransDuration)) : 1;

  const getTransitionStyle = (baseStyle: React.CSSProperties): React.CSSProperties => {
    if (!isTransitioning || activeTransType === 'none') return baseStyle;

    const res: React.CSSProperties = { ...baseStyle };

    switch (activeTransType) {
      case 'crossfade':
        res.opacity = transitionProgress;
        break;
      case 'wipe-left':
        res.clipPath = `polygon(${100 - transitionProgress * 100}% 0, 100% 0, 100% 100%, ${100 - transitionProgress * 100}% 100%)`;
        break;
      case 'wipe-right':
        res.clipPath = `polygon(0 0, ${transitionProgress * 100}% 0, ${transitionProgress * 100}% 100%, 0 100%)`;
        break;
      case 'iris-wipe':
        res.clipPath = `circle(${transitionProgress * 100}% at 50% 50%)`;
        break;
      case 'diagonal-slash':
        res.clipPath = `polygon(${Math.max(0, 100 - transitionProgress * 120)}% 0, 100% 0, 100% 100%, ${Math.max(0, 60 - transitionProgress * 120)}% 100%)`;
        break;
      case 'slide-up':
        res.transform = `translateY(${(1 - transitionProgress) * 32}px)`;
        res.opacity = transitionProgress;
        break;
      case 'push-left':
        res.transform = `translateX(${(1 - transitionProgress) * 40}px)`;
        res.opacity = transitionProgress;
        break;
      case 'zoom-punch':
        res.transform = `scale(${1 + (1 - transitionProgress) * 0.35})`;
        res.opacity = Math.min(1, transitionProgress * 1.4);
        break;
      case 'glitch-dissolve':
        if (transitionProgress < 0.7) {
          const jitterX = (Math.sin(currentTime * 50) * 4).toFixed(1);
          const jitterY = (Math.cos(currentTime * 50) * 2).toFixed(1);
          res.transform = `translate(${jitterX}px, ${jitterY}px) skewX(${jitterX}deg)`;
          res.filter = `drop-shadow(-2px 0 #ff0055) drop-shadow(2px 0 #00f2fe)`;
        }
        res.opacity = transitionProgress;
        break;
      default:
        break;
    }

    return res;
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
              clips={clips}
              onClipsChange={handleClipsChange}
            />

            {/* Maximized Preview Stage Monitor */}
            <div className="preview-stage-container">
              {/* Studio Monitor Top Bar */}
              <div className="stage-controls-bar">
                {/* Left: Brand Wordmark + Song Pill + Aspect + Safe Zones + Fullscreen */}
                <div className="stage-controls-left">
                  <Link to="/" className="stage-brand-link" title="Back to Home">
                    <span className="brand-dot-pulse" />
                    <span className="brand-name">LyricGen</span>
                  </Link>

                  <span className="stage-controls-divider" />

                  <span className="stage-song-pill" title={selectedSong ? `${songMetadata.artist} - ${songMetadata.title}` : "Select a Song"}>
                    {selectedSong 
                      ? (songMetadata.artist ? `${songMetadata.artist} - ${songMetadata.title || selectedSong}` : (songMetadata.title || selectedSong))
                      : 'No Song Selected'
                    }
                  </span>

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

                {/* Center: Workspace Focus Modes */}
                <div className="stage-controls-center">
                  <div className="workspace-mode-selector">
                    <button 
                      type="button"
                      className={`workspace-btn ${workspaceMode === 'stage-focus' ? 'active' : ''}`}
                      onClick={() => setWorkspaceMode(workspaceMode === 'stage-focus' ? 'default' : 'stage-focus')}
                      title="Stage Focus (Maximized Video Monitor)"
                    >
                      Stage Focus
                    </button>
                    <button 
                      type="button"
                      className={`workspace-btn ${workspaceMode === 'timeline-focus' ? 'active' : ''}`}
                      onClick={() => setWorkspaceMode(workspaceMode === 'timeline-focus' ? 'default' : 'timeline-focus')}
                      title="Timeline Focus (Maximized Multi-Track)"
                    >
                      Timeline Focus
                    </button>
                  </div>
                </div>

                {/* Right: Save, Undo/Redo, Export, Download */}
                <div className="stage-controls-right">
                  <button 
                    type="button"
                    className="stage-action-btn"
                    onClick={handleSaveLyrics}
                    disabled={!selectedSong}
                    title="Save Project (Ctrl+S)"
                  >
                    <Save size={13} />
                    <span>Save</span>
                  </button>

                  <div className="stage-history-group">
                    <button 
                      type="button"
                      className={`stage-icon-btn ${historyIndex > 0 ? 'active' : ''}`}
                      onClick={handleUndo} 
                      disabled={!selectedSong || historyIndex <= 0}
                      title="Undo (Ctrl+Z)"
                    >
                      <Undo size={13} />
                    </button>
                    <button 
                      type="button"
                      className={`stage-icon-btn ${historyIndex < historyStack.length - 1 ? 'active' : ''}`}
                      onClick={handleRedo} 
                      disabled={!selectedSong || historyIndex >= historyStack.length - 1}
                      title="Redo (Ctrl+Y)"
                    >
                      <Redo size={13} />
                    </button>
                  </div>

                  <span className="stage-controls-divider" />

                  {jobId && !isExporting && (
                    <a href={`/api/download/${jobId}`} download className="stage-download-link">
                      <button type="button" className="btn-stage-download" title="Download Rendered Video">
                        <Download size={13} />
                        <span>Download</span>
                      </button>
                    </a>
                  )}

                  <button 
                    type="button"
                    className={`btn-stage-export ${isExporting ? 'exporting' : ''}`}
                    onClick={handleExport}
                    disabled={!selectedSong || isExporting}
                  >
                    {isExporting ? `Rendering (${renderProgress}%)` : 'Export Video'}
                  </button>
                </div>
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
                    style={activeFilterCSS ? { filter: activeFilterCSS } : undefined}
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

                {/* Layer 2b: Visual Shaders & Film Overlays */}
                {theme.active_filter === 'film-grain' && (
                  <div className="compositor-layer layer-film-grain" />
                )}
                {theme.active_filter === 'vhs-glitch' && (
                  <div className="compositor-layer layer-vhs-scanlines" />
                )}
                {theme.active_filter === 'crt-monitor' && (
                  <div className="compositor-layer layer-crt-raster" />
                )}
                {theme.active_filter === 'prism-leak' && (
                  <div className="compositor-layer layer-prism-streak" />
                )}
                {(theme.vignette_enabled || theme.active_filter === 'cinematic-vignette') && (
                  <div className="compositor-layer layer-vignette-overlay" />
                )}
                {theme.ambient_particles && theme.ambient_particles !== 'none' && (
                  <div className={`compositor-layer layer-particles particle-${theme.ambient_particles}`}>
                    <div className="ambient-particle p-1" />
                    <div className="ambient-particle p-2" />
                    <div className="ambient-particle p-3" />
                    <div className="ambient-particle p-4" />
                    <div className="ambient-particle p-5" />
                    <div className="ambient-particle p-6" />
                  </div>
                )}

                {/* Layer 2c: Full-Frame Transition Flash, Dip & Leak Overlays */}
                {isTransitioning && activeTransType === 'dip-black' && (
                  <div 
                    className="compositor-layer layer-trans-dip-black" 
                    style={{ opacity: Math.max(0, 1 - transitionProgress * 2) }} 
                  />
                )}
                {isTransitioning && activeTransType === 'flash-white' && (
                  <div 
                    className="compositor-layer layer-trans-flash-white" 
                    style={{ opacity: Math.max(0, 1 - transitionProgress * 2.2) }} 
                  />
                )}
                {isTransitioning && activeTransType === 'light-leak' && (
                  <div 
                    className="compositor-layer layer-trans-light-leak" 
                    style={{ 
                      opacity: Math.max(0, 1 - transitionProgress * 1.6),
                      transform: `translateX(${(transitionProgress - 0.5) * 50}%)`
                    }} 
                  />
                )}

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
                          const lineStyles = getLineStyles(isCurrent, theme);
                          
                          return (
                            <div key={line.id} className="lyric-line-wrapper" style={{ top: `${line.y}px`, opacity }}>
                              <div 
                                className="lyric-line-text" 
                                style={isCurrent ? getTransitionStyle(lineStyles) : lineStyles}
                              >
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
                            style={getTransitionStyle({
                              ...getLineStyles(true, theme),
                              animationDuration: `${0.5 / theme.animation_speed}s`
                            })}
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

                {/* Layer 7: OpenShot 8-Bit Mosaic Pixelate */}
                {(theme.pixelate_enabled || theme.active_filter === 'pixelate-mosaic') && (
                  <div 
                    className="compositor-layer layer-pixelate-mosaic" 
                    style={{
                      backgroundSize: `${Math.max(4, theme.pixelate_block_size || 16)}px ${Math.max(4, theme.pixelate_block_size || 16)}px`
                    }} 
                  />
                )}

                {/* Layer 8: OpenShot Cinematic Letterbox Matte Bars */}
                {letterboxStyle && (
                  <div className="compositor-layer layer-letterbox-matte">
                    {letterboxStyle.type === 'horizontal' ? (
                      <>
                        <div 
                          className="letterbox-bar letterbox-bar-top" 
                          style={{ height: `${letterboxStyle.barPercent}%`, backgroundColor: letterboxStyle.color }} 
                        />
                        <div 
                          className="letterbox-bar letterbox-bar-bottom" 
                          style={{ height: `${letterboxStyle.barPercent}%`, backgroundColor: letterboxStyle.color }} 
                        />
                      </>
                    ) : (
                      <>
                        <div 
                          className="letterbox-bar letterbox-bar-left" 
                          style={{ width: `${letterboxStyle.barPercent}%`, backgroundColor: letterboxStyle.color }} 
                        />
                        <div 
                          className="letterbox-bar letterbox-bar-right" 
                          style={{ width: `${letterboxStyle.barPercent}%`, backgroundColor: letterboxStyle.color }} 
                        />
                      </>
                    )}
                  </div>
                )}

                {/* SVG Definitions for OpenShot GPU Filters */}
                <svg className="svg-vfx-defs" style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
                  <defs>
                    {/* OpenShot Liquid Wave Displacement */}
                    <filter id="openshot-wave-filter" x="-10%" y="-10%" width="120%" height="120%">
                      <feTurbulence 
                        type="turbulence" 
                        baseFrequency={`${0.012 * (theme.wave_speed || 1)} ${0.02 * (theme.wave_speed || 1)}`} 
                        numOctaves="2" 
                        result="waveTurbulence" 
                      />
                      <feDisplacementMap 
                        in="SourceGraphic" 
                        in2="waveTurbulence" 
                        scale={theme.wave_amplitude || 15} 
                        xChannelSelector="R" 
                        yChannelSelector="G" 
                      />
                    </filter>

                    {/* OpenShot ChromaKey Matrix */}
                    {chromaMatrixValues && (
                      <filter id="openshot-chroma-filter">
                        <feColorMatrix type="matrix" values={chromaMatrixValues} />
                      </filter>
                    )}

                    {/* OpenShot Pixelate Filter */}
                    <filter id="openshot-pixelate-filter" x="0%" y="0%" width="100%" height="100%">
                      <feFlood x="2" y="2" height="2" width="2"/>
                      <feComposite width={Math.max(4, theme.pixelate_block_size || 16)} height={Math.max(4, theme.pixelate_block_size || 16)}/>
                      <feTile result="pixelTile"/>
                      <feComposite in="SourceGraphic" in2="pixelTile" operator="in"/>
                      <feMorphology operator="dilate" radius={Math.max(1, Math.floor((theme.pixelate_block_size || 16) / 2))}/>
                    </filter>
                  </defs>
                </svg>

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
                  activeTransition={theme.active_transition}
                  onOpenTransitionsTab={() => {
                    setActiveDrawerTab('transitions');
                    if (!isDrawerOpen) setIsDrawerOpen(true);
                  }}
                />
             </div>
          </div>
        </main>
      </div>
    </div>
  );
};

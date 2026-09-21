import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import WaveSurfer from 'wavesurfer.js';
import { 
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, 
  Plus, Video, Scissors, Volume2, VolumeX, Eye, EyeOff, Lock, Unlock, 
  Magnet, Maximize2, Flag, Copy, Trash2, Edit3, Type, Layers
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { LyricClip, Marker, TransitionType } from '../../types';
import './WebTimeline.css';

interface WebTimelineProps {
  audioUrl?: string;
  bgUrl?: string;
  clips: LyricClip[];
  onClipChange: (clips: LyricClip[], actionName?: string) => void;
  onTimeUpdate: (time: number) => void;
  fps?: number;
  isVideoVisible?: boolean;
  onToggleVideoVisible?: () => void;
  isLyricsVisible?: boolean;
  onToggleLyricsVisible?: () => void;
  isAudioMuted?: boolean;
  onToggleAudioMuted?: () => void;
  markers?: Marker[];
  onMarkersChange?: (markers: Marker[]) => void;
  activeTransition?: TransitionType;
  onOpenTransitionsTab?: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
// SMPTE & Time Formatting Utilities
// ──────────────────────────────────────────────────────────────────────────────

export const formatSMPTE = (time: number, fps: number = 30, useFrames: boolean = true): string => {
  if (isNaN(time) || time < 0) time = 0;
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.floor(time % 60);
  
  if (useFrames) {
    const frames = Math.floor((time % 1) * fps);
    const frameStr = frames.toString().padStart(2, '0');
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frameStr}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frameStr}`;
  } else {
    const millis = Math.floor((time % 1) * 100);
    const milliStr = millis.toString().padStart(2, '0');
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliStr}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliStr}`;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Ruler Component
// ──────────────────────────────────────────────────────────────────────────────

interface TimelineRulerProps {
  duration: number;
  totalWidth: number;
  zoom: number;
  fps: number;
  markers: Marker[];
  onSeek: (time: number) => void;
  onMarkerClick: (time: number) => void;
  hoverTime: number | null;
}

const TimelineRuler: React.FC<TimelineRulerProps> = ({ 
  duration, 
  totalWidth,
  zoom, 
  fps, 
  markers, 
  onSeek,
  onMarkerClick,
  hoverTime 
}) => {
  const rulerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  // Dynamic tick intervals based on zoom
  let majorInterval = 5; // seconds
  let minorSubdivisions = 5;

  if (zoom >= 350) {
    majorInterval = 1;
    minorSubdivisions = 10;
  } else if (zoom >= 180) {
    majorInterval = 1;
    minorSubdivisions = 4;
  } else if (zoom >= 90) {
    majorInterval = 2;
    minorSubdivisions = 4;
  } else if (zoom >= 45) {
    majorInterval = 5;
    minorSubdivisions = 5;
  } else {
    majorInterval = 10;
    minorSubdivisions = 5;
  }

  const ticks: React.ReactNode[] = [];
  const maxTime = Math.max(duration, (totalWidth + 200) / zoom, 25);
  const minorInterval = majorInterval / minorSubdivisions;

  for (let t = 0; t <= maxTime; t += minorInterval) {
    const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs(t % majorInterval - majorInterval) < 0.001;
    const leftPx = t * zoom;

    if (isMajor) {
      ticks.push(
        <div key={`maj-${t.toFixed(2)}`} className="ruler-tick major" style={{ left: `${leftPx}px` }}>
          <span className="ruler-label">
            {formatSMPTE(t, fps, false)}
          </span>
        </div>
      );
    } else {
      ticks.push(
        <div key={`min-${t.toFixed(2)}`} className="ruler-tick minor" style={{ left: `${leftPx}px` }} />
      );
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    setIsScrubbing(true);
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, Math.min(duration, x / zoom));
    onSeek(time);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isScrubbing || !rulerRef.current) return;
      const rect = rulerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = Math.max(0, Math.min(duration, x / zoom));
      onSeek(time);
    };

    const handleMouseUp = () => {
      setIsScrubbing(false);
    };

    if (isScrubbing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, duration, zoom, onSeek]);

  return (
    <div 
      className="timeline-ruler" 
      ref={rulerRef} 
      onMouseDown={handleMouseDown}
    >
      {ticks}

      {/* Markers on Ruler */}
      {markers.map((marker, idx) => (
        <div 
          key={marker.id || idx}
          className="ruler-marker-diamond"
          style={{ left: `${marker.time * zoom}px` }}
          onClick={(e) => {
            e.stopPropagation();
            onMarkerClick(marker.time);
          }}
          title={`Marker: ${marker.text} (${formatSMPTE(marker.time, fps)})`}
        >
          <div className="diamond-shape" style={{ backgroundColor: marker.color || '#f59e0b' }} />
          <span className="marker-label-tag">{marker.text}</span>
        </div>
      ))}

      {/* Hover timestamp tooltip */}
      {hoverTime !== null && !isScrubbing && (
        <div 
          className="ruler-hover-badge" 
          style={{ left: `${hoverTime * zoom}px` }}
        >
          {formatSMPTE(hoverTime, fps)}
        </div>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────
// Edit / Add Modal
// ──────────────────────────────────────────────────────────────────────────────

const EditLyricModal: React.FC<{
  initialText: string;
  onSave: (text: string) => void;
  onCancel: () => void;
  title: string;
}> = ({ initialText, onSave, onCancel, title }) => {
  const [text, setText] = useState(initialText);
  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="lyric-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="lyric-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <textarea 
          autoFocus
          value={text} 
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter lyric text..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSave(text);
            }
          }}
        />
        <div className="modal-footer">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => onSave(text)}>Save</Button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Main WebTimeline Component
// ──────────────────────────────────────────────────────────────────────────────

export const WebTimeline: React.FC<WebTimelineProps> = ({ 
  audioUrl, 
  bgUrl,
  clips, 
  onClipChange,
  onTimeUpdate,
  fps = 30,
  isVideoVisible = true,
  onToggleVideoVisible,
  isLyricsVisible = true,
  onToggleLyricsVisible,
  isAudioMuted = false,
  onToggleAudioMuted,
  markers = [],
  onMarkersChange,
  activeTransition,
  onOpenTransitionsTab
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tracksAreaRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  // Playback & Zoom
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(120);
  const [isReady, setIsReady] = useState(false);
  const [useFramesFormat, setUseFramesFormat] = useState(true);
  const [scrollerWidth, setScrollerWidth] = useState(1400);

  useEffect(() => {
    if (!scrollRef.current) return;
    const updateWidth = () => {
      if (scrollRef.current) {
        setScrollerWidth(scrollRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  // Tools & Selection
  const [activeTool, setActiveTool] = useState<'select' | 'razor'>('select');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [isSnappingEnabled, setIsSnappingEnabled] = useState(true);
  const [snapLineTime, setSnapLineTime] = useState<number | null>(null);

  // Track Locks
  const [lockedTracks, setLockedTracks] = useState<{ video: boolean; audio: boolean; lyrics: boolean }>({
    video: false,
    audio: false,
    lyrics: false
  });

  const toggleTrackLock = (track: 'video' | 'audio' | 'lyrics') => {
    setLockedTracks(prev => ({ ...prev, [track]: !prev[track] }));
  };

  // Drag / Resize State
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [resizingClipId, setResizingClipId] = useState<string | null>(null);
  const [resizeSide, setResizingSide] = useState<'left' | 'right' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialStartTime, setInitialStartTime] = useState(0);
  const [initialEndTime, setInitialEndTime] = useState(0);

  // Hover & Scrubbing Guide
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartScroll, setPanStartScroll] = useState(0);

  // Modal State
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [addingAtTime, setAddingAtTime] = useState<number | null>(null);

  // Keep refs of props to avoid stale closures
  const clipsRef = useRef(clips);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  const onClipChangeRef = useRef(onClipChange);
  useEffect(() => { onClipChangeRef.current = onClipChange; }, [onClipChange]);

  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);

  const duration = wavesurferRef.current?.getDuration() || 0;

  // 1. Initialize Wavesurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(6, 182, 212, 0.45)',
      progressColor: '#00f2fe',
      cursorColor: 'transparent',
      height: 72,
      barWidth: 2,
      barGap: 1,
      minPxPerSec: zoom,
      interact: true,
    });

    wavesurferRef.current = ws;

    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('ready', () => {
      setIsReady(true);
      ws.zoom(zoom);
      if (isAudioMuted) ws.setMuted(true);
    });
    ws.on('timeupdate', (t) => {
      setCurrentTime(t);
      onTimeUpdateRef.current(t);
    });

    return () => {
      ws.destroy();
    };
  }, []);

  // 2. Audio URL changes
  useEffect(() => {
    if (wavesurferRef.current && audioUrl) {
      wavesurferRef.current.load(audioUrl);
      setIsReady(false);
    }
  }, [audioUrl]);

  // 3. Audio Mute changes
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.setMuted(Boolean(isAudioMuted));
    }
  }, [isAudioMuted, isReady]);

  // 4. Zoom changes
  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.zoom(zoom);
    }
  }, [zoom, isReady]);

  // 5. Seek Helper
  const seekTo = useCallback((time: number) => {
    if (!wavesurferRef.current) return;
    const dur = wavesurferRef.current.getDuration() || 1;
    const clampedTime = Math.max(0, Math.min(dur, time));
    wavesurferRef.current.setTime(clampedTime);
    setCurrentTime(clampedTime);
    onTimeUpdateRef.current(clampedTime);
  }, []);

  // 6. Magnetic Snapping Calculation
  const snapTargets = useMemo(() => {
    const targets = [0, currentTime];
    clips.forEach(c => {
      targets.push(c.start_time);
      targets.push(c.end_time);
    });
    markers.forEach(m => targets.push(m.time));
    return targets;
  }, [clips, currentTime, markers]);

  const computeSnappedTime = useCallback((rawTime: number, excludeClipId?: string): { time: number; didSnap: boolean } => {
    if (!isSnappingEnabled) return { time: rawTime, didSnap: false };
    const thresholdSec = 10 / zoom; // ~10px tolerance
    let closestTarget: number | null = null;
    let minDistance = thresholdSec;

    for (const target of snapTargets) {
      if (excludeClipId) {
        const clip = clips.find(c => c.id === excludeClipId);
        if (clip && (Math.abs(clip.start_time - target) < 0.001 || Math.abs(clip.end_time - target) < 0.001)) {
          continue;
        }
      }
      const dist = Math.abs(rawTime - target);
      if (dist < minDistance) {
        minDistance = dist;
        closestTarget = target;
      }
    }

    if (closestTarget !== null) {
      return { time: closestTarget, didSnap: true };
    }
    return { time: rawTime, didSnap: false };
  }, [isSnappingEnabled, zoom, snapTargets, clips]);

  // 7. Global Mouse Events for Drag / Resize / Middle Pan
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Middle Mouse Pan
      if (isMiddlePanning && scrollRef.current) {
        const deltaX = e.clientX - panStartX;
        scrollRef.current.scrollLeft = panStartScroll - deltaX;
        return;
      }

      if (!draggingClipId && !resizingClipId) return;

      const deltaX = e.clientX - dragStartX;
      const deltaTime = deltaX / zoom;
      let activeSnapTime: number | null = null;

      const newClips = clipsRef.current.map(c => {
        if (c.id === draggingClipId) {
          const clipDuration = initialEndTime - initialStartTime;
          let candidateStart = Math.max(0, initialStartTime + deltaTime);
          let candidateEnd = candidateStart + clipDuration;

          // Check snapping on start edge first
          const snapStart = computeSnappedTime(candidateStart, draggingClipId);
          if (snapStart.didSnap) {
            candidateStart = snapStart.time;
            activeSnapTime = snapStart.time;
          } else {
            // Check snapping on end edge
            const snapEnd = computeSnappedTime(candidateEnd, draggingClipId);
            if (snapEnd.didSnap) {
              candidateStart = Math.max(0, snapEnd.time - clipDuration);
              activeSnapTime = snapEnd.time;
            }
          }

          return { ...c, start_time: candidateStart, end_time: candidateStart + clipDuration };
        }

        if (c.id === resizingClipId) {
          if (resizeSide === 'left') {
            let candidateStart = Math.max(0, Math.min(initialStartTime + deltaTime, c.end_time - 0.1));
            const snap = computeSnappedTime(candidateStart, resizingClipId);
            if (snap.didSnap && snap.time < c.end_time - 0.1) {
              candidateStart = snap.time;
              activeSnapTime = snap.time;
            }
            return { ...c, start_time: candidateStart };
          } else {
            let candidateEnd = Math.max(c.start_time + 0.1, initialEndTime + deltaTime);
            const snap = computeSnappedTime(candidateEnd, resizingClipId);
            if (snap.didSnap && snap.time > c.start_time + 0.1) {
              candidateEnd = snap.time;
              activeSnapTime = snap.time;
            }
            return { ...c, end_time: candidateEnd };
          }
        }
        return c;
      });

      setSnapLineTime(activeSnapTime);
      onClipChangeRef.current(newClips);
    };

    const handleGlobalMouseUp = () => {
      if (draggingClipId) {
        onClipChangeRef.current(clipsRef.current, 'Move Clip');
      } else if (resizingClipId) {
        onClipChangeRef.current(clipsRef.current, 'Trim Clip');
      }
      setDraggingClipId(null);
      setResizingClipId(null);
      setResizingSide(null);
      setSnapLineTime(null);
      setIsMiddlePanning(false);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [
    draggingClipId, resizingClipId, dragStartX, zoom, resizeSide, 
    initialStartTime, initialEndTime, isMiddlePanning, panStartX, 
    panStartScroll, computeSnappedTime
  ]);

  // 8. Cursor-Anchored Wheel Zoom & Pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.altKey) {
      e.preventDefault();
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const currentScrollLeft = scrollRef.current.scrollLeft;
      const timeAtMouse = (mouseX + currentScrollLeft) / zoom;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(20, Math.min(600, Math.round(zoom * zoomFactor)));
      
      setZoom(newZoom);

      // Readjust scroll so mouse stays locked to exact time
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollLeft = Math.max(0, timeAtMouse * newZoom - mouseX);
        }
      });
    } else if (e.shiftKey) {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  // 9. Middle-Click Drag to Pan
  const handleScrollerMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // Middle click
      e.preventDefault();
      setIsMiddlePanning(true);
      setPanStartX(e.clientX);
      setPanStartScroll(scrollRef.current?.scrollLeft || 0);
    }
  };

  // 10. Fit Timeline to View
  const handleFitToView = () => {
    if (!scrollRef.current || duration <= 0) return;
    const availableWidth = scrollRef.current.clientWidth - 40;
    const optimalZoom = Math.max(20, Math.min(500, Math.floor(availableWidth / duration)));
    setZoom(optimalZoom);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  };

  // 11. Split Clip Action
  const handleSplitAtPlayhead = () => {
    if (lockedTracks.lyrics) return;
    const time = currentTime;
    const targetIdx = clipsRef.current.findIndex(c => time > c.start_time && time < c.end_time);
    if (targetIdx !== -1) {
      const target = clipsRef.current[targetIdx];
      const newClips = [...clipsRef.current];
      const clip1 = { ...target, end_time: time };
      const clip2 = { 
        ...target, 
        id: `clip-split-${Math.random().toString(36).substr(2, 9)}`,
        start_time: time 
      };
      newClips.splice(targetIdx, 1, clip1, clip2);
      onClipChange(newClips, 'Split Clip');
      setSelectedClipId(clip2.id);
    }
  };

  // 12. Duplicate Selected Clip
  const handleDuplicateSelected = () => {
    if (!selectedClipId || lockedTracks.lyrics) return;
    const target = clipsRef.current.find(c => c.id === selectedClipId);
    if (!target) return;
    const dur = target.end_time - target.start_time;
    const newClip: LyricClip = {
      id: `clip-dup-${Math.random().toString(36).substr(2, 9)}`,
      start_time: target.end_time + 0.1,
      end_time: target.end_time + 0.1 + dur,
      text: `${target.text} (Copy)`
    };
    const newClips = [...clipsRef.current, newClip].sort((a,b) => a.start_time - b.start_time);
    onClipChange(newClips, 'Duplicate Clip');
    setSelectedClipId(newClip.id);
  };

  // 13. Nudge Selected Clip
  const handleNudge = (deltaMs: number) => {
    if (!selectedClipId || lockedTracks.lyrics) return;
    const deltaSec = deltaMs / 1000;
    const newClips = clipsRef.current.map(c => {
      if (c.id === selectedClipId) {
        const dur = c.end_time - c.start_time;
        const newStart = Math.max(0, c.start_time + deltaSec);
        return { ...c, start_time: newStart, end_time: newStart + dur };
      }
      return c;
    });
    onClipChange(newClips, `Nudge Clip ${deltaMs > 0 ? '+' : ''}${deltaMs}ms`);
  };

  // 14. Delete Selected Clip
  const handleDeleteSelected = () => {
    if (!selectedClipId || lockedTracks.lyrics) return;
    onClipChange(clipsRef.current.filter(c => c.id !== selectedClipId), 'Delete Clip');
    setSelectedClipId(null);
  };

  // 15. Live Lyric Stamping
  const handleStamp = () => {
    if (lockedTracks.lyrics) return;
    const time = currentTime;
    const newClips = [...clipsRef.current];
    const idx = newClips.findIndex(c => c.start_time === 0);
    if (idx !== -1) {
      const dur = 3.0;
      newClips[idx].start_time = time;
      newClips[idx].end_time = time + dur;
      onClipChange([...newClips].sort((a,b) => a.start_time - b.start_time), 'Stamp Lyric');
    }
  };

  // 16. Add Marker at Playhead
  const handleAddMarker = () => {
    if (!onMarkersChange) return;
    const newMarker: Marker = {
      id: `mark-${Math.random().toString(36).substr(2, 9)}`,
      time: currentTime,
      text: `M${markers.length + 1}`,
      color: '#00f2fe'
    };
    onMarkersChange([...markers, newMarker]);
  };

  // 17. Step 1 Frame Forward / Backward
  const stepFrame = (frames: number) => {
    const frameDuration = 1 / fps;
    seekTo(currentTime + frames * frameDuration);
  };

  // 18. Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        wavesurferRef.current?.playPause();
      }
      // Enter: Stamp Lyric
      else if (e.key === 'Enter') {
        e.preventDefault();
        handleStamp();
      }
      // Ctrl + K: Split at Playhead
      else if (e.ctrlKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        handleSplitAtPlayhead();
      }
      // Ctrl + D: Duplicate Clip
      else if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        handleDuplicateSelected();
      }
      // Delete / Backspace: Delete selected
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }
      // 'S': Toggle Snapping
      else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setIsSnappingEnabled(prev => !prev);
        }
      }
      // 'M': Add Marker
      else if (e.key === 'm' || e.key === 'M') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          handleAddMarker();
        }
      }
      // Home / End
      else if (e.key === 'Home') {
        e.preventDefault();
        seekTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        seekTo(duration);
      }
      // Arrow Left / Right: 1 frame step
      else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (e.altKey) handleNudge(-100);
        else stepFrame(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (e.altKey) handleNudge(100);
        else stepFrame(1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, currentTime, duration, fps, lockedTracks, isSnappingEnabled, markers]);

  // 19. Track Double Click to add new clip
  const handleTrackDoubleClick = (e: React.MouseEvent) => {
    if (lockedTracks.lyrics) return;
    if ((e.target as HTMLElement).classList.contains('clips-area')) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
      const time = x / zoom;
      setAddingAtTime(time);
    }
  };

  // 20. Razor Click on Clip
  const handleClipRazorClick = (e: React.MouseEvent, clip: LyricClip) => {
    if (activeTool !== 'razor' || lockedTracks.lyrics) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const splitTime = clip.start_time + (clickX / zoom);

    if (splitTime > clip.start_time + 0.1 && splitTime < clip.end_time - 0.1) {
      const targetIdx = clipsRef.current.findIndex(c => c.id === clip.id);
      if (targetIdx !== -1) {
        const newClips = [...clipsRef.current];
        const clip1 = { ...clip, end_time: splitTime };
        const clip2 = { 
          ...clip, 
          id: `clip-split-${Math.random().toString(36).substr(2, 9)}`,
          start_time: splitTime 
        };
        newClips.splice(targetIdx, 1, clip1, clip2);
        onClipChange(newClips, 'Razor Cut Clip');
        setSelectedClipId(clip2.id);
      }
    }
  };

  const saveNewClip = (text: string) => {
    if (addingAtTime !== null) {
      const newClip: LyricClip = {
        id: `clip-add-${Math.random().toString(36).substr(2, 9)}`,
        start_time: addingAtTime,
        end_time: addingAtTime + 2.5,
        text
      };
      onClipChange([...clips, newClip].sort((a,b) => a.start_time - b.start_time), 'Add Lyric Clip');
    }
    setAddingAtTime(null);
  };

  const saveEditedClip = (text: string) => {
    if (editingClipId) {
      onClipChange(clips.map(c => c.id === editingClipId ? { ...c, text } : c), 'Edit Lyric Text');
    }
    setEditingClipId(null);
  };

  const startDragging = (e: React.MouseEvent, clip: LyricClip) => {
    if (lockedTracks.lyrics || activeTool === 'razor') return;
    e.stopPropagation();
    setDraggingClipId(clip.id);
    setDragStartX(e.clientX);
    setInitialStartTime(clip.start_time);
    setInitialEndTime(clip.end_time);
    setSelectedClipId(clip.id);
  };

  const startResizing = (e: React.MouseEvent, clip: LyricClip, side: 'left' | 'right') => {
    if (lockedTracks.lyrics) return;
    e.stopPropagation();
    setResizingClipId(clip.id);
    setResizingSide(side);
    setDragStartX(e.clientX);
    setInitialStartTime(clip.start_time);
    setInitialEndTime(clip.end_time);
    setSelectedClipId(clip.id);
  };

  // Hover Time Tracker for Ghost Cursor
  const handleTracksMouseMove = (e: React.MouseEvent) => {
    if (!tracksAreaRef.current) return;
    const rect = tracksAreaRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = Math.max(0, Math.min(duration, x / zoom));
    setHoverTime(t);
  };

  const handleTracksMouseLeave = () => {
    setHoverTime(null);
  };

  const activeIndex = clips.findIndex(c => currentTime >= c.start_time && currentTime < c.end_time);
  const totalContainerWidth = Math.max(duration * zoom, scrollerWidth);

  return (
    <div className={`web-timeline nle-editor tool-${activeTool}`}>
      {addingAtTime !== null && (
        <EditLyricModal 
          title="Add New Lyric Clip" 
          initialText="" 
          onSave={saveNewClip} 
          onCancel={() => setAddingAtTime(null)} 
        />
      )}
      {editingClipId !== null && (
        <EditLyricModal 
          title="Edit Lyric Text" 
          initialText={clips.find(c => c.id === editingClipId)?.text || ""} 
          onSave={saveEditedClip} 
          onCancel={() => setEditingClipId(null)} 
        />
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. Pro NLE Control Toolbar */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="timeline-toolbar">
        {/* Left: Transport Controls & SMPTE Timecode */}
        <div className="toolbar-left">
          <div className="transport-controls">
            <button 
              className="transport-btn" 
              onClick={() => seekTo(0)} 
              title="Jump to Start (Home)"
            >
              <SkipBack size={15} />
            </button>
            <button 
              className="transport-btn" 
              onClick={() => stepFrame(-1)} 
              title="Step -1 Frame (Left Arrow)"
            >
              <ChevronLeft size={15} />
            </button>
            <button 
              className={`transport-btn play-btn ${isPlaying ? 'playing' : ''}`} 
              onClick={() => wavesurferRef.current?.playPause()} 
              title="Play / Pause (Space)"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button 
              className="transport-btn" 
              onClick={() => stepFrame(1)} 
              title="Step +1 Frame (Right Arrow)"
            >
              <ChevronRight size={15} />
            </button>
            <button 
              className="transport-btn" 
              onClick={() => seekTo(duration)} 
              title="Jump to End (End)"
            >
              <SkipForward size={15} />
            </button>
          </div>

          <div 
            className="time-readout-box" 
            onClick={() => setUseFramesFormat(!useFramesFormat)} 
            title="Click to toggle SMPTE Frames / Milliseconds"
          >
            <span className="time-format-tag">{useFramesFormat ? 'SMPTE' : 'SEC'}</span>
            <span className="time-digits">{formatSMPTE(currentTime, fps, useFramesFormat)}</span>
          </div>

          <div className="divider-v" />

          {/* Stamp Button for Live Sync */}
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleStamp} 
            className="stamp-btn"
            title="Stamp current playhead time to next unsynced lyric (Enter)"
          >
            Stamp (Enter)
          </Button>
        </div>

        {/* Center: Editing Tools */}
        <div className="toolbar-center">
          <div className="tool-selector">
            <button 
              className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => setActiveTool('select')}
              title="Selection Tool (V)"
            >
              <Type size={14} />
              <span>Select</span>
            </button>
            <button 
              className={`tool-btn ${activeTool === 'razor' ? 'active' : ''}`}
              onClick={() => setActiveTool('razor')}
              title="Razor Cut Tool (C)"
            >
              <Scissors size={14} />
              <span>Razor</span>
            </button>
          </div>

          <div className="divider-v" />

          <div className="edit-actions">
            <button 
              className="edit-action-btn" 
              onClick={handleSplitAtPlayhead} 
              disabled={activeIndex === -1 || lockedTracks.lyrics}
              title="Split Clip at Playhead (Ctrl+K)"
            >
              <Scissors size={14} />
              <span>Split</span>
            </button>
            <button 
              className="edit-action-btn" 
              onClick={() => handleNudge(-100)} 
              disabled={!selectedClipId || lockedTracks.lyrics}
              title="Nudge Left -100ms (Alt+Left)"
            >
              -100ms
            </button>
            <button 
              className="edit-action-btn" 
              onClick={() => handleNudge(100)} 
              disabled={!selectedClipId || lockedTracks.lyrics}
              title="Nudge Right +100ms (Alt+Right)"
            >
              +100ms
            </button>
            <button 
              className="edit-action-btn" 
              onClick={handleDuplicateSelected} 
              disabled={!selectedClipId || lockedTracks.lyrics}
              title="Duplicate Clip (Ctrl+D)"
            >
              <Copy size={14} />
            </button>
            <button 
              className="edit-action-btn danger" 
              onClick={handleDeleteSelected} 
              disabled={!selectedClipId || lockedTracks.lyrics}
              title="Delete Clip (Del)"
            >
              <Trash2 size={14} />
            </button>
            <button 
              className="edit-action-btn" 
              onClick={handleAddMarker} 
              title="Add Marker at Playhead (M)"
            >
              <Flag size={14} />
            </button>
            <button 
              className={`edit-action-btn magnet ${isSnappingEnabled ? 'active' : ''}`}
              onClick={() => setIsSnappingEnabled(!isSnappingEnabled)}
              title="Magnetic Snapping (S)"
            >
              <Magnet size={14} />
            </button>
          </div>
        </div>

        {/* Right: Precision Zoom Controls */}
        <div className="toolbar-right">
          <button 
            className="zoom-action-btn" 
            onClick={handleFitToView} 
            title="Fit Entire Timeline to Window"
          >
            <Maximize2 size={14} />
          </button>
          <div className="zoom-slider-container">
            <button 
              className="zoom-step-btn" 
              onClick={() => setZoom(Math.max(20, zoom - 20))}
              title="Zoom Out"
            >
              -
            </button>
            <input 
              type="range" 
              min={20} 
              max={500} 
              value={zoom} 
              onChange={(e) => setZoom(Number(e.target.value))}
              className="nle-zoom-slider"
              title="Timeline Zoom Level"
            />
            <button 
              className="zoom-step-btn" 
              onClick={() => setZoom(Math.min(500, zoom + 20))}
              title="Zoom In"
            >
              +
            </button>
          </div>
          <span className="zoom-readout-tag">{zoom} px/s</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. Main Timeline Body: Track Headers (Left) + Scroller (Right) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div className="timeline-body">
        {/* Fixed Track Headers Bar (Left Column) */}
        <div className="track-headers-column">
          <div className="header-ruler-spacer">
            <span className="tracks-title">TRACKS</span>
          </div>

          {/* V1: Background Video */}
          <div className="track-header-item">
            <div className="header-identity">
              <span className="track-badge badge-video">V1</span>
              <span className="track-name">Video</span>
            </div>
            <div className="header-actions">
              <button 
                className={`header-tool-btn ${!isVideoVisible ? 'muted' : ''}`}
                onClick={onToggleVideoVisible}
                title={isVideoVisible ? 'Hide Background Video' : 'Show Background Video'}
              >
                {isVideoVisible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button 
                className={`header-tool-btn ${lockedTracks.video ? 'locked' : ''}`}
                onClick={() => toggleTrackLock('video')}
                title={lockedTracks.video ? 'Unlock Track' : 'Lock Track'}
              >
                {lockedTracks.video ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
          </div>

          {/* A1: Master Audio */}
          <div className="track-header-item">
            <div className="header-identity">
              <span className="track-badge badge-audio">A1</span>
              <span className="track-name">Audio</span>
            </div>
            <div className="header-actions">
              <button 
                className={`header-tool-btn ${isAudioMuted ? 'muted' : ''}`}
                onClick={onToggleAudioMuted}
                title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isAudioMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
              <button 
                className={`header-tool-btn ${lockedTracks.audio ? 'locked' : ''}`}
                onClick={() => toggleTrackLock('audio')}
                title={lockedTracks.audio ? 'Unlock Track' : 'Lock Track'}
              >
                {lockedTracks.audio ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
          </div>

          {/* T1: Lyrics Subtitles */}
          <div className="track-header-item">
            <div className="header-identity">
              <span className="track-badge badge-lyrics">T1</span>
              <span className="track-name">Lyrics</span>
              <span className="clip-count-pill">{clips.length}</span>
            </div>
            <div className="header-actions">
              <button 
                className={`header-tool-btn ${!isLyricsVisible ? 'muted' : ''}`}
                onClick={onToggleLyricsVisible}
                title={isLyricsVisible ? 'Hide Lyrics Overlay' : 'Show Lyrics Overlay'}
              >
                {isLyricsVisible ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              <button 
                className={`header-tool-btn ${lockedTracks.lyrics ? 'locked' : ''}`}
                onClick={() => toggleTrackLock('lyrics')}
                title={lockedTracks.lyrics ? 'Unlock Track' : 'Lock Track'}
              >
                {lockedTracks.lyrics ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Tracks Area */}
        <div 
          className="timeline-scroller" 
          ref={scrollRef}
          onWheel={handleWheel}
          onMouseDown={handleScrollerMouseDown}
        >
          <div 
            className="tracks-container" 
            ref={tracksAreaRef}
            style={{ width: `${totalContainerWidth}px`, minWidth: '100%' }}
            onMouseMove={handleTracksMouseMove}
            onMouseLeave={handleTracksMouseLeave}
          >
            {/* 1. Time Ruler */}
            <TimelineRuler 
              duration={duration} 
              totalWidth={totalContainerWidth}
              zoom={zoom} 
              fps={fps}
              markers={markers}
              onSeek={seekTo}
              onMarkerClick={seekTo}
              hoverTime={hoverTime}
            />

            {/* 2. Track V1: Video Background */}
            <div className={`track video-track ${lockedTracks.video ? 'track-locked' : ''}`}>
              <div className="clips-area">
                {bgUrl ? (
                  <div 
                    className="video-clip"
                    style={{ 
                      left: 0, 
                      width: `${(duration || 10) * zoom}px` 
                    }}
                  >
                    <div className="clip-content">
                      <Video size={13} />
                      <span className="clip-text">Background Video ({formatSMPTE(duration, fps, false)})</span>
                    </div>
                    <button 
                      className="change-bg-btn" 
                      onClick={() => document.getElementById('nle-bg-input')?.click()} 
                      title="Change Video Background"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="empty-track-prompt" onClick={() => document.getElementById('nle-bg-input')?.click()}>
                    <Plus size={14} /> Add Background Video
                  </div>
                )}
                <input 
                  id="nle-bg-input"
                  type="file" 
                  accept="video/*" 
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const event = new CustomEvent('nle-bg-upload', { detail: file });
                      window.dispatchEvent(event);
                    }
                  }}
                />
              </div>
            </div>

            {/* 3. Track A1: Audio Waveform */}
            <div className={`track audio-track ${lockedTracks.audio ? 'track-locked' : ''}`}>
              <div className="waveform-wrapper" ref={containerRef} />
            </div>

            {/* 4. Track T1: Lyrics Subtitles */}
            <div 
              className={`track lyrics-track ${lockedTracks.lyrics ? 'track-locked' : ''}`}
            >
              <div 
                className="clips-area" 
                onDoubleClick={handleTrackDoubleClick}
                onClick={(e) => {
                  if ((e.target as HTMLElement).classList.contains('clips-area')) {
                    setSelectedClipId(null);
                  }
                }}
              >
                {clips.map((clip, idx) => {
                  const clipDuration = clip.end_time - clip.start_time;
                  const isSelected = selectedClipId === clip.id;
                  const isCurrent = currentTime >= clip.start_time && currentTime < clip.end_time;
                  const nextClip = clips[idx + 1];
                  const hasAdjacentNext = nextClip && (nextClip.start_time - clip.end_time) < 2.0;

                  return (
                    <React.Fragment key={clip.id}>
                      <div 
                        className={`lyric-clip ${isSelected ? 'selected' : ''} ${isCurrent ? 'active-playing' : ''}`}
                        style={{ 
                          left: `${clip.start_time * zoom}px`, 
                          width: `${Math.max(16, clipDuration * zoom)}px` 
                        }}
                        onMouseDown={(e) => startDragging(e, clip)}
                        onClick={(e) => handleClipRazorClick(e, clip)}
                        onDoubleClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingClipId(clip.id); 
                        }}
                      >
                        {/* Left Trim Handle */}
                        {!lockedTracks.lyrics && (
                          <div 
                            className="resize-handle left" 
                            onMouseDown={(e) => startResizing(e, clip, 'left')}
                            title="Trim Left Edge"
                          >
                            <div className="handle-notch" />
                          </div>
                        )}

                        {/* Clip Body */}
                        <div className="clip-content">
                          <div className="clip-meta-tag">
                            <span className="clip-duration-tag">{clipDuration.toFixed(2)}s</span>
                            {clip.transition && clip.transition !== 'none' && (
                              <span className="clip-transition-pill" title={`Transition: ${clip.transition}`}>
                                ⚡ {clip.transition}
                              </span>
                            )}
                          </div>
                          <span className="clip-text">{clip.text || '...'}</span>
                        </div>

                        {/* Quick Edit Pencil */}
                        <button 
                          className="clip-quick-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClipId(clip.id);
                          }}
                          title="Edit Text"
                        >
                          <Edit3 size={10} />
                        </button>

                        {/* Right Trim Handle */}
                        {!lockedTracks.lyrics && (
                          <div 
                            className="resize-handle right" 
                            onMouseDown={(e) => startResizing(e, clip, 'right')}
                            title="Trim Right Edge"
                          >
                            <div className="handle-notch" />
                          </div>
                        )}
                      </div>

                      {/* Inter-Clip Transition Node */}
                      {hasAdjacentNext && (
                        <div
                          className="clip-transition-node"
                          style={{
                            left: `${clip.end_time * zoom}px`
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenTransitionsTab) onOpenTransitionsTab();
                          }}
                          title={`Transition: ${(clip.transition || activeTransition || 'crossfade').toUpperCase()} (Click to open Transitions panel)`}
                        >
                          <div className="transition-node-bowtie">
                            <Layers size={9} />
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* 5. Snapping Guide Line (Neon Laser Line) */}
            {snapLineTime !== null && (
              <div 
                className="magnetic-snap-guide" 
                style={{ left: `${snapLineTime * zoom}px` }}
              >
                <div className="snap-time-tag">{formatSMPTE(snapLineTime, fps)}</div>
              </div>
            )}

            {/* 6. Phantom / Ghost Hover Cursor */}
            {hoverTime !== null && (
              <div 
                className="phantom-hover-guide" 
                style={{ left: `${hoverTime * zoom}px` }}
              />
            )}

            {/* 7. CapCut/Premiere Playhead Needle */}
            <div 
              className="playhead-line" 
              style={{ left: `${currentTime * zoom}px` }}
            >
              <div className="playhead-head">
                <div className="playhead-handle-flag" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

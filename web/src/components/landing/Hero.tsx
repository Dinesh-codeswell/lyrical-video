import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';
import './Hero.css';

export const Hero: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  const sampleLyric = "Cutting through the midnight glass with laser precision";
  const words = sampleLyric.split(' ');

  // Simulate real-time karaoke word wipe
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveWordIndex((prev) => (prev + 1) % words.length);
    }, 450);
    return () => clearInterval(interval);
  }, [isPlaying, words.length]);

  return (
    <section className="allfeat-hero">
      {/* 1. Atmospheric Teal Stage Wash */}
      <div className="hero-teal-wash" />

      {/* 2. Concentric Orbital Community Nodes */}
      <div className="hero-orbital-wrapper">
        <div className="orbital-node node-1" title="SMPTE Precision Timecode">
          <span className="node-badge">SMPTE</span>
          <span className="node-sub">00:01:24:15</span>
        </div>
        <div className="orbital-node node-2" title="Universal LRC & SRT Parser">
          <span className="node-badge">LRC / SRT</span>
          <span className="node-sub">Universal Sync</span>
        </div>
        <div className="orbital-node node-3" title="Ultra HD Broadcast 60 FPS">
          <span className="node-badge">60 FPS</span>
          <span className="node-sub">1080p MP4</span>
        </div>
        <div className="orbital-node node-4" title="Platform Aspect Ratios">
          <span className="node-badge">9:16 / 16:9</span>
          <span className="node-sub">Reels & Desktop</span>
        </div>
      </div>

      <div className="hero-content-stage">
        {/* Central Constellation Glyph */}
        <div className="hero-brand-mark">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <polygon points="28,8 48,46 8,46" stroke="#00b18c" strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="28" y1="8" x2="28" y2="46" stroke="#fffbeb" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
            <circle cx="28" cy="8" r="3.5" fill="#fffbeb" />
            <circle cx="48" cy="46" r="3.5" fill="#fffbeb" />
            <circle cx="8" cy="46" r="3.5" fill="#fffbeb" />
            <circle cx="28" cy="30" r="2.5" fill="#00b18c" />
          </svg>
        </div>

        {/* Eyebrow Label */}
        <div className="hero-eyebrow">
          MUSIC INFRASTRUCTURE & SYNCED VIDEO PRODUCTION
        </div>

        {/* Mixed-Weight Display Headline */}
        <h1 className="hero-display-headline">
          <span className="headline-solid">Backstage precision.</span>{' '}
          <span className="headline-hollow">Studio-grade lyric videos in browser.</span>
        </h1>

        {/* Subheading */}
        <p className="hero-subtext">
          Multi-track NLE alignment, frame-accurate SMPTE snapping, and 1080p multi-aspect rendering.
          Engineered like hardware for modern artist releases.
        </p>

        {/* Pill Action Buttons */}
        <div className="hero-actions-row">
          <Link to="/dashboard" className="hero-cta-link">
            <button type="button" className="btn-pill-action">
              Launch Studio — Free
            </button>
          </Link>
          <a href="#pipeline" className="hero-ghost-link">
            <button type="button" className="btn-pill-ghost">
              Explore 3-Step Pipeline
            </button>
          </a>
        </div>

        {/* 3. Inset-Border Studio Live Showcase Card */}
        <div className="hero-showcase-card">
          {/* Card Window Topbar */}
          <div className="showcase-header">
            <div className="window-dots">
              <span className="window-dot" />
              <span className="window-dot" />
              <span className="window-dot" />
            </div>
            <div className="showcase-badge-group">
              <button 
                type="button" 
                onClick={() => setIsPlaying(!isPlaying)} 
                className="showcase-play-btn"
                title={isPlaying ? "Pause simulated playback" : "Resume simulated playback"}
              >
                {isPlaying ? <Pause size={11} /> : <Play size={11} />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </button>
              <div className="showcase-timecode-badge">
                <span className="badge-dot" />
                <span>LIVE RENDER ENGINE · 60 FPS</span>
              </div>
            </div>
            <div className="aspect-switcher-mini">
              <span className="aspect-pill active">16:9</span>
              <span className="aspect-pill">9:16</span>
              <span className="aspect-pill">1:1</span>
            </div>
          </div>

          {/* Live Stage Compositor Preview */}
          <div className="showcase-stage-area">
            <div className="stage-lyric-display">
              <div className="karaoke-line-run">
                {words.map((word, idx) => {
                  const isActive = idx === activeWordIndex;
                  const isPast = idx < activeWordIndex;
                  return (
                    <span 
                      key={idx}
                      className={`karaoke-word ${isActive ? 'word-active' : ''} ${isPast ? 'word-past' : ''}`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Simulated Live NLE Tracks */}
            <div className="showcase-timeline-dock">
              {/* Track V1 */}
              <div className="mini-track">
                <span className="track-tag">V1 VIDEO</span>
                <div className="mini-clip video-strip">
                  <span>Midnight_Stage_Backdrop.mp4</span>
                </div>
              </div>

              {/* Track A1 */}
              <div className="mini-track">
                <span className="track-tag">A1 AUDIO</span>
                <div className="mini-clip audio-strip">
                  <div className="simulated-wave">
                    {[35, 60, 45, 80, 95, 70, 50, 85, 100, 65, 40, 75, 90, 55, 30, 80, 95, 70, 45].map((h, i) => (
                      <span key={i} className="wave-bar" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Track T1 */}
              <div className="mini-track">
                <span className="track-tag">T1 LYRICS</span>
                <div className="mini-clip lyrics-capsule">
                  <span className="capsule-tag">01:24:15 · 2.40s</span>
                  <span className="capsule-text">{sampleLyric}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

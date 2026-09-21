import React from 'react';
import { Magnet, Mic2, RotateCcw, FileCode2, Palette, ShieldCheck } from 'lucide-react';
import './Features.css';

const architectureFeatures = [
  {
    id: 'snapping',
    title: 'Magnetic Snapping Engine',
    description: '10px magnetic attraction to playhead needle, clip start/end boundaries, and ruler markers. Eliminates unintentional overlap drift.',
    icon: <Magnet size={22} />,
    tag: 'TOLERANCE ±0MS',
    isHighlight: false
  },
  {
    id: 'karaoke',
    title: 'Real-Time Syllable Wipe',
    description: 'Progressive word-by-word karaoke lighting with typewriter cursor and customizable neon glow strokes. Renders sub-pixel typography.',
    icon: <Mic2 size={22} />,
    tag: 'DYNAMIC HIGHLIGHT',
    isHighlight: true // Has Coral Edge Trace
  },
  {
    id: 'history',
    title: '50-Step Immutable History',
    description: 'Full undo/redo stack capturing every razor split, trim adjustment, drag-and-drop, and live sync stamp. Wired to Ctrl+Z and Ctrl+Y.',
    icon: <RotateCcw size={22} />,
    tag: 'LOCAL TRANSACTION',
    isHighlight: false
  },
  {
    id: 'parser',
    title: 'Universal Ingestion Parser',
    description: 'Instant client-side decoding of .lrc, .srt, .vtt, and plain lyrics. Automatically calculates smart 3.5s line pacing without server roundtrips.',
    icon: <FileCode2 size={22} />,
    tag: 'CLIENT PIPELINE',
    isHighlight: false
  },
  {
    id: 'presets',
    title: 'Curated Theme Presets',
    description: 'One-click visual aesthetics: Neon Cyberpunk, Studio Warm, Lo-Fi Chill, Minimalist, and Bold Impact with auto-contrast luminance.',
    icon: <Palette size={22} />,
    tag: 'THEME ENGINE',
    isHighlight: false
  },
  {
    id: 'safezones',
    title: 'Platform Safe-Zone Masks',
    description: 'Live interactive overlays for TikTok UI icons, Instagram Reels engagement zones, and mobile status bars to prevent text occlusion.',
    icon: <ShieldCheck size={22} />,
    tag: 'REELS / TIKTOK SAFE',
    isHighlight: false
  }
];

export const Features: React.FC = () => {
  return (
    <section id="architecture" className="allfeat-section allfeat-features">
      <div className="section-container">
        {/* Eyebrow Pre-Title */}
        <div className="section-eyebrow eyebrow-teal">
          SYSTEM CAPABILITIES & ARCHITECTURE
        </div>

        {/* Mixed-Weight Display Headline */}
        <h2 className="section-display-headline">
          <span className="headline-solid">Built like hardware.</span>{' '}
          <span className="headline-hollow">Rendered with sub-pixel speed.</span>
        </h2>

        <p className="section-subtext">
          Engineered from the ground up for high-precision time synchronization without heavy desktop NLE overhead.
        </p>

        {/* 6-Card Grid (2-column on desktop) */}
        <div className="features-grid-2">
          {architectureFeatures.map((feat) => (
            <div 
              key={feat.id} 
              className={`inset-card feature-card-allfeat ${feat.isHighlight ? 'coral-trace-border' : ''}`}
            >
              <div className="card-top-row">
                <div className="feature-icon-circle">
                  {feat.icon}
                </div>
                <span className="pill-badge">{feat.tag}</span>
              </div>

              <h3 className="card-title">{feat.title}</h3>
              <p className="card-body-text">{feat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

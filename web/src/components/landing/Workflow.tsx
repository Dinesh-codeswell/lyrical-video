import React from 'react';
import { UploadCloud, Layers, Video } from 'lucide-react';
import './Workflow.css';

export const Workflow: React.FC = () => {
  return (
    <section id="pipeline" className="allfeat-section allfeat-workflow">
      <div className="section-container">
        {/* Eyebrow Pre-Title */}
        <div className="section-eyebrow eyebrow-coral">
          PRELUDE — THE 3-STEP PIPELINE
        </div>

        {/* Mixed-Weight Display Headline */}
        <h2 className="section-display-headline">
          <span className="headline-solid">From raw master audio</span>{' '}
          <span className="headline-hollow">to broadcast-ready release.</span>
        </h2>

        <p className="section-subtext">
          Zero software installs. An end-to-end studio pipeline designed for artists, record labels, and visual directors.
        </p>

        {/* 3-Card Grid */}
        <div className="workflow-grid-3">
          {/* Step 1 */}
          <div className="inset-card step-card-pro">
            <div className="card-top-row">
              <span className="step-numeral">01</span>
              <span className="pill-badge">INGESTION</span>
            </div>
            <div className="step-icon-box">
              <UploadCloud size={24} />
            </div>
            <h3 className="card-title">Universal Ingestion & Pacing</h3>
            <p className="card-body-text">
              Drop master audio (.wav, .mp3, .aac) alongside any lyric source (.lrc, .srt, .vtt, or raw text). Our client-side parser detects timecode tags or auto-paces verses with smart 3.5s rhythm.
            </p>
            <div className="card-meta-tag">
              <span>ZERO SERVER UPLOAD REQUIRED FOR PARSING</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="inset-card step-card-pro">
            <div className="card-top-row">
              <span className="step-numeral">02</span>
              <span className="pill-badge">SYNCHRONIZING</span>
            </div>
            <div className="step-icon-box">
              <Layers size={24} />
            </div>
            <h3 className="card-title">Multi-Track NLE Composing</h3>
            <p className="card-body-text">
              Edit on professional V1 Video, A1 Audio, and T1 Lyrics lanes. Trim handles with 10px magnetic snapping, razor split clips at playhead (<kbd>Ctrl+K</kbd>), and record sync stamps live (<kbd>Enter</kbd>).
            </p>
            <div className="card-meta-tag">
              <span>50-STEP IMMUTABLE UNDO / REDO STACK</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="inset-card step-card-pro">
            <div className="card-top-row">
              <span className="step-numeral">03</span>
              <span className="pill-badge">COMPILATION</span>
            </div>
            <div className="step-icon-box">
              <Video size={24} />
            </div>
            <h3 className="card-title">Multi-Aspect Cloud Render</h3>
            <p className="card-body-text">
              Target 16:9 YouTube, 9:16 TikTok Reels, 1:1 Square, or 4:5 Instagram with 1 click. Generates sub-pixel animated kinetic typography and word-by-word karaoke wipes at full 60 FPS 1080p MP4.
            </p>
            <div className="card-meta-tag">
              <span>HARDWARE ACCELERATED H.264 ENCODING</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

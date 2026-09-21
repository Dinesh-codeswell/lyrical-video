import React from 'react';
import './Specs.css';

const comparisons = [
  {
    metric: 'Time to First Synced Master',
    traditional: '3 to 5 hours (manual keyframing)',
    lyricgen: 'Under 4 minutes (live stamping & LRC auto-pace)',
    advantage: '75x Faster'
  },
  {
    metric: 'Multi-Aspect Ratio Delivery',
    traditional: '4 separate sequence timelines to re-align',
    lyricgen: '1-click switch (16:9, 9:16, 1:1, 4:5)',
    advantage: 'Instant'
  },
  {
    metric: 'Word-by-Word Karaoke Wipe',
    traditional: 'Complex track mattes & text expressions',
    lyricgen: 'Native sub-pixel syllable progress engine',
    advantage: 'Automated'
  },
  {
    metric: 'Mobile UI Safe Zones',
    traditional: 'Manual PNG guide import & eyeballing',
    lyricgen: 'Built-in interactive TikTok & Reels mask',
    advantage: '100% Safe'
  },
  {
    metric: 'Desktop App Overhead',
    traditional: '25GB+ footprint, heavy GPU lockup',
    lyricgen: 'Zero installation, instant browser sandbox',
    advantage: 'Lightweight'
  },
  {
    metric: 'Export Format & Framerate',
    traditional: 'Manual Bitrate, VBR/CBR export presets',
    lyricgen: 'Production-ready 1080p H.264 @ 60 FPS',
    advantage: 'Broadcast Spec'
  }
];

export const Specs: React.FC = () => {
  return (
    <section id="benchmarks" className="allfeat-section allfeat-specs">
      <div className="section-container">
        {/* Eyebrow Pre-Title */}
        <div className="section-eyebrow eyebrow-coral">
          BENCHMARK METRICS & RUNTIMES
        </div>

        {/* Mixed-Weight Display Headline */}
        <h2 className="section-display-headline">
          <span className="headline-solid">Ditch the timeline bloat.</span>{' '}
          <span className="headline-hollow">Keep the broadcast fidelity.</span>
        </h2>

        <p className="section-subtext">
          Measured comparison between traditional manual desktop workflows and LyricGen's browser infrastructure.
        </p>

        {/* Inset-Border Comparison Table Card */}
        <div className="inset-card specs-table-card">
          <div className="specs-table-header">
            <div className="col-metric">PRODUCTION METRIC</div>
            <div className="col-trad">AFTER EFFECTS / PREMIERE</div>
            <div className="col-lyricgen">LYRICGEN INFRASTRUCTURE</div>
          </div>

          <div className="specs-table-body">
            {comparisons.map((row, idx) => (
              <div key={idx} className="specs-table-row">
                <div className="col-metric">
                  <span className="metric-title">{row.metric}</span>
                </div>
                <div className="col-trad">
                  <span className="trad-text">{row.traditional}</span>
                </div>
                <div className="col-lyricgen">
                  <span className="lyricgen-text">{row.lyricgen}</span>
                  <span className="advantage-pill">{row.advantage}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

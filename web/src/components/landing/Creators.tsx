import React from 'react';
import './Creators.css';

const creatorCases = [
  {
    quote: "The only tool that gives our studio the micro-second precision we need for tour backdrops without the Premiere and After Effects timeline bloat.",
    author: "Alex Rivera",
    role: "Visual & Lighting Director",
    project: "Echoes Live Tour 2026",
    badge: "STAGE VISUALS"
  },
  {
    quote: "We release 15+ tracks monthly across YouTube and vertical platforms. LyricGen cut our turn-around time from two days per track to under twenty minutes.",
    author: "Elena Rostova",
    role: "Head of Digital Operations",
    project: "VaporWave Records",
    badge: "LABEL PIPELINE"
  }
];

export const Creators: React.FC = () => {
  return (
    <section id="creators" className="allfeat-section allfeat-creators">
      <div className="section-container">
        {/* Eyebrow Pre-Title */}
        <div className="section-eyebrow eyebrow-teal">
          PROVEN IN PRODUCTION
        </div>

        {/* Mixed-Weight Display Headline */}
        <h2 className="section-display-headline">
          <span className="headline-solid">Trusted by visual directors</span>{' '}
          <span className="headline-hollow">& independent record labels.</span>
        </h2>

        <p className="section-subtext">
          High-fidelity sync designed for broadcast screens, live stage backdrops, and multi-platform distribution.
        </p>

        {/* 2-Column Paired Cards */}
        <div className="creators-grid-2">
          {creatorCases.map((item, idx) => (
            <div key={idx} className="inset-card creator-case-card">
              <div className="card-top-row">
                <span className="pill-badge">{item.badge}</span>
                <span className="project-tag">{item.project}</span>
              </div>

              <blockquote className="creator-quote">
                "{item.quote}"
              </blockquote>

              <div className="creator-author-box">
                <div className="author-avatar-circle">
                  {item.author.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="author-meta">
                  <span className="author-name">{item.author}</span>
                  <span className="author-role">{item.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

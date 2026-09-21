import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

export const Navbar: React.FC = () => {
  return (
    <header className="allfeat-header">
      <div className="header-container">
        {/* Fixed Top-Left Wordmark */}
        <Link to="/" className="allfeat-wordmark">
          <svg className="brand-glyph" width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L21 21H3L12 3Z" stroke="#00b18c" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="3" r="2" fill="#fffbeb" />
            <circle cx="21" cy="21" r="2" fill="#fffbeb" />
            <circle cx="3" cy="21" r="2" fill="#fffbeb" />
            <circle cx="12" cy="14" r="1.5" fill="#00b18c" />
          </svg>
          <span className="brand-title">LyricGen</span>
          <span className="brand-pill-tag">INFRASTRUCTURE</span>
        </Link>

        {/* Floating Top-Right Nav Capsule */}
        <nav className="nav-capsule">
          <a href="#pipeline" className="capsule-link">Pipeline</a>
          <span className="capsule-divider" />
          <a href="#architecture" className="capsule-link">Architecture</a>
          <span className="capsule-divider" />
          <a href="#benchmarks" className="capsule-link">Benchmarks</a>
          <span className="capsule-divider" />
          <Link to="/dashboard" className="capsule-cta-link">
            <button type="button" className="btn-pill-primary">
              Launch Studio
            </button>
          </Link>
        </nav>
      </div>
    </header>
  );
};

import React, { useEffect } from 'react';
import { Navbar } from '../components/landing/Navbar';
import { Hero } from '../components/landing/Hero';
import { Workflow } from '../components/landing/Workflow';
import { Features } from '../components/landing/Features';
import { Specs } from '../components/landing/Specs';
import { Creators } from '../components/landing/Creators';
import { Link } from 'react-router-dom';
import { blogs } from '../data/blogs';
import './LandingPage.css';

export const LandingPage: React.FC = () => {
  const featuredBlogs = blogs.slice(0, 3);

  useEffect(() => {
    document.title = "LyricGen — Studio-Grade Lyric Video Production";
  }, []);

  return (
    <div className="allfeat-landing-canvas">
      <Navbar />

      <main>
        {/* 1. Hero Stage with Teal Wash & Concentric Orbits */}
        <Hero />

        {/* 2. Prelude: 3-Step Pipeline */}
        <Workflow />

        {/* 3. System Capabilities & Architecture */}
        <Features />

        {/* 4. Benchmark Runtimes & Specs Sheet */}
        <Specs />

        {/* 5. Production Creators & Case Studies */}
        <Creators />

        {/* 6. Dispatches & Engineering Guides */}
        <section id="dispatches" className="allfeat-section allfeat-dispatches">
          <div className="section-container">
            <div className="section-eyebrow eyebrow-coral">
              DISPATCHES & GUIDES
            </div>

            <h2 className="section-display-headline">
              <span className="headline-solid">Insights from the lab.</span>{' '}
              <span className="headline-hollow">Deep dives into audio sync & video tech.</span>
            </h2>

            <p className="section-subtext">
              Engineering notes, video production benchmarks, and workflow optimization guides.
            </p>

            <div className="dispatches-grid-3">
              {featuredBlogs.map((blog) => (
                <Link to={`/blog/${blog.id}`} key={blog.id} className="inset-card dispatch-card">
                  <div className="dispatch-img-frame">
                    <img src={blog.featuredImage} alt={blog.title} className="dispatch-cover-img" />
                  </div>

                  <div className="dispatch-card-body">
                    <div className="dispatch-meta-row">
                      <span className="pill-badge">{blog.category}</span>
                      <span className="read-time-tag">{blog.readTime} read</span>
                    </div>

                    <h3 className="dispatch-card-title">{blog.title}</h3>
                    <p className="dispatch-card-excerpt">{blog.excerpt}</p>
                    
                    <div className="dispatch-card-footer">
                      <span className="dispatch-date">{blog.date}</span>
                      <span className="dispatch-read-link">Read Dispatch →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Pre-Footer Action Stage */}
        <section className="allfeat-prefooter-stage">
          <div className="prefooter-teal-wash" />
          <div className="prefooter-content">
            <svg width="48" height="48" viewBox="0 0 56 56" fill="none" className="prefooter-glyph">
              <polygon points="28,8 48,46 8,46" stroke="#00b18c" strokeWidth="2.5" strokeLinejoin="round" />
              <circle cx="28" cy="8" r="3.5" fill="#fffbeb" />
              <circle cx="48" cy="46" r="3.5" fill="#fffbeb" />
              <circle cx="8" cy="46" r="3.5" fill="#fffbeb" />
              <circle cx="28" cy="30" r="2.5" fill="#00b18c" />
            </svg>

            <h2 className="prefooter-headline">
              <span className="headline-solid">Start producing in seconds.</span><br />
              <span className="headline-hollow">Zero installation. Zero account friction.</span>
            </h2>

            <p className="prefooter-subtext">
              Join visual directors and artists producing frame-accurate lyric videos directly in their browser.
            </p>

            <Link to="/dashboard" className="prefooter-btn-link">
              <button type="button" className="btn-pill-action">
                Launch Studio Now — Free
              </button>
            </Link>
          </div>
        </section>
      </main>

      {/* 8. Allfeat Compact Dark Text-Only Footer */}
      <footer className="allfeat-footer">
        <div className="footer-inner-container">
          <div className="footer-top-row">
            <div className="footer-brand-lockup">
              <span className="footer-logo-title">LyricGen</span>
              <span className="brand-pill-tag">INFRASTRUCTURE</span>
            </div>

            <nav className="footer-nav-links">
              <a href="#pipeline">Pipeline</a>
              <a href="#architecture">Capabilities</a>
              <a href="#benchmarks">Benchmarks</a>
              <a href="#creators">Creators</a>
              <Link to="/blog">Dispatches</Link>
              <Link to="/dashboard">Studio Editor</Link>
            </nav>
          </div>

          <div className="footer-divider-line" />

          <div className="footer-bottom-row">
            <p className="footer-copyright">
              &copy; 2026 LyricGen. The standard for time-synchronized broadcast lyric video production.
            </p>
            <div className="footer-system-status">
              <span className="status-indicator-dot" />
              <span>All render nodes operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

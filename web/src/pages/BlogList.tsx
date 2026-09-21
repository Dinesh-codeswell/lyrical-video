import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { blogs } from '../data/blogs';
import { Navbar } from '../components/landing/Navbar';
import './Blog.css';

export const BlogList: React.FC = () => {
  useEffect(() => {
    document.title = "LyricGen Dispatches — Insights, Engineering & Production";
  }, []);

  return (
    <div className="blog-page-allfeat">
      <Navbar />
      
      <header className="blog-header-section">
        <div className="container-allfeat">
          <div className="blog-badge-capsule">DISPATCHES & GUIDES</div>
          <h1 className="blog-main-title">
            <span className="headline-solid">Insights from the lab.</span><br />
            <span className="headline-hollow">Deep dives into audio sync & video tech.</span>
          </h1>
          <p className="blog-subtitle">
            Engineering benchmarks, subtitle parsing internals, and broadcast workflow guides.
          </p>
        </div>
      </header>

      <main className="container-allfeat">
        <div className="blog-grid-allfeat">
          {blogs.map((blog) => (
            <Link to={`/blog/${blog.id}`} key={blog.id} className="inset-card blog-card-allfeat">
              <div className="blog-card-img-box">
                <img src={blog.featuredImage} alt={blog.title} className="blog-card-img" />
              </div>
              <div className="blog-card-content">
                <div className="blog-card-meta">
                  <span className="pill-badge">{blog.category}</span>
                  <span className="blog-card-time">{blog.readTime} read</span>
                </div>
                <h2 className="blog-card-title">{blog.title}</h2>
                <p className="blog-card-excerpt">{blog.excerpt}</p>
                <div className="blog-card-footer">
                  <span className="blog-card-date">{blog.date}</span>
                  <span className="blog-card-link">Read Dispatch →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="allfeat-footer">
        <div className="footer-inner-container">
          <div className="footer-top-row">
            <div className="footer-brand-lockup">
              <span className="footer-logo-title">LyricGen</span>
              <span className="brand-pill-tag">INFRASTRUCTURE</span>
            </div>

            <nav className="footer-nav-links">
              <Link to="/">Home</Link>
              <Link to="/dashboard">Studio Editor</Link>
              <Link to="/blog">Dispatches</Link>
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

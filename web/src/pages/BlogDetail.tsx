import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogs } from '../data/blogs';
import { Navbar } from '../components/landing/Navbar';
import './Blog.css';

export const BlogDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const blog = blogs.find((b) => b.id === id);

  useEffect(() => {
    if (blog) {
      document.title = `${blog.title} — LyricGen Dispatches`;
    } else {
      document.title = "Dispatch Not Found — LyricGen";
    }
  }, [blog]);

  if (!blog) {
    return (
      <div className="blog-page-allfeat">
        <Navbar />
        <div className="container-allfeat" style={{ paddingTop: '160px', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--color-warm-cream)' }}>Dispatch Not Found</h2>
          <p style={{ color: 'var(--color-mute-cream)', margin: '16px 0 32px 0' }}>The engineering dispatch you are looking for does not exist.</p>
          <Link to="/blog">
            <button className="btn-pill-primary">Back to Dispatches</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-page-allfeat blog-detail-view">
      <Navbar />
      
      <header className="blog-post-header">
        <div className="container-allfeat">
          <Link to="/blog" className="back-link">
            ← Back to Dispatches
          </Link>
          <div className="post-meta">
            <span className="pill-badge">{blog.category}</span>
            <span className="meta-sep">•</span>
            <span className="meta-date">{blog.date}</span>
            <span className="meta-sep">•</span>
            <span className="meta-time">{blog.readTime} read</span>
          </div>
          <h1 className="post-title">{blog.title}</h1>
        </div>
      </header>

      <main className="container-allfeat post-layout">
        <article className="post-content inset-card">
          <div className="post-featured-banner">
            <img src={blog.featuredImage} alt={blog.title} className="post-banner-img" />
          </div>

          <div className="post-markdown-body">
            {blog.content.split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i}>{line.replace('# ', '')}</h1>;
              if (line.startsWith('## ')) return <h2 key={i}>{line.replace('## ', '')}</h2>;
              if (line.startsWith('### ')) return <h3 key={i}>{line.replace('### ', '')}</h3>;
              if (line.startsWith('![')) {
                const alt = line.match(/\[(.*?)\]/)?.[1];
                const src = line.substring(line.lastIndexOf('(') + 1, line.lastIndexOf(')'));
                return <img key={i} src={src} alt={alt} className="post-inline-img" />;
              }
              if (line.startsWith('* ')) return <li key={i}>{line.replace('* ', '')}</li>;
              if (line.trim() === '') return <div key={i} className="content-spacer" />;
              return <p key={i}>{line}</p>;
            })}
          </div>
        </article>
        
        <aside className="post-sidebar">
          <div className="inset-card cta-sidebar-card">
            <div className="section-eyebrow eyebrow-teal">FRAME-ACCURATE TIMELINE</div>
            <h3>LyricGen NLE Studio</h3>
            <p>Produce broadcast-grade lyric videos directly in your browser with zero render lag.</p>
            <Link to="/dashboard" style={{ textDecoration: 'none' }}>
              <button className="btn-pill-action" style={{ width: '100%' }}>
                Launch Studio Now
              </button>
            </Link>
          </div>
        </aside>
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

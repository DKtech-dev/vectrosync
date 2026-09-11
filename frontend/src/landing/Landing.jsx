import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import './landing.css';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_083109_283f3553-e28f-428b-a723-d639c617eb2b.mp4';

const NAV_LINKS = [
  { id: 'home', label: 'Home', href: '#home' },
  { id: 'physics', label: 'Physics', href: '#physics' },
  { id: 'verification', label: 'Verification', href: '#verification' },
  { id: 'console', label: 'Console', action: 'console' },
];

const PROOF = [
  { value: '315', label: 'Tests passing' },
  { value: '19\u21920', label: 'Float events, A/B' },
  { value: '289t', label: 'CO\u2082e avoided / yr' },
  { value: '90%', label: 'Robust confidence' },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mql) return undefined;
    const onChange = (e) => setReduced(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

/**
 * Full-bleed looping hero video with a manual fade-in/fade-out crossfade at
 * the loop point (rAF-driven opacity ramp over the first/last 0.5s of
 * playback), matching the reference's custom loop logic. Falls back to a
 * static gradient (no network dependency) if the video fails to load, so a
 * hostile/offline venue never shows a broken hero.
 */
function HeroVideo({ reduced }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reduced || failed) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;
    const FADE_S = 0.5;
    let raf = null;

    const tick = () => {
      const d = video.duration;
      const t = video.currentTime;
      if (d && Number.isFinite(d)) {
        let opacity = 1;
        if (t < FADE_S) opacity = t / FADE_S;
        else if (t > d - FADE_S) opacity = Math.max(0, (d - t) / FADE_S);
        video.style.opacity = String(opacity);
      }
      raf = requestAnimationFrame(tick);
    };

    const onEnded = () => {
      video.style.opacity = '0';
      window.setTimeout(() => {
        try {
          video.currentTime = 0;
          video.play().catch(() => {});
        } catch {
          /* ignore */
        }
      }, 100);
    };

    video.addEventListener('ended', onEnded);
    raf = requestAnimationFrame(tick);
    return () => {
      video.removeEventListener('ended', onEnded);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced, failed]);

  if (reduced || failed) {
    return (
      <div
        className="bg-canvas-fallback"
        style={{ background: 'linear-gradient(180deg, #f4f4f4 0%, #e9e9e9 55%, #f9f9f9 100%)' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className="bg-video"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      onError={() => setFailed(true)}
    >
      <source src={VIDEO_URL} type="video/mp4" />
    </video>
  );
}

export function Landing({ onLaunchConsole }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    document.title = 'Intelligence Built To Foresee Failure \u2014 VectroSync';
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNavClick = (link) => (e) => {
    if (link.action === 'console') {
      e.preventDefault();
      setMenuOpen(false);
      onLaunchConsole();
    } else {
      setMenuOpen(false);
    }
  };

  return (
    <div className="vs-landing">
      <div className="video-stage">
        <HeroVideo reduced={reduced} />
        <div className="video-overlay" />
      </div>

      <div className="page">
        <header className="nav">
          <a href="#home" className="nav-logo" onClick={(e) => e.preventDefault()}>
            VectroSync
          </a>

          <nav className="nav-links" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href || '#'}
                className={link.id === 'home' ? 'active' : ''}
                onClick={handleNavClick(link)}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <button type="button" className="nav-cta" onClick={onLaunchConsole}>
            Launch Console
          </button>

          <button
            type="button"
            className="nav-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </header>

        <main className="hero">
          <span className="kicker">
            <span className="dot" />
            Physics-informed digital twin
          </span>

          <h1 className="headline">
            Beyond <em>failure,</em>
            <br />
            we build <em>the foreseen.</em>
          </h1>

          <p className="subhead">
            An Extended Kalman Filter and a chance-constrained optimizer read a cooling reservoir and see
            rod-string compression twelve hours before it happens &mdash; an independent supervisor can
            always refuse the command.
          </p>

          <button type="button" className="hero-cta" onClick={onLaunchConsole}>
            Launch Console
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="proof-strip">
            {PROOF.map((p) => (
              <div key={p.label} className="proof-item">
                <span className="proof-value">{p.value}</span>
                <span className="proof-label">{p.label}</span>
              </div>
            ))}
          </div>
        </main>
      </div>

      {menuOpen && (
        <>
          <div className="menu-overlay" onClick={() => setMenuOpen(false)} />
          <nav className="menu-sheet" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href || '#'}
                className={link.id === 'home' ? 'active' : ''}
                onClick={handleNavClick(link)}
              >
                {link.label}
              </a>
            ))}
            <button type="button" className="menu-cta" onClick={onLaunchConsole}>
              Launch Console
            </button>
          </nav>
        </>
      )}
    </div>
  );
}

export default Landing;

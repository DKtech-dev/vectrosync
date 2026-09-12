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
  { value: '326', label: 'Tests passing' },
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
 * Full-bleed looping hero video.
 *
 * Fade logic (rAF-driven, no CSS transition on opacity):
 *   - Starts at opacity 1 immediately so the video is visible from frame 0.
 *     The white gradient overlay handles the visual "arrival" at the top; no
 *     need to fade the video itself in from black.
 *   - Fades OUT over 0.6 s approaching the end of the clip, so the loop
 *     crossfades cleanly through the white page background rather than
 *     jumping on the first-frame/last-frame cut.
 *   - On 'ended': opacity is already near 0 from the fade-out; waits 80 ms
 *     then resets currentTime and replays, opacity goes back to 1 on the
 *     first tick of the new loop.
 *
 * DO NOT add a CSS `transition` to the video element's opacity property.
 * Setting style.opacity every ~16 ms at 60 fps while a CSS transition is
 * also active on the same property causes two competing animations that
 * produce visible stutter on every frame.
 *
 * Falls back to a static gradient if the video URL is unreachable.
 */
function HeroVideo({ reduced }) {
  const videoRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reduced || failed) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    // Fade-out window (seconds before loop point where opacity ramps to 0).
    // The browser's native `loop` attribute restarts currentTime instantly;
    // the rAF tick detects currentTime = 0 and immediately sets opacity back
    // to 1, producing a clean white-page crossfade at every loop point with
    // zero extra bookkeeping.
    const FADE_OUT_S = 0.55;
    let raf = null;

    const tick = () => {
      const d = video.duration;
      const t = video.currentTime;
      if (d && Number.isFinite(d) && d > FADE_OUT_S) {
        const timeLeft = d - t;
        video.style.opacity = timeLeft < FADE_OUT_S
          ? String(Math.max(0, timeLeft / FADE_OUT_S))
          : '1';
      } else {
        // Metadata not yet ready — show the video at full opacity.
        video.style.opacity = '1';
      }
      raf = requestAnimationFrame(tick);
    };

    // Ensure the video is immediately visible; no fade-in from black.
    video.style.opacity = '1';
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduced, failed]);

  if (reduced || failed) {
    return (
      <div
        className="bg-canvas-fallback"
        style={{ background: 'linear-gradient(180deg, #ededed 0%, #e0e0e0 55%, #efefef 100%)' }}
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
      {/* `loop` is intentional: the rAF tick fades opacity to 0 in the last
          0.55 s; native loop resets currentTime instantly; tick then reads
          timeLeft = full duration and snaps opacity back to 1. Result: a
          clean white-crossfade on every loop with zero extra JS. */}
      <source src={VIDEO_URL} type="video/mp4" />
    </video>
  );
}

export function Landing({ onLaunchConsole }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    document.title = 'Intelligence Built To Foresee Failure \u2014 Catenary';
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
            Catenary
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

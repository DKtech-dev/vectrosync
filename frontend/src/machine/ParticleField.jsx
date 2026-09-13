import React, { useEffect, useRef } from 'react';
import { readToken } from './runtime.js';

/**
 * ============================================================================
 * PARTICLE FIELD
 * ============================================================================
 * A canvas overlay registered to the same scene coordinate system as the bay
 * SVG, so a particle emitted at "the perforations" is emitted at the
 * perforations and not at a hand-tuned pixel.
 *
 * Every particle class corresponds to a real transport process, and its rate is
 * driven by the physics rather than being decorative:
 *
 *   steam     convective plume in the heated zone      rate ~ (T - T_res)
 *   inflow    reservoir fluid entering the perfs       rate ~ pump displacement
 *   lift      fluid column rising inside the tubing    velocity ~ plunger rate
 *   wear      metal debris at rod/tubing contact       only while F_axial < 0
 *   discharge fluid slugs leaving along the flowline    rate ~ plunger fillage
 *   motes     surface dust, pure depth cue for parallax
 *
 * The pool is fixed-size and recycled; there is no allocation in the hot loop.
 * ==========================================================================*/

const POOL = 320;

export function ParticleField({ clock, bay, sceneW, sceneH, emittersRef, className = '', reduced = false }) {
  const canvasRef = useRef(null);
  const poolRef = useRef(null);

  if (poolRef.current === null) {
    poolRef.current = Array.from({ length: POOL }, () => ({ life: 0 }));
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d', { alpha: true });
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cssW = r.width;
      cssH = r.height;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Theme colours, re-read when the theme flips.
    let C = {};
    const readColours = () => {
      C = {
        thermal: readToken('--accent-thermal', '255, 138, 42'),
        critical: readToken('--accent-critical', '255, 86, 96'),
        safe: readToken('--accent-safe', '45, 212, 167'),
        signal: readToken('--accent-interactive', '56, 209, 255'),
        faint: readToken('--text-tertiary', '104, 121, 140'),
      };
    };
    readColours();
    const themeObs = new MutationObserver(readColours);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const pool = poolRef.current;
    let cursor = 0;
    const carry = { steam: 0, inflow: 0, lift: 0, wear: 0, discharge: 0, mote: 0 };

    const spawn = (p, kind, e) => {
      p.kind = kind;
      p.life = 1;
      switch (kind) {
        case 'steam':
          // Buoyant plume rising out of the heated near-wellbore volume.
          // Deliberately faint: this is a convective shimmer in rock, not a
          // flame. Bright saturated blobs here read as an explosion and
          // destroy the credibility of the whole drawing.
          p.x = e.x + (Math.random() - 0.5) * e.spread;
          p.y = e.y + (Math.random() - 0.5) * 10;
          p.vx = (Math.random() - 0.5) * 3;
          p.vy = -6 - Math.random() * 10;
          p.r = 0.7 + Math.random() * 1.3;
          p.decay = 0.4 + Math.random() * 0.3;
          p.c = C.thermal;
          p.a = 0.14;
          break;
        case 'inflow': {
          // Radial convergence on the perforated interval.
          const side = Math.random() < 0.5 ? -1 : 1;
          p.x = e.x + side * (e.spread * (0.55 + Math.random() * 0.45));
          p.y = e.y + (Math.random() - 0.5) * e.height;
          p.tx = e.x;
          p.ty = e.y + (Math.random() - 0.5) * e.height * 0.4;
          p.vx = (p.tx - p.x) * (0.5 + Math.random() * 0.5);
          p.vy = (p.ty - p.y) * 0.5;
          p.r = 0.55 + Math.random() * 0.5;
          p.decay = 0.6;
          p.c = C.thermal;
          p.a = 0.3;
          break;
        }
        case 'lift':
          // Produced fluid travelling up the tubing bore.
          p.x = e.x + (Math.random() - 0.5) * e.spread;
          p.y = e.y0 + Math.random() * (e.y1 - e.y0);
          p.vx = 0;
          p.vy = -e.speed;
          p.r = 0.5 + Math.random() * 0.55;
          p.decay = 0.16;
          p.c = e.hot ? C.thermal : C.signal;
          p.a = 0.34;
          break;
        case 'wear':
          // Debris thrown off a rod/tubing contact point.
          p.x = e.x + (Math.random() < 0.5 ? -e.spread : e.spread);
          p.y = e.y0 + Math.random() * (e.y1 - e.y0);
          p.vx = (p.x > e.x ? 1 : -1) * (6 + Math.random() * 16);
          p.vy = (Math.random() - 0.5) * 26;
          p.r = 0.4 + Math.random() * 0.8;
          p.decay = 1.6 + Math.random();
          p.c = C.critical;
          p.a = 0.7;
          break;
        case 'discharge':
          // A slug of produced fluid leaving along the flowline. Spawned only
          // when the barrel actually delivers a stroke, so a stalled pump
          // reads as a flowline that visibly stops pulsing, not just a
          // number that changes.
          p.x = e.x + (Math.random() - 0.5) * 4;
          p.y = e.y + (Math.random() - 0.5) * e.spread;
          p.vx = e.dir === 'up' ? (Math.random() - 0.5) * 6 : 22 + Math.random() * 14;
          p.vy = e.dir === 'up' ? -(22 + Math.random() * 14) : (Math.random() - 0.5) * 6;
          p.r = 0.6 + Math.random() * 0.6;
          p.decay = 0.55 + Math.random() * 0.25;
          p.c = e.hot ? C.thermal : C.signal;
          p.a = 0.4;
          break;
        default: // mote
          p.x = Math.random() * sceneW;
          p.y = e.y0 + Math.random() * (e.y1 - e.y0);
          p.vx = (Math.random() - 0.5) * 2.5;
          p.vy = (Math.random() - 0.5) * 1.6;
          p.r = 0.35 + Math.random() * 0.5;
          p.decay = 0.12;
          p.c = C.faint;
          p.a = 0.22;
          break;
      }
    };

    const emit = (kind, ratePerSec, dtS, e) => {
      if (ratePerSec <= 0) return;
      carry[kind] += ratePerSec * dtS;
      let n = Math.floor(carry[kind]);
      carry[kind] -= n;
      if (n > 24) n = 24;
      while (n > 0) {
        n -= 1;
        cursor = (cursor + 1) % POOL;
        const p = pool[cursor];
        if (p.life > 0.25 && Math.random() > 0.4) continue; // don't cull fresh ones
        spawn(p, kind, e);
      }
    };

    const unsub = clock.subscribe((state, dtS) => {
      if (!cssW || !cssH) return;
      const sx = (cssW / sceneW) * dpr;
      const sy = (cssH / sceneH) * dpr;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(sx, 0, 0, sy, 0, 0);

      const em = emittersRef.current;
      if (em && !reduced && dtS > 0) {
        if (em.steam) emit('steam', em.steam.rate, dtS, em.steam);
        if (em.inflow) emit('inflow', em.inflow.rate, dtS, em.inflow);
        if (em.lift) emit('lift', em.lift.rate, dtS, em.lift);
        if (em.wear) emit('wear', em.wear.rate, dtS, em.wear);
        if (em.discharge) emit('discharge', em.discharge.rate, dtS, em.discharge);
        if (em.mote) emit('mote', em.mote.rate, dtS, em.mote);
      }

      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < POOL; i += 1) {
        const p = pool[i];
        if (p.life <= 0) continue;
        p.life -= p.decay * dtS;
        if (p.life <= 0) continue;
        p.x += p.vx * dtS;
        p.y += p.vy * dtS;
        if (p.kind === 'steam') {
          p.vy *= 1 - 0.5 * dtS; // buoyancy bleeds off
          p.vx += (Math.random() - 0.5) * 22 * dtS; // turbulent wander
        } else if (p.kind === 'wear') {
          p.vy += 90 * dtS; // debris falls
        } else if (p.kind === 'inflow') {
          p.vx *= 1 - 0.4 * dtS;
        }

        const alpha = p.a * p.life * p.life;
        const rr = p.kind === 'steam' ? p.r * (1.9 - p.life) : p.r;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.c}, ${alpha})`;
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    });

    return () => {
      unsub();
      ro.disconnect();
      themeObs.disconnect();
    };
  }, [clock, sceneW, sceneH, emittersRef, reduced, bay]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`absolute inset-0 w-full h-full pointer-events-none ${className}`} />;
}

export default ParticleField;

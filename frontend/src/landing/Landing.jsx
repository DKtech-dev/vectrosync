import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  FlaskConical,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Terminal,
  X,
} from 'lucide-react';
import { usePrefersReducedMotion } from '../utils/motion.js';
import { useTheme } from '../utils/theme.jsx';
import { useReveal, useScrollSpy, useSectionIds, useSectionScroll } from './hooks.js';
import ThermalSweep from './ThermalSweep.jsx';
import { AbCompare, LoadLedger, TierChart } from './figures.jsx';
import {
  AB_EXPERIMENT,
  EMULSION_PEAK,
  EMULSION_PEAK_WATER_CUT,
  FAILURE_MODES,
  INCUMBENTS,
  NATIVE_TEMP_C,
  POSTURE,
  REFERENCE_CONFIG,
  SCOPE_CARDS,
  SECTIONS,
  STEAM_TEMP_C,
  SUBSYSTEMS,
  SURROGATE,
  TEST_RUNTIME_S,
  TEST_TIERS,
  TEST_TOTAL,
} from './data.js';
import './landing.css';

const PAGE_TITLE = 'Catenary — physics-informed advisory twin for CSS + SRP wells';

/* Sub-captions are deliberately short: the strip is two columns wide inside a
   narrow hero column, and anything longer wraps mid-token. */
const HERO_METRICS = [
  {
    value: '19 → 0',
    label: 'Rod-float events',
    sub: `seed ${AB_EXPERIMENT.seed} · ${AB_EXPERIMENT.steps} steps`,
    tone: 'text-safe',
  },
  { value: TEST_TOTAL, label: 'Tests passing', sub: `5 tiers · ${TEST_RUNTIME_S} s`, tone: 'text-ink' },
  { value: '5.89 µs', label: 'Surrogate inference', sub: 'R² 0.9170', tone: 'text-interactive' },
  { value: '+0.50 kN', label: 'Anti-float floor', sub: 'MPC hard limit', tone: 'text-ink' },
];

const CASCADE = [
  {
    k: 'Soak',
    body: `Steam heats the formation to ${STEAM_TEMP_C} °C. Crude viscosity falls to 12.4 cP and the well produces freely.`,
    tone: 'tone-thermal',
  },
  {
    k: 'Decay',
    body: `The near-wellbore cools back toward the ${NATIVE_TEMP_C} °C native reservoir temperature. Viscosity climbs roughly 1,000× to about 12,000 cP.`,
    tone: 'tone-thermal',
  },
  {
    k: 'Emulsion',
    body: `Co-produced water forms a water-in-oil emulsion. The multiplier peaks at ${EMULSION_PEAK}× base viscosity at ${EMULSION_PEAK_WATER_CUT} % water cut.`,
    tone: 'tone-caution',
  },
  {
    k: 'Compression',
    body: 'The reciprocating rod string shears that fluid in the tubing annulus. The resulting Couette drag acts upward through the downstroke — against gravity, against the rod weight.',
    tone: 'tone-critical',
  },
];

const CHAIN = [
  'Thermal decay',
  'Rheology',
  'Rod wave',
  'MPC governor',
  'Failsafe',
  'Ledger',
  'Console',
];

/* -------------------------------------------------------------------------- */

function SectionHeader({ index, eyebrow, title, lead }) {
  const ref = useReveal();
  return (
    <header className="cat-reveal" ref={ref}>
      <div className="flex items-center gap-3">
        <span className="readout text-[11px] font-semibold text-interactive">{index}</span>
        <span className="h-px w-7 bg-strong" aria-hidden="true" />
        <span className="eyebrow">{eyebrow}</span>
      </div>
      <h2 className="display-title mt-3.5 text-ink text-[clamp(29px,4.4vw,48px)]">{title}</h2>
      <p className="mt-4 max-w-[62ch] text-muted text-lead">{lead}</p>
    </header>
  );
}

function Section({ id, children }) {
  return (
    <section id={id} className="cat-section">
      <div className="cat-wrap">{children}</div>
    </section>
  );
}

function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme !== 'light';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggleTheme}
      className="btn-icon"
    >
      {isDark ? <Sun className="w-[15px] h-[15px]" /> : <Moon className="w-[15px] h-[15px]" />}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

export function Landing({ onLaunchConsole }) {
  const reduced = usePrefersReducedMotion();
  const sectionIds = useSectionIds(SECTIONS);
  const active = useScrollSpy(sectionIds);
  const scrollToSection = useSectionScroll();

  const [menuOpen, setMenuOpen] = useState(false);
  const sheetRef = useRef(null);
  const burgerRef = useRef(null);
  const sheetId = useId();

  const launch = useCallback(() => {
    if (typeof onLaunchConsole === 'function') {
      onLaunchConsole();
      return;
    }
    window.location.hash = '#console';
  }, [onLaunchConsole]);

  /* Own the document title while mounted, then hand it back untouched so the
     console never inherits the landing page's title. */
  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  const closeMenu = useCallback((returnFocus = true) => {
    setMenuOpen(false);
    if (returnFocus) burgerRef.current?.focus();
  }, []);

  /* Mobile sheet: initial focus, Escape to dismiss, Tab confined to the sheet,
     background scroll locked while it is open. */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const sheet = sheetRef.current;
    const focusables = () =>
      Array.from(sheet?.querySelectorAll('a[href], button:not([disabled])') ?? []);
    focusables()[0]?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // If the viewport widens into the desktop nav, the sheet is hidden by CSS;
    // close it so the scroll lock and focus trap cannot outlive it.
    const wide = window.matchMedia('(min-width: 1024px)');
    const onWide = (event) => {
      if (event.matches) closeMenu(false);
    };
    wide.addEventListener?.('change', onWide);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      wide.removeEventListener?.('change', onWide);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen, closeMenu]);

  /* In-page anchors never write the hash: `#console` is the router's only
     meaningful hash and `hashchange` drives navigation. */
  const goToSection = useCallback(
    (event, id) => {
      event.preventDefault();
      setMenuOpen(false);
      scrollToSection(id);
    },
    [scrollToSection],
  );

  const heroRef = useReveal();

  return (
    <div className="cat-landing min-h-[100dvh] bg-canvas text-ink">
      <a href="#main" className="cat-skip" onClick={(e) => goToSection(e, 'main')}>
        Skip to content
      </a>

      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/85 backdrop-blur-md">
        <div className="cat-wrap flex h-14 items-center gap-3 sm:gap-5">
          {/* The 'Advisory' label is a static classification stamp, not a
              control: it sits outside the link so it is neither focusable nor
              part of the link's accessible name, and it is hidden from
              assistive tech because the hero states the class in full. */}
          <div className="flex shrink-0 items-baseline gap-2.5">
            <a
              href="#main"
              onClick={(e) => goToSection(e, 'main')}
              className="display-title text-[23px] text-ink no-underline"
            >
              Catenary
            </a>
            <span className="hidden items-center gap-2.5 self-center sm:inline-flex" aria-hidden="true">
              <span className="h-3 w-px bg-strong" />
              <span className="eyebrow">Advisory</span>
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-1 ml-1" aria-label="Sections">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={(e) => goToSection(e, s.id)}
                aria-current={active === s.id ? 'true' : undefined}
                className="cat-navlink"
              >
                {s.label}
              </a>
            ))}
          </nav>

          <div className="flex-1" />

          <ThemeSwitch />

          <button type="button" className="btn btn-primary hidden sm:inline-flex" onClick={launch}>
            <Terminal className="w-[14px] h-[14px]" aria-hidden="true" />
            Launch console
          </button>

          <button
            ref={burgerRef}
            type="button"
            className="btn-icon lg:hidden"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls={sheetId}
            onClick={() => (menuOpen ? closeMenu(false) : setMenuOpen(true))}
          >
            {menuOpen ? <X className="w-[15px] h-[15px]" /> : <Menu className="w-[15px] h-[15px]" />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Dismiss-on-tap surface. Keyboard users close with Escape or the
              explicit close button inside the dialog, so this is hidden from
              assistive technology rather than exposed as a phantom control. */}
          <div className="cat-scrim" aria-hidden="true" onClick={() => closeMenu()} />
          <div
            ref={sheetRef}
            id={sheetId}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="cat-sheet panel"
          >
            <div className="panel-rail">
              <span className="eyebrow">Navigate</span>
              <button type="button" className="btn-icon" aria-label="Close navigation menu" onClick={() => closeMenu()}>
                <X className="w-[15px] h-[15px]" />
              </button>
            </div>
            <nav className="p-2.5 flex flex-col gap-0.5" aria-label="Sections">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => goToSection(e, s.id)}
                  aria-current={active === s.id ? 'true' : undefined}
                  className="cat-sheet-link"
                >
                  <span className="readout text-[10.5px] text-muted">{s.index}</span>
                  {s.label}
                </a>
              ))}
            </nav>
            <div className="p-2.5 border-t border-hairline">
              <button type="button" className="btn btn-primary w-full" onClick={launch}>
                <Terminal className="w-[14px] h-[14px]" aria-hidden="true" />
                Launch console
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="main">
        {/* -------------------------------------------------------- hero */}
        <section className="relative overflow-hidden border-b border-hairline">
          <div className="blueprint absolute inset-0 pointer-events-none" aria-hidden="true" />
          <div className="cat-hero-glow" aria-hidden="true" />
          <div className="cat-wrap relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-12 lg:py-20">
            <div className="cat-reveal" ref={heroRef}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill tone-signal">
                  <span className="chip-dot" />
                  Class II supervisory advisory
                </span>
                <span className="pill">Synthetic data</span>
                <span className="pill">Research prototype</span>
              </div>

              <h1 className="display-title mt-6 text-ink text-[clamp(38px,7.2vw,68px)]">
                The reservoir cools long before the dynamometer card{' '}
                <em className="text-thermal">admits it.</em>
              </h1>

              <p className="mt-6 max-w-[58ch] text-muted text-[15px] leading-relaxed sm:text-[16px]">
                Catenary is a physics-informed, evidence-aware digital twin for heavy-oil cyclic steam
                stimulation coupled to sucker-rod pumping. It carries Boberg–Lantz thermal decay forward into
                rod elastodynamics and solves for a pumping schedule that keeps predicted downhole tension
                above zero — before the compression event, not after it.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-primary h-10 px-5" onClick={launch}>
                  Launch console
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
                <a
                  href="#physics"
                  onClick={(e) => goToSection(e, 'physics')}
                  className="btn h-10 px-5 no-underline"
                >
                  Read the physics
                  <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>

              <ul className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-hairline bg-hairline">
                {HERO_METRICS.map((m) => (
                  <li key={m.label} className="bg-surface-1 px-4 py-3.5">
                    <span
                      className={`readout block whitespace-nowrap text-[18px] font-semibold leading-none ${m.tone}`}
                    >
                      {m.value}
                    </span>
                    <span className="cat-balance mt-2 block text-[11.5px] font-semibold leading-tight text-ink">
                      {m.label}
                    </span>
                    <span className="unit-label cat-balance mt-1 block normal-case tracking-normal">
                      {m.sub}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:pl-2">
              <ThermalSweep />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- physics */}
        <Section id="physics">
          <SectionHeader
            index="01"
            eyebrow="Failure mechanism"
            title="Cooling turns the produced fluid into something the rod string cannot shear."
            lead="Cyclic steam stimulation is a thermal loan. The steam is repaid as the near-wellbore cools, and the repayment lands on the rod string as drag it was never sized to carry."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-start">
            <ol className="cat-cascade">
              {CASCADE.map((step, i) => (
                <li key={step.k} className="cat-cascade-item panel p-4 sm:p-5">
                  <div className="flex items-center gap-2.5">
                    <span className="readout text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                    <span className={`pill ${step.tone}`}>{step.k}</span>
                  </div>
                  <p className="mt-3 text-[13.5px] leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>

            <div className="space-y-6">
              <LoadLedger />
              <div className="panel p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="icon-badge tone-critical">
                    <CircleAlert className="w-[15px] h-[15px]" />
                  </span>
                  <h3 className="panel-title">What a buckled string does next</h3>
                </div>
                <ul className="mt-3.5 flex flex-wrap gap-2">
                  {FAILURE_MODES.map((mode) => (
                    <li key={mode} className="pill normal-case tracking-normal text-[11px]">
                      {mode}
                    </li>
                  ))}
                </ul>
                <p className="caption mt-3.5">
                  Each of these is a workover, and every workover is a deferred-production event. The
                  mechanism is deterministic — which is exactly why it is forecastable.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* --------------------------------------------------- landscape */}
        <Section id="gap">
          <SectionHeader
            index="02"
            eyebrow="Landscape"
            title="Surveillance tells you what the last stroke already did."
            lead="Commercial artificial-lift platforms are mature, well-instrumented and genuinely useful. They are also, by construction, retrospective: the dynamometer card is evidence of a stroke that has already happened."
          />

          <div className="mt-8 flex flex-wrap gap-2">
            {INCUMBENTS.map((p) => (
              <span key={p.product} className="pill normal-case tracking-normal text-[11px]">
                <span className="text-ink font-semibold">{p.product}</span>
                <span className="text-muted">{p.vendor}</span>
              </span>
            ))}
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {[POSTURE.reactive, POSTURE.forward].map((col) => (
              <div key={col.kind} className="panel">
                <div className="panel-rail">
                  <span className="panel-title">{col.title}</span>
                  <span className={`pill tone-${col.tone}`}>{col.kind}</span>
                </div>
                <ul className="p-4 sm:p-5 space-y-3">
                  {col.points.map((point) => (
                    <li key={point} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                      <span
                        className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                          col.tone === 'signal' ? 'bg-interactive' : 'bg-caution'
                        }`}
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 well p-4 sm:p-5">
            <p className="text-[14.5px] leading-relaxed text-ink">
              None of these platforms publicly documents a reservoir thermal-decay model coupled into
              forward-looking rod elastodynamics.
            </p>
            <p className="caption mt-2.5">
              Assessment made against publicly available product documentation at the time of writing. It is
              a statement about what is documented, not a claim about undocumented internal capability, and
              not a competitive benchmark.
            </p>
          </div>
        </Section>

        {/* ------------------------------------------------- architecture */}
        <Section id="system">
          <SectionHeader
            index="03"
            eyebrow="Architecture"
            title="Seven subsystems, one chain of custody from reservoir heat to recommended stroke rate."
            lead="Each stage is a named, testable model with its own units and its own failure behaviour. Nothing in the chain is a black box you have to accept on faith."
          />

          <div className="mt-8 overflow-x-auto no-scrollbar">
            <div className="flex min-w-max items-center gap-1.5">
              {CHAIN.map((node, i) => (
                <React.Fragment key={node}>
                  <span className="pill normal-case tracking-normal text-[11px]">{node}</span>
                  {i < CHAIN.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted" aria-hidden="true" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {SUBSYSTEMS.map((s) => (
              <SubsystemCard key={s.n} item={s} />
            ))}
          </div>
        </Section>

        {/* ------------------------------------------------- verification */}
        <Section id="verification">
          <SectionHeader
            index="04"
            eyebrow="Verification"
            title="The claim is only as good as the run you can reproduce."
            lead="Every headline figure below comes from a deterministic, seeded run of the repository test suite and experiment harness. The numbers are what they are — no smoothing, no best-of selection."
          />

          <ul className="mt-8 grid gap-px overflow-hidden rounded-panel border border-hairline bg-hairline sm:grid-cols-3">
            {[
              { v: TEST_TOTAL, u: 'tests passing', s: `across ${TEST_TIERS.length} verification tiers` },
              { v: TEST_RUNTIME_S, u: 'seconds', s: 'full suite wall-clock time' },
              {
                v: `${AB_EXPERIMENT.baselineFloats} → ${AB_EXPERIMENT.twinFloats}`,
                u: 'rod-float events',
                s: `seed ${AB_EXPERIMENT.seed}, ${AB_EXPERIMENT.steps} steps`,
              },
            ].map((m) => (
              <li key={m.u} className="bg-surface-1 px-4 py-4 sm:px-5 sm:py-5">
                <span className="metric-hero block text-ink">{m.v}</span>
                <span className="unit-label mt-2.5 block">{m.u}</span>
                <span className="caption mt-1 block">{m.s}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <TierChart />
            <AbCompare />
          </div>

          <div className="mt-5 panel">
            <div className="panel-rail">
              <div className="flex items-center gap-2.5">
                <span className="icon-badge tone-signal">
                  <FlaskConical className="w-[15px] h-[15px]" />
                </span>
                <span className="panel-title">Neural operating-point surrogate</span>
              </div>
              <span className="pill">vs 116-node Gibbs wave solver</span>
            </div>
            <div className="grid gap-px bg-hairline sm:grid-cols-3">
              {SURROGATE.map((m) => (
                <div key={m.label} className="bg-surface-1 px-4 py-4">
                  <div className="flex items-baseline gap-1.5">
                    <span className="metric-secondary text-interactive">{m.value}</span>
                    {m.unit && <span className="unit-label">{m.unit}</span>}
                  </div>
                  <p className="mt-2 text-[11.5px] font-semibold text-ink">{m.label}</p>
                </div>
              ))}
            </div>
            <p className="border-t border-hairline px-4 py-3 caption">
              The surrogate exists to make the inner optimisation loop affordable, and it is scored against
              the higher-fidelity solver rather than against itself. Where the two disagree, the PDE is the
              reference.
            </p>
          </div>
        </Section>

        {/* --------------------------------------------------------- scope */}
        <Section id="scope">
          <SectionHeader
            index="05"
            eyebrow="Scope & evidence status"
            title="What this system is, and what it deliberately is not."
            lead="This section is part of the engineering, not a disclaimer bolted to the bottom of it. An advisory system that overstates its own standing is not safer for being confident."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {SCOPE_CARDS.map((card) => (
              <div key={card.id} className="panel registered p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className={`icon-badge tone-${card.tone}`}>
                    <ShieldCheck className="w-[15px] h-[15px]" />
                  </span>
                  <span className="eyebrow">{card.kicker}</span>
                </div>
                <h3 className="mt-3.5 text-[17px] font-bold leading-snug text-ink">{card.title}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 panel">
            <div className="panel-rail">
              <span className="panel-title">Reference configuration</span>
              <span className="pill tone-caution">Synthetic</span>
            </div>
            <dl className="grid gap-px bg-hairline sm:grid-cols-2 xl:grid-cols-4">
              {REFERENCE_CONFIG.map((row) => (
                <div key={row.k} className="bg-surface-1 px-4 py-3.5">
                  <dt className="unit-label">{row.k}</dt>
                  <dd className="readout mt-1.5 text-[13px] text-ink">{row.v}</dd>
                </div>
              ))}
            </dl>
            <p className="border-t border-hairline px-4 py-3 caption">
              Calibrated from publicly reported Baghewala parameters and inspired by Well #14 within a
              23-well field context. No operator affiliation, endorsement, or deployment is implied.
            </p>
          </div>
        </Section>

        {/* ----------------------------------------------------------- cta */}
        <section className="border-t border-hairline">
          <div className="cat-wrap py-14 sm:py-20">
            <div className="panel registered blueprint-fine overflow-hidden">
              <div className="p-6 sm:p-10 text-center">
                <span className="eyebrow">Operator console</span>
                <h2 className="display-title mx-auto mt-3.5 max-w-[22ch] text-ink text-[clamp(28px,4.6vw,44px)]">
                  Open the twin and read the evidence yourself.
                </h2>
                <p className="mx-auto mt-4 max-w-[52ch] text-muted text-[14.5px] leading-relaxed">
                  Gauges, dynamometer cards, the depth-stress field, the shared-seed A/B proof and the
                  hash-chained audit ledger — all driven by the same synthetic reduced-order model described
                  on this page.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <button type="button" className="btn btn-primary h-10 px-5" onClick={launch}>
                    Launch console
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <a
                    href="#scope"
                    onClick={(e) => goToSection(e, 'scope')}
                    className="btn btn-ghost h-10 px-5 no-underline"
                  >
                    Scope &amp; evidence status
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-hairline">
        <div className="cat-wrap py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="display-title text-[20px] text-ink">Catenary</span>
              <p className="caption mt-1.5 max-w-[46ch]">
                Physics-informed, evidence-aware advisory twin for CSS + SRP heavy-oil production systems.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => goToSection(e, s.id)}
                  className="cat-footlink"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
          <p className="unit-label mt-7 normal-case tracking-[0.04em] leading-relaxed">
            Class II supervisory advisory · non-actuating · not an IEC 61511 safety instrumented function ·
            all data synthetic · economics are a commercial hypothesis, not field-validated
          </p>
          {reduced && (
            <p className="caption mt-2">Reduced-motion preference detected — animation is held static.</p>
          )}
        </div>
      </footer>
    </div>
  );
}

function SubsystemCard({ item }) {
  const ref = useReveal();
  return (
    <article className="panel cat-reveal p-4 sm:p-5 flex flex-col" ref={ref}>
      <div className="flex items-start justify-between gap-3">
        <span className="readout text-[11px] font-semibold text-muted">0{item.n}</span>
        <span className={`pill tone-${item.tone} normal-case tracking-normal text-[10.5px]`}>{item.basis}</span>
      </div>
      <h3 className="mt-3 text-[15px] font-bold leading-snug text-ink">{item.name}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.body}</p>
    </article>
  );
}

export default Landing;

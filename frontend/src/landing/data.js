/* ============================================================================
   Catenary landing page — verified content model
   ----------------------------------------------------------------------------
   Every number in this file is sourced from the project dossier. Nothing here
   is illustrative, rounded for effect, or invented. If a figure is not in the
   dossier it does not appear on the landing page.
   ========================================================================== */

/** Nav sections. `id` must match the section element id in Landing.jsx. */
export const SECTIONS = [
  { id: 'physics', label: 'Physics', index: '01' },
  { id: 'gap', label: 'Landscape', index: '02' },
  { id: 'system', label: 'Architecture', index: '03' },
  { id: 'verification', label: 'Verification', index: '04' },
  { id: 'scope', label: 'Scope', index: '05' },
];

/* ---------------------------------------------------------------- physics -- */

/** Tabulated crude viscosity vs. near-wellbore temperature. */
export const VISCOSITY_TABLE = [
  { t: 260, mu: 12.4, note: 'post-soak' },
  { t: 200, mu: 45.0 },
  { t: 100, mu: 1180 },
  { t: 66, mu: 4920 },
  { t: 50, mu: 12000, note: 'near native' },
];

/** Peak water-in-oil emulsion multiplier (Brinkman–Vand), at 60 % water cut. */
export const EMULSION_PEAK = 6.118;
export const EMULSION_PEAK_WATER_CUT = 60;

/** Native (undisturbed) reservoir temperature, °C. */
export const NATIVE_TEMP_C = 48;
/** Post-soak near-wellbore temperature, °C. */
export const STEAM_TEMP_C = 260;

/** Downstroke axial load ledger, reference configuration. kN. */
export const LOAD_LEDGER = [
  {
    id: 'weight',
    label: 'Submerged rod weight',
    direction: 'acts downward',
    value: 7.2,
    tone: 'safe',
  },
  {
    id: 'drag',
    label: 'Viscous Couette drag',
    direction: 'acts upward on the downstroke',
    value: 23.6,
    tone: 'thermal',
  },
];

export const LOAD_NET = {
  label: 'Net axial load',
  value: -16.4,
  note: 'compression — the string helically buckles against the tubing wall',
};

export const FAILURE_MODES = [
  'Abrasive rod-on-tubing wear',
  'Tubing pinholes',
  'Cyclic fatigue parting',
  'Travelling-valve float',
  'Carrier-bar impact',
];

/* --------------------------------------------------------------- landscape -- */

export const INCUMBENTS = [
  { vendor: 'ChampionX', product: 'XSPOC / SMARTEN' },
  { vendor: 'Weatherford', product: 'ForeSite Edge' },
  { vendor: 'SLB', product: 'Lift IQ' },
  { vendor: 'Baker Hughes', product: 'Leucipa' },
  { vendor: 'Ambyint', product: 'InfinityRL' },
];

export const POSTURE = {
  reactive: {
    title: 'Card-based surveillance',
    kind: 'Reactive',
    tone: 'caution',
    points: [
      'Reads the dynamometer card the stroke has already produced.',
      'Diagnoses the stress anomaly after it has occurred.',
      'Carries no forward model of the reservoir thermal state.',
    ],
  },
  forward: {
    title: 'Coupled forward twin',
    kind: 'Predictive',
    tone: 'signal',
    points: [
      'Propagates thermal decay forward from the current soak state.',
      'Solves for minimum downhole tension before the stroke is commanded.',
      'Constrains the schedule so predicted tension never crosses zero.',
    ],
  },
};

/* ------------------------------------------------------------ architecture -- */

export const SUBSYSTEMS = [
  {
    n: '1',
    name: 'Thermal decay model',
    basis: 'Boberg–Lantz + convective heat removal',
    body: 'Carries the near-wellbore temperature from the 260 °C post-soak condition down toward the 48 °C native reservoir temperature, with heat removed convectively by the produced stream.',
    tone: 'thermal',
  },
  {
    n: '2',
    name: 'Emulsion rheology',
    basis: 'Two-point Arrhenius + Brinkman–Vand',
    body: 'µ(T) is anchored on tabulated crude viscosity; the co-produced water-in-oil emulsion multiplier peaks at 6.118× base viscosity at 60 % water cut.',
    tone: 'thermal',
  },
  {
    n: '3',
    name: 'Rod-wave solver',
    basis: 'Dual fidelity — surrogate + PDE',
    body: 'A ~2 ms 144-phase algebraic surrogate drives the inner optimisation loop; a ~120 ms 1-D damped-wave PDE with harmonic taper-area averaging and explicit CFL subcycling is the reference.',
    tone: 'signal',
  },
  {
    n: '4',
    name: 'Advisory MPC governor',
    basis: 'SLSQP-constrained',
    body: 'Enforces a +0.50 kN anti-float tension floor, a 99.0 kN peak polished-rod load ceiling, and a 0.25 SPM-per-step slew limit on the recommended schedule.',
    tone: 'signal',
  },
  {
    n: '5',
    name: 'Failsafe state machine',
    basis: '4 deterministic levels',
    body: 'Escalates L0 normal → L1 → L2 → L3 E-stop on deterministic rules, independently of the optimiser’s objective.',
    tone: 'critical',
  },
  {
    n: '6',
    name: 'Provenance ledger',
    basis: 'SHA-256 hash chain',
    body: 'Every state, recommendation and override is committed to a tamper-evident append-only ledger, so a run can be re-read after the fact.',
    tone: 'safe',
  },
  {
    n: '7',
    name: 'Operator console',
    basis: 'Evidence-aware surface',
    body: 'The twin, the recommendation it produced, and the evidence behind that recommendation are read side by side rather than in separate tools.',
    tone: 'signal',
  },
];

/* ------------------------------------------------------------ verification -- */

export const TEST_TIERS = [
  { tier: 'Tier 1', count: 186 },
  { tier: 'Tier 2', count: 50 },
  { tier: 'Tier 3', count: 26 },
  { tier: 'Tier 4', count: 54 },
  { tier: 'Tier 5', count: 10 },
];

export const TEST_TOTAL = 326;
export const TEST_RUNTIME_S = '80.99';

export const AB_EXPERIMENT = {
  seed: 42,
  steps: 24,
  baselineFloats: 19,
  twinFloats: 0,
  controls: ['identical latent cooling trajectory', 'identical noise draws', 'shared seed'],
};

export const SURROGATE = [
  { label: 'Mean inference', value: '5.89', unit: 'µs' },
  { label: 'R² — min. downhole tension', value: '0.9170', unit: '' },
  { label: 'Normalised RMSE', value: '6.19', unit: '%' },
];

/* -------------------------------------------------------------------- scope -- */

export const SCOPE_CARDS = [
  {
    id: 'class',
    kicker: 'Advisory class',
    title: 'Class II supervisory advisory',
    tone: 'signal',
    body: 'Catenary recommends; it does not actuate. There is no control path to field equipment. It is not an IEC 61511 safety instrumented function and must not be relied upon as one.',
  },
  {
    id: 'data',
    kicker: 'Data provenance',
    title: 'All data is synthetic',
    tone: 'caution',
    body: 'The reference configuration is inspired by publicly reported Baghewala field parameters. No operator affiliation, endorsement, or deployment is implied, and no proprietary or production data is used.',
  },
  {
    id: 'econ',
    kicker: 'Economics',
    title: 'A commercial hypothesis',
    tone: 'caution',
    body: 'Any economic figure produced by the system is a modelled hypothesis under stated assumptions. It is not field-validated and should not be read as a realised or forecast financial result.',
  },
  {
    id: 'status',
    kicker: 'Maturity',
    title: 'Judged research prototype',
    tone: 'signal',
    body: 'Built as a competition research artefact. The value on offer is the coupling — reservoir thermal state into rod elastodynamics into a constrained advisory schedule — and the evidence trail behind it.',
  },
];

export const REFERENCE_CONFIG = [
  { k: 'Formation', v: 'Jodhpur Sandstone' },
  { k: 'Basin', v: 'Bikaner–Nagaur, Rajasthan' },
  { k: 'Depth', v: '1,150 m TVD' },
  { k: 'Crude gravity', v: '16.5° API' },
  { k: 'Native reservoir temp.', v: '48 °C' },
  { k: 'Field context', v: '23 wells' },
  { k: 'Well', v: 'Synthetic, Well #14 inspired' },
  { k: 'Calibration', v: 'Baghewala public parameters' },
];

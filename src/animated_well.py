"""Animated schematic for synthetic reduced-order model outputs.

The visualization is illustrative: motion is derived from requested SPM, while
compression coloring is a screening alert—not a solved buckling/contact shape.
"""

import math


def render_animated_well_html(
    spm: float = 3.5,
    temp_c: float = 75.0,
    min_tension_kn: float = 0.65,
    is_buckling: bool = False,
    is_modbus_severed: bool = False,
    failsafe_level: str = "LEVEL_0_NORMAL",
    water_cut: float = 0.25,
    height_px: int = 680,
) -> str:
    """
    Generates a self-contained HTML document containing an animated SVG
    engineering schematic of the Baghewala Well #14 sucker rod pumping system.

    The reciprocation period is dynamically matched to the current SPM value.
    Visual effects distinguish a low-tension screen from a satisfied model floor.
    """
    safe_spm = max(0.5, float(spm))
    cycle_s = round(60.0 / safe_spm, 2)

    # Thermal plume: interpolate between cool slate and hot amber
    t_norm = max(0.0, min(1.0, (temp_c - 48.0) / (260.0 - 48.0)))
    r = int(100 + t_norm * (234 - 100))
    g = int(116 + t_norm * (88 - 116))
    b = int(139 + t_norm * (12 - 139))
    plume_rgb = f"rgb({r},{g},{b})"
    plume_alpha = round(0.12 + t_norm * 0.38, 2)

    # Structural state
    is_danger = is_buckling or (min_tension_kn < 0.5)
    sec3_stroke = "#c0392b" if is_danger else "#27ae60"
    sec3_anim = "buck" if is_danger else "recip"

    # Status text and colors
    if is_danger:
        status_text = "MODELED COMPRESSION ALERT — Min Tension Below +0.5 kN"
        st_fg = "#991b1b"
        st_bg = "#fef2f2"
        st_bd = "#fca5a5"
    elif is_modbus_severed:
        status_text = "SIMULATED TELEMETRY TIMEOUT — Protective Advisory Active"
        st_fg = "#92400e"
        st_bg = "#fffbeb"
        st_bd = "#fde68a"
    else:
        status_text = "MODEL SCREEN — Implemented Tension Floor Satisfied"
        st_fg = "#065f46"
        st_bg = "#ecfdf5"
        st_bd = "#a7f3d0"

    # Telemetry badge
    tele_text = "SIMULATED TIMEOUT" if is_modbus_severed else "SYNTHETIC STREAM"
    tele_color = "#c0392b" if is_modbus_severed else "#27ae60"
    tele_dot = "#c0392b" if is_modbus_severed else "#27ae60"

    # Viscosity estimate for annotation
    visc_cp = int(12000 * math.exp(-0.025 * (temp_c - 48)))

    vb_h = height_px - 20

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:#fff;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden}}
.frame{{width:100%;height:{height_px}px;position:relative;background:#fff;border:1px solid #e5e7eb;border-radius:6px}}

/* Status bar */
.sbar{{position:absolute;top:0;left:0;right:0;background:{st_bg};border-bottom:1px solid {st_bd};
padding:7px 14px;font-size:11px;font-weight:600;color:{st_fg};letter-spacing:0.01em;
border-radius:6px 6px 0 0;display:flex;justify-content:space-between;align-items:center;z-index:5}}
.sbar .right{{font-weight:500;font-size:10px;color:#64748b}}

/* Telemetry indicator */
.tele{{position:absolute;bottom:8px;left:12px;display:flex;align-items:center;gap:5px;
font-size:10px;font-weight:600;color:{tele_color};letter-spacing:0.02em;z-index:5}}
.tele-dot{{width:6px;height:6px;border-radius:50%;background:{tele_dot}}}

/* Labels */
.lbl{{font-family:'SF Mono','Fira Code','Cascadia Code',monospace;font-size:9px;fill:#94a3b8;letter-spacing:0.02em}}
.lbl-b{{font-weight:700;fill:#64748b}}
.lbl-dim{{font-size:8px;fill:#94a3b8}}
.sec-lbl{{font-size:9.5px;fill:#475569;font-weight:600}}

/* Animations */
@keyframes recip{{
  0%{{transform:translateY(-12px)}}
  50%{{transform:translateY(12px)}}
  100%{{transform:translateY(-12px)}}
}}
@keyframes beam{{
  0%{{transform:rotate(-8deg)}}
  50%{{transform:rotate(8deg)}}
  100%{{transform:rotate(-8deg)}}
}}
@keyframes buck{{
  0%{{transform:translateY(-12px) scaleX(1)}}
  20%{{transform:translateY(-4px) scaleX(1.6) translateX(-1px)}}
  40%{{transform:translateY(4px) scaleX(2.2) translateX(2px)}}
  60%{{transform:translateY(8px) scaleX(1.8) translateX(-1.5px)}}
  80%{{transform:translateY(12px) scaleX(1.3) translateX(1px)}}
  100%{{transform:translateY(-12px) scaleX(1)}}
}}
@keyframes plunger{{
  0%{{transform:translateY(-10px)}}
  45%{{transform:translateY(10px)}}
  55%{{transform:translateY(10px)}}
  100%{{transform:translateY(-10px)}}
}}
{"@keyframes flash{0%,100%{opacity:1}50%{opacity:0.3}}" if is_danger else ""}

.g-beam{{transform-origin:200px 85px;animation:beam {cycle_s}s ease-in-out infinite}}
.g-rod{{animation:recip {cycle_s}s ease-in-out infinite}}
.g-sec3{{animation:{sec3_anim} {cycle_s}s ease-in-out infinite;transform-origin:260px 490px}}
.g-plunger{{animation:plunger {cycle_s}s ease-in-out infinite}}
</style>
</head>
<body>
<div class="frame">
  <div class="sbar">
    <span>{status_text}</span>
    <span class="right">{safe_spm:.1f} SPM &middot; T = {cycle_s:.1f}s</span>
  </div>
  <div class="tele"><div class="tele-dot"></div>{tele_text}</div>

  <svg viewBox="0 0 520 {vb_h}" width="100%" height="{height_px - 20}px" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="pg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="{plume_rgb}" stop-opacity="{plume_alpha}"/>
        <stop offset="70%" stop-color="{plume_rgb}" stop-opacity="{round(plume_alpha * 0.25, 2)}"/>
        <stop offset="100%" stop-color="{plume_rgb}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="csg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#d1d5db"/>
        <stop offset="50%" stop-color="#e5e7eb"/>
        <stop offset="100%" stop-color="#d1d5db"/>
      </linearGradient>
      <linearGradient id="fluid" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#374151"/>
        <stop offset="50%" stop-color="#1f2937"/>
        <stop offset="100%" stop-color="#374151"/>
      </linearGradient>
      <linearGradient id="tbg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#9ca3af"/>
        <stop offset="50%" stop-color="#d1d5db"/>
        <stop offset="100%" stop-color="#9ca3af"/>
      </linearGradient>
    </defs>

    <!-- ── SURFACE SECTION ─────────────────────────── -->

    <!-- Ground surface -->
    <line x1="40" y1="148" x2="480" y2="148" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="6 3"/>
    <text x="45" y="162" class="lbl lbl-b">GROUND LEVEL — 0 m TVD</text>
    <text x="380" y="162" class="lbl">{safe_spm:.1f} SPM / {cycle_s:.1f}s cycle</text>

    <!-- Prime mover & gearbox -->
    <rect x="70" y="118" width="28" height="22" rx="3" fill="#e5e7eb" stroke="#9ca3af" stroke-width="1.2"/>
    <text x="74" y="133" class="lbl-dim">GEAR</text>
    <!-- Crank -->
    <circle cx="110" cy="125" r="18" fill="none" stroke="#9ca3af" stroke-width="1.5"/>
    <circle cx="110" cy="125" r="3.5" fill="#6b7280"/>
    <line x1="110" y1="125" x2="122" y2="112" stroke="#6b7280" stroke-width="2.5"/>
    <!-- Counterweight -->
    <rect x="117" y="106" width="14" height="10" rx="2" fill="#d1d5db" stroke="#9ca3af" stroke-width="1"/>

    <!-- Sampson post (A-frame) -->
    <line x1="170" y1="148" x2="200" y2="62" stroke="#374151" stroke-width="3"/>
    <line x1="230" y1="148" x2="200" y2="62" stroke="#374151" stroke-width="3"/>
    <line x1="180" y1="115" x2="220" y2="115" stroke="#6b7280" stroke-width="1.5"/>

    <!-- Pitman arm -->
    <line x1="122" y1="112" x2="165" y2="85" stroke="#6b7280" stroke-width="2"/>

    <!-- Walking beam (animated) -->
    <g class="g-beam">
      <line x1="140" y1="85" x2="280" y2="85" stroke="#374151" stroke-width="5" stroke-linecap="round"/>
      <!-- Center bearing -->
      <circle cx="200" cy="85" r="4.5" fill="#1f2937" stroke="#fff" stroke-width="1.2"/>
      <!-- Horsehead arc -->
      <path d="M 280 60 C 296 72, 300 98, 280 112" fill="none" stroke="#374151" stroke-width="5.5" stroke-linecap="round"/>
    </g>

    <!-- Bridle & carrier bar (reciprocating) -->
    <g class="g-rod">
      <line x1="288" y1="92" x2="288" y2="148" stroke="#6b7280" stroke-width="1.2" stroke-dasharray="2 1.5"/>
      <line x1="280" y1="92" x2="280" y2="148" stroke="#6b7280" stroke-width="1.2" stroke-dasharray="2 1.5"/>
      <rect x="275" y="145" width="18" height="5" rx="1.5" fill="#374151"/>
      <text x="296" y="150" class="lbl-dim">CARRIER BAR</text>
    </g>

    <!-- Wellhead -->
    <rect x="271" y="148" width="26" height="12" rx="2" fill="#d1d5db" stroke="#9ca3af" stroke-width="1.2"/>
    <text x="300" y="157" class="lbl-dim">WELLHEAD</text>

    <!-- ── SUBSURFACE WELLBORE ─────────────────────── -->

    <!-- Near-wellbore thermal plume -->
    <ellipse cx="284" cy="530" rx="95" ry="80" fill="url(#pg)"/>

    <!-- Outer casing -->
    <rect x="264" y="160" width="40" height="445" fill="url(#fluid)" stroke="url(#csg)" stroke-width="2.5" rx="1.5"/>

    <!-- Tubing strings (inner bore lines) -->
    <line x1="271" y1="160" x2="271" y2="575" stroke="#6b7280" stroke-width="0.8" stroke-dasharray="3 2"/>
    <line x1="297" y1="160" x2="297" y2="575" stroke="#6b7280" stroke-width="0.8" stroke-dasharray="3 2"/>

    <!-- Perforations at TD -->
    <g stroke="#9ca3af" stroke-width="1">
      <line x1="256" y1="570" x2="264" y2="573"/><line x1="256" y1="578" x2="264" y2="581"/>
      <line x1="256" y1="586" x2="264" y2="589"/><line x1="256" y1="594" x2="264" y2="597"/>
      <line x1="304" y1="570" x2="312" y2="573"/><line x1="304" y1="578" x2="312" y2="581"/>
      <line x1="304" y1="586" x2="312" y2="589"/><line x1="304" y1="594" x2="312" y2="597"/>
    </g>

    <!-- Depth scale & section annotations (left side) -->

    <!-- Section 1 marker: 0–350 m -->
    <line x1="100" y1="270" x2="264" y2="270" stroke="#e5e7eb" stroke-width="0.8" stroke-dasharray="4 2"/>
    <text x="105" y="215" class="sec-lbl">SECTION 1</text>
    <text x="105" y="228" class="lbl">1.000 in. rod  /  A = 5.067 cm²</text>
    <text x="105" y="240" class="lbl">0 – 350 m TVD</text>

    <!-- Section 2 marker: 350–750 m -->
    <line x1="100" y1="400" x2="264" y2="400" stroke="#e5e7eb" stroke-width="0.8" stroke-dasharray="4 2"/>
    <text x="105" y="340" class="sec-lbl">SECTION 2</text>
    <text x="105" y="353" class="lbl">0.875 in. rod  /  A = 3.879 cm²</text>
    <text x="105" y="365" class="lbl">350 – 750 m TVD</text>

    <!-- Section 3 marker: 750–1150 m -->
    <line x1="100" y1="550" x2="264" y2="550" stroke="#e5e7eb" stroke-width="0.8" stroke-dasharray="4 2"/>
    <text x="105" y="480" class="sec-lbl">SECTION 3</text>
    <text x="105" y="493" class="lbl">0.750 in. rod  /  A = 2.850 cm²</text>
    <text x="105" y="505" class="lbl">750 – 1,150 m TVD</text>

    <!-- Right side: thermal & formation annotations -->
    <text x="315" y="528" class="lbl lbl-b" fill="#92400e">STEAM ZONE</text>
    <text x="315" y="541" class="lbl" fill="#92400e">T = {temp_c:.0f} deg C</text>
    <text x="315" y="554" class="lbl" fill="#92400e">mu = {visc_cp:,} cP</text>
    <text x="315" y="580" class="lbl lbl-b">PERFORATIONS</text>
    <text x="315" y="593" class="lbl">1,150 m TVD — Jodhpur Sandstone</text>

    <!-- ── SUCKER ROD STRING (animated) ────────────── -->
    <g class="g-rod">
      <!-- Section 1: 1.0 in — blue steel -->
      <line x1="284" y1="148" x2="284" y2="270" stroke="#2563eb" stroke-width="4.5" stroke-linecap="round"/>

      <!-- Taper coupling 1 -->
      <rect x="279" y="267" width="10" height="6" rx="1.5" fill="#1f2937"/>

      <!-- Section 2: 7/8 in — slate -->
      <line x1="284" y1="273" x2="284" y2="400" stroke="#0d9488" stroke-width="3.5" stroke-linecap="round"/>

      <!-- Taper coupling 2 -->
      <rect x="280" y="397" width="8" height="6" rx="1.5" fill="#1f2937"/>

      <!-- Section 3: 3/4 in — green or red -->
      <g class="g-sec3">
        <line x1="284" y1="403" x2="284" y2="550" stroke="{sec3_stroke}" stroke-width="2.8" stroke-linecap="round"/>
      </g>

      <!-- Downhole pump assembly -->
      <g class="g-plunger">
        <rect x="275" y="548" width="18" height="30" rx="2" fill="#1f2937"/>
        <rect x="278" y="551" width="12" height="24" rx="1" fill="#60a5fa" opacity="0.7"/>
        <!-- Traveling valve -->
        <circle cx="284" cy="558" r="2.5" fill="#f59e0b"/>
        <text x="300" y="560" class="lbl-dim">TV</text>
        <!-- Standing valve -->
        <circle cx="284" cy="574" r="2.5" fill="#f59e0b"/>
        <text x="300" y="576" class="lbl-dim">SV</text>
      </g>
    </g>

    <!-- Structural alert overlay (only when danger) -->
    {f'''
    <g transform="translate(100, 555)" style="animation:flash 1.2s ease-in-out infinite">
      <rect x="0" y="0" width="155" height="42" rx="4" fill="#fef2f2" stroke="#fca5a5" stroke-width="1"/>
      <text x="8" y="15" font-size="9.5" font-weight="700" fill="#991b1b" font-family="Inter,sans-serif">LOW-TENSION MODEL ALERT</text>
      <text x="8" y="28" font-size="8.5" fill="#7f1d1d" font-family="Inter,sans-serif">F_min = {min_tension_kn:.2f} kN  (floor: +0.5 kN)</text>
      <text x="8" y="38" font-size="8" fill="#b91c1c" font-family="Inter,sans-serif">Buckling/contact mechanics not resolved</text>
    </g>
    ''' if is_danger else ''}

    <!-- Depth ruler (far left) -->
    <line x1="80" y1="160" x2="80" y2="600" stroke="#d1d5db" stroke-width="0.8"/>
    <g class="lbl-dim">
      <text x="60" y="163">0 m</text>
      <line x1="77" y1="160" x2="83" y2="160" stroke="#d1d5db" stroke-width="0.8"/>
      <text x="48" y="270">350 m</text>
      <line x1="77" y1="270" x2="83" y2="270" stroke="#d1d5db" stroke-width="0.8"/>
      <text x="48" y="400">750 m</text>
      <line x1="77" y1="400" x2="83" y2="400" stroke="#d1d5db" stroke-width="0.8"/>
      <text x="36" y="600">1,150 m</text>
      <line x1="77" y1="600" x2="83" y2="600" stroke="#d1d5db" stroke-width="0.8"/>
    </g>

  </svg>
</div>
</body>
</html>"""

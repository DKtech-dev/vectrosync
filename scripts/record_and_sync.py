import os
import sys
import time
import math
import json
import argparse
import subprocess
from faster_whisper import WhisperModel
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = "/home/dk/.gemini/antigravity/brain/d4e83e54-41c6-4683-acec-1a04cdf3d66c"
VIDEO_TEMP_DIR = "/home/dk/Documents/main/scratch/video_temp_sync"
os.makedirs(VIDEO_TEMP_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

PHASES_SPEC = [
    {
        "id": "01_intro",
        "tag": "1. CATENARY ENTERPRISE TWIN",
        "subtitle": "Real-time closed-loop physics-informed digital twin engineered for Oil India Limited's Baghewala Well #14 CSS + SRP asset in Rajasthan.",
        "keywords": ["welcome", "vectro", "bhagewala", "baghewala"]
    },
    {
        "id": "02_scada_arch",
        "tag": "SCADA ARCHITECTURE // EDGE & MODBUS",
        "subtitle": "Live edge controller profiling at 0.3 ms over industrial Modbus-TCP port 502 with supervisory state machine operating at Level 0 Normal.",
        "keywords": ["skada", "scada", "edge controller", "modbus", "level 0"]
    },
    {
        "id": "03_telemetry",
        "tag": "2. LIVE TELEMETRY STRIP",
        "subtitle": "Formation Temp: 218.8°C | Viscosity: 75 cP with low shear drag | Downhole Tension: +8.43 kN, safe above buckling threshold.",
        "keywords": ["examining live telemetry", "reservoir temperature", "centicoids", "centipoise", "kilonewton"]
    },
    {
        "id": "04_wellbore_dynacard",
        "tag": "3. SUBSURFACE WELLBORE & DYNACARD",
        "subtitle": "Subsurface wave solver simulates elastodynamics across 1,150m and 3 taper sections. Surface & downhole cards operate inside green envelope.",
        "keywords": ["subsurface wave", "1,150", "taper", "dynamometer"]
    },
    {
        "id": "05_stress_tab",
        "tag": "4. SPATIOTEMPORAL DEPTH-STRESS MAP",
        "subtitle": "Continuous axial stress tensor resolved across 144 nodes and 360° crank rotation, displaying stress gradients along each taper section.",
        "keywords": ["spatial temporal", "spatiotemporal", "depth stress", "144 nodes"]
    },
    {
        "id": "06_forecast_tab",
        "tag": "5. 12-HOUR MULTI-PHYSICS HORIZON",
        "subtitle": "Boberg-Lantz analytical decay forecasts reservoir heat loss, viscosity rise, and predicted rod tension trajectories.",
        "keywords": ["12r", "12-hour", "12 hour", "bobberdlands", "boberg"]
    },
    {
        "id": "07_basin_tab",
        "tag": "6. GEOSPATIAL BASIN SECTOR (23 WELLS)",
        "subtitle": "Aggregates 23 heavy-oil wells in Bikaner-Nagaur basin, projecting Rs 14.82 Cr in annual OpEx savings from avoided rod failures.",
        "keywords": ["geospatial basin", "23 heavy", "bikaner", "crore"]
    },
    {
        "id": "08_cockpit",
        "tag": "7. DISTURBANCE COCKPIT OVERRIDES",
        "subtitle": "Disturbance Cockpit allows petroleum engineers to simulate real reservoir cooling rates, steam quality drops, and water cut variations.",
        "keywords": ["opening the disturbance", "disturbance cockpit", "sensitivity"]
    },
    {
        "id": "09_scenario_a",
        "tag": "8. SCENARIO A: THE BAGHEWALA FREEZE",
        "subtitle": "Unmitigated cooling causes crude viscosity to surge to 11,800 cP. Hydrodynamic Couette drag causes buckling float at -1.81 kN, tripping L3 E-STOP.",
        "keywords": ["scenario a", "freeze", "11,800", "kuwait", "couette", "minus 1.81"]
    },
    {
        "id": "10_scenario_b",
        "tag": "9. SCENARIO B: COUPLED TWIN INTERVENTION",
        "subtitle": "Fast-Loop MPC proactively throttles speed to 2.8 SPM. Shear drag drops quadratically, recovering tension to +2.36 kN (Safe Envelope restored).",
        "keywords": ["scenario b", "fast loop", "first loop", "2.8 strokes", "recovering"]
    },
    {
        "id": "11_scenario_c",
        "tag": "10. SCENARIO C: MODBUS TELEMETRY LOSS",
        "subtitle": "Field Modbus telemetry severed (>60s). Supervisory state machine transitions to Level 2 Protective, executing 3-stroke ramp-down to 2.0 SPM.",
        "keywords": ["scenario c", "severed", "level to protective", "level 2", "2.0 strokes"]
    },
    {
        "id": "12_reset",
        "tag": "11. RESTORING NOMINAL ASSET HEALTH",
        "subtitle": "Resetting system restores calibrated conditions and clears all alarms. Autonomous, zero-mock cyber-physical protection for heavy-oil lift.",
        "keywords": ["resetting the system", "clears all alarms", "artificial lift"]
    }
]

INJECT_OVERLAY_SCRIPT = """
(() => {
  if (!document.getElementById('virtual-cursor')) {
    const cursor = document.createElement('div');
    cursor.id = 'virtual-cursor';
    cursor.style.position = 'fixed';
    cursor.style.top = '0px';
    cursor.style.left = '0px';
    cursor.style.width = '26px';
    cursor.style.height = '26px';
    cursor.style.zIndex = '999999';
    cursor.style.pointerEvents = 'none';
    cursor.style.transform = 'translate(100px, 100px)';
    cursor.style.transition = 'transform 0.08s ease-out';
    cursor.innerHTML = `
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));">
        <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35Z" fill="#0f172a" stroke="#ffffff" stroke-width="1.6"/>
      </svg>
      <div id="cursor-click-ring" style="position: absolute; top: -5px; left: -5px; width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid #0284c7; transform: scale(0); opacity: 0; pointer-events: none; transition: transform 0.35s cubic-bezier(0, 0.7, 0.1, 1), opacity 0.35s ease-out;"></div>
    `;
    document.body.appendChild(cursor);
  }

  if (!document.getElementById('demo-subtitle-container')) {
    const container = document.createElement('div');
    container.id = 'demo-subtitle-container';
    container.style.position = 'fixed';
    container.style.bottom = '28px';
    container.style.left = '50%';
    container.style.transform = 'translateX(-50%)';
    container.style.zIndex = '999998';
    container.style.pointerEvents = 'none';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.maxWidth = '920px';
    container.style.textAlign = 'center';
    container.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.transition = 'opacity 0.25s ease-in-out, transform 0.25s ease-in-out';

    container.innerHTML = `
      <div id="demo-subtitle-tag" style="background: #0284c7; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 14px; border-radius: 9999px; margin-bottom: 6px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4); border: 1px solid rgba(255,255,255,0.25);">
        CATENARY ENTERPRISE TWIN
      </div>
      <div id="demo-subtitle-text" style="background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(12px); color: #f8fafc; padding: 12px 26px; border-radius: 12px; font-size: 14.5px; font-weight: 500; line-height: 1.45; box-shadow: 0 12px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.18);">
        Initializing digital twin mission control console...
      </div>
    `;
    document.body.appendChild(container);
  }

  window.moveVirtualCursor = (x, y) => {
    const el = document.getElementById('virtual-cursor');
    if (el) el.style.transform = `translate(${x}px, ${y}px)`;
  };

  window.pulseVirtualCursor = () => {
    const ring = document.getElementById('cursor-click-ring');
    if (ring) {
      ring.style.transition = 'none';
      ring.style.transform = 'scale(0)';
      ring.style.opacity = '1';
      setTimeout(() => {
        ring.style.transition = 'transform 0.35s cubic-bezier(0, 0.7, 0.1, 1), opacity 0.35s ease-out';
        ring.style.transform = 'scale(1.8)';
        ring.style.opacity = '0';
      }, 20);
    }
  };

  window.setSubtitle = (tag, text) => {
    const tagEl = document.getElementById('demo-subtitle-tag');
    const textEl = document.getElementById('demo-subtitle-text');
    if (tagEl && textEl) {
      tagEl.innerText = tag;
      textEl.innerText = text;
    }
  };
})();
"""

class CursorDriver:
    def __init__(self, page):
        self.page = page
        self.cur_x = 200.0
        self.cur_y = 200.0

    def set_subtitle(self, tag, text):
        print(f"[{tag}] {text}")
        self.page.evaluate("([t, x]) => window.setSubtitle(t, x)", [tag, text])

    def move_to(self, target_x, target_y, steps=22, duration=0.45, hover_after=0.2):
        start_x = self.cur_x
        start_y = self.cur_y
        step_dt = duration / max(steps, 1)

        for i in range(1, steps + 1):
            t = i / steps
            t_smooth = 0.5 * (1 - math.cos(t * math.pi))
            x = start_x + (target_x - start_x) * t_smooth
            y = start_y + (target_y - start_y) * t_smooth
            self.page.evaluate("([x, y]) => window.moveVirtualCursor(x, y)", [x, y])
            self.page.mouse.move(x, y)
            time.sleep(step_dt)

        self.cur_x = target_x
        self.cur_y = target_y
        if hover_after > 0:
            time.sleep(hover_after)

    def hover_locator(self, locator, steps=22, duration=0.45, hover_after=0.4):
        loc = locator.first
        try:
            loc.wait_for(state="visible", timeout=3000)
            box = loc.bounding_box()
            if box:
                cx = box["x"] + box["width"] / 2
                cy = box["y"] + box["height"] / 2
                self.move_to(cx, cy, steps=steps, duration=duration, hover_after=hover_after)
        except Exception as e:
            print(f"Warning hover: {e}")

    def click_locator(self, locator, steps=22, duration=0.45, hover_after=0.4):
        loc = locator.first
        try:
            loc.wait_for(state="visible", timeout=3000)
            box = loc.bounding_box()
            if box:
                cx = box["x"] + box["width"] / 2
                cy = box["y"] + box["height"] / 2
                self.move_to(cx, cy, steps=steps, duration=duration, hover_after=0.1)
                self.page.evaluate("() => window.pulseVirtualCursor()")
                self.page.mouse.click(cx, cy)
                if hover_after > 0:
                    time.sleep(hover_after)
        except Exception as e:
            print(f"Warning click: {e}")

def get_audio_duration(audio_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return float(res.stdout.strip())

def extract_phase_durations(audio_path):
    print(f"Transcribing {audio_path} using faster-whisper tiny to calibrate exact timings...")
    model = WhisperModel("tiny", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, beam_size=5)
    segs = list(segments)
    total_audio_sec = get_audio_duration(audio_path)

    current_idx = 0
    phase_start = 0.0
    computed_phases = []

    for s in segs:
        text_lower = s.text.lower()
        if current_idx < len(PHASES_SPEC) - 1:
            next_keys = PHASES_SPEC[current_idx + 1]["keywords"]
            if any(k in text_lower for k in next_keys):
                computed_phases.append({
                    **PHASES_SPEC[current_idx],
                    "start": phase_start,
                    "end": s.start,
                    "duration": max(s.start - phase_start, 4.0)
                })
                current_idx += 1
                phase_start = s.start

    computed_phases.append({
        **PHASES_SPEC[current_idx],
        "start": phase_start,
        "end": total_audio_sec,
        "duration": max(total_audio_sec - phase_start, 4.0)
    })

    print("--- CALIBRATED PHASE TIMINGS ---")
    for p in computed_phases:
        print(f"[{p['id']}] {p['start']:6.2f}s -> {p['end']:6.2f}s (duration: {p['duration']:.2f}s)")
    print(f"Total audio duration: {total_audio_sec:.2f}s")
    return computed_phases, total_audio_sec

def record_and_sync(audio_path, output_name="Catenary_Enterprise_Demonstration"):
    phases, total_duration = extract_phase_durations(audio_path)

    print("Launching synchronized Playwright browser session...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=VIDEO_TEMP_DIR,
            record_video_size={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        print("Navigating to http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000", wait_until="networkidle")
        time.sleep(0.5)

        page.evaluate(INJECT_OVERLAY_SCRIPT)
        driver = CursorDriver(page)
        driver.move_to(300, 200, steps=10, duration=0.2)

        def execute_phase(index, actions_fn):
            item = phases[index]
            target_sec = item["duration"]
            t0 = time.time()
            driver.set_subtitle(item["tag"], item["subtitle"])
            print(f">>> Phase {index+1}/{len(phases)}: {item['id']} (Target: {target_sec:.2f}s)")
            actions_fn(target_sec)
            elapsed = time.time() - t0
            rem = target_sec - elapsed
            if rem > 0:
                print(f"    Pacing remaining: {rem:.2f}s")
                time.sleep(rem)
            else:
                print(f"    Completed in {elapsed:.2f}s (Target: {target_sec:.2f}s)")

        # Phase 0: Intro
        def phase_0(dur):
            sub_d = dur / 4.0
            driver.hover_locator(page.locator("text=Catenary Enterprise Industrial Twin").first, duration=0.5, hover_after=sub_d*0.6)
            driver.hover_locator(page.locator("text=OIL-BAGHEWALA-EOR-V2").first, duration=0.4, hover_after=sub_d*0.6)
            driver.hover_locator(page.locator("text=CSS+SRP OPTIMIZER").first, duration=0.4, hover_after=sub_d*0.6)
            driver.move_to(600, 80, duration=0.5, hover_after=sub_d*0.6)
        execute_phase(0, phase_0)

        # Phase 1: SCADA Arch & Edge Controller
        def phase_1(dur):
            sub_d = dur / 3.0
            driver.hover_locator(page.locator("text=EDGE CONTROLLER:").first, duration=0.5, hover_after=sub_d*0.7)
            driver.hover_locator(page.locator("text=PORT 502").first, duration=0.5, hover_after=sub_d*0.7)
            driver.hover_locator(page.locator("text=L0 NORMAL").first, duration=0.5, hover_after=sub_d*0.7)
        execute_phase(1, phase_1)

        # Phase 2: Live Telemetry Strip
        def phase_2(dur):
            sub_d = dur / 4.0
            driver.hover_locator(page.locator("text=Formation Temp").first, duration=0.5, hover_after=sub_d*0.7)
            driver.hover_locator(page.locator("text=Crude Viscosity").first, duration=0.5, hover_after=sub_d*0.7)
            driver.hover_locator(page.locator("text=Min Downhole Tension").first, duration=0.5, hover_after=sub_d*0.7)
            driver.hover_locator(page.locator("text=Operating Speed").first, duration=0.5, hover_after=sub_d*0.7)
        execute_phase(2, phase_2)

        # Phase 3: Subsurface Wellbore & Dynacard
        def phase_3(dur):
            sub_d = dur / 5.0
            driver.move_to(360, 480, duration=0.4, hover_after=sub_d*0.7) # Surface unit
            driver.move_to(360, 720, duration=0.4, hover_after=sub_d*0.7) # Taper 2
            driver.move_to(360, 860, duration=0.4, hover_after=sub_d*0.7) # Pump intake
            driver.move_to(650, 600, duration=0.5, hover_after=sub_d*0.7) # Surface card
            driver.move_to(1250, 600, duration=0.5, hover_after=sub_d*0.7) # Downhole card
        execute_phase(3, phase_3)

        # Phase 4: Spatiotemporal Depth-Stress Map
        def phase_4(dur):
            sub_d = dur / 4.0
            driver.click_locator(page.locator("button:has-text('Spatiotemporal Depth-Stress Map')").first, duration=0.5, hover_after=sub_d*0.6)
            driver.move_to(1100, 520, duration=0.7, hover_after=sub_d*0.8) # Heatmap center
            driver.move_to(800, 780, duration=0.5, hover_after=sub_d*0.6)  # Taper 1
            driver.move_to(1450, 780, duration=0.5, hover_after=sub_d*0.6) # Taper 3
        execute_phase(4, phase_4)

        # Phase 5: 12-Hour Multi-Physics Horizon
        def phase_5(dur):
            sub_d = dur / 3.0
            driver.click_locator(page.locator("button:has-text('12-Hour Multi-Physics Horizon')").first, duration=0.5, hover_after=sub_d*0.6)
            driver.move_to(900, 490, duration=0.5, hover_after=sub_d*0.7)  # Temp forecast
            driver.move_to(1300, 490, duration=0.5, hover_after=sub_d*0.7) # Viscosity forecast
        execute_phase(5, phase_5)

        # Phase 6: Geospatial Basin Sector
        def phase_6(dur):
            sub_d = dur / 2.0
            driver.click_locator(page.locator("button:has-text('Geospatial Basin Sector (23 Wells)')").first, duration=0.5, hover_after=sub_d*0.8)
            driver.move_to(1100, 560, duration=0.6, hover_after=sub_d*0.8) # Basin map center
        execute_phase(6, phase_6)

        # Phase 7: Disturbance Cockpit Overrides
        def phase_7(dur):
            sub_d = dur / 4.0
            driver.click_locator(page.locator("button:has-text('Dynamometer P-V Loop Studio')").first, duration=0.4, hover_after=sub_d*0.6)
            driver.click_locator(page.locator("button:has-text('COCKPIT')").first, duration=0.4, hover_after=sub_d*0.6)
            driver.move_to(1700, 200, duration=0.4, hover_after=sub_d*0.6) # Cooling slider
            driver.click_locator(page.locator("div.fixed button").first, duration=0.4, hover_after=sub_d*0.6) # Close drawer
        execute_phase(7, phase_7)

        # Phase 8: Scenario A (Freeze)
        def phase_8(dur):
            sub_d = dur / 6.0
            driver.click_locator(page.locator("button:has-text('Scenario A (Freeze)')").first, duration=0.5, hover_after=sub_d*0.8)
            driver.hover_locator(page.locator("text=11.8k").first, duration=0.5, hover_after=sub_d*0.8) # Viscosity surge
            driver.hover_locator(page.locator("text=-1.81").first, duration=0.5, hover_after=sub_d*0.8) # Compressive float
            driver.move_to(360, 800, duration=0.5, hover_after=sub_d*0.8) # Wellbore buckling
            driver.move_to(1250, 630, duration=0.5, hover_after=sub_d*0.8) # Buckled dynacard
            driver.hover_locator(page.locator("text=L3 E-STOP").first, duration=0.5, hover_after=sub_d*0.8)
        execute_phase(8, phase_8)

        # Phase 9: Scenario B (Coupled Twin)
        def phase_9(dur):
            sub_d = dur / 4.0
            driver.click_locator(page.locator("button:has-text('Scenario B (Twin)')").first, duration=0.4, hover_after=sub_d*0.8)
            driver.hover_locator(page.locator("text=2.8").first, duration=0.5, hover_after=sub_d*0.8) # Throttled speed
            driver.hover_locator(page.locator("text=+2.36").first, duration=0.5, hover_after=sub_d*0.8) # Restored tension
            driver.move_to(1250, 560, duration=0.5, hover_after=sub_d*0.8) # Green envelope
        execute_phase(9, phase_9)

        # Phase 10: Scenario C (Modbus Loss)
        def phase_10(dur):
            sub_d = dur / 4.0
            driver.click_locator(page.locator("button:has-text('Sever Modbus')").first, duration=0.5, hover_after=sub_d*0.8)
            driver.hover_locator(page.locator("text=PORT 502").first, duration=0.5, hover_after=sub_d*0.8)
            driver.hover_locator(page.locator("text=L2 PROTECTIVE").first, duration=0.5, hover_after=sub_d*0.8)
            driver.hover_locator(page.locator("text=2.0").first, duration=0.5, hover_after=sub_d*0.8)
        execute_phase(10, phase_10)

        # Phase 11: Reset & Conclusion
        def phase_11(dur):
            sub_d = dur / 3.0
            driver.click_locator(page.locator("button:has-text('Reset')").first, duration=0.4, hover_after=sub_d*0.8)
            driver.hover_locator(page.locator("text=L0 NORMAL").first, duration=0.5, hover_after=sub_d*0.8)
            driver.move_to(960, 540, duration=0.8, hover_after=sub_d*0.8)
        execute_phase(11, phase_11)

        time.sleep(0.5)
        video = page.video
        raw_video_path = video.path() if video else None

        context.close()
        browser.close()

        if not raw_video_path or not os.path.exists(raw_video_path):
            print("Error: Raw video not recorded.")
            return

        print(f"Raw video recorded: {raw_video_path} ({os.path.getsize(raw_video_path)} bytes)")

        # Target WebM
        dest_webm = os.path.join(ARTIFACT_DIR, f"{output_name}.webm")
        dest_artifact_webm = os.path.join(ARTIFACT_DIR, "catenary_scada_demonstration.webm")
        dest_mp4 = os.path.join("/home/dk/Documents/main", f"{output_name}.mp4")

        print(f"Multiplexing into WebM: {dest_webm}...")
        cmd_webm = [
            "ffmpeg", "-y",
            "-i", raw_video_path,
            "-i", audio_path,
            "-c:v", "copy",
            "-c:a", "libopus",
            "-b:a", "128k",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            dest_webm
        ]
        subprocess.run(cmd_webm, check=True)

        if dest_webm != dest_artifact_webm:
            import shutil
            shutil.copyfile(dest_webm, dest_artifact_webm)

        print(f"Converting into MP4: {dest_mp4}...")
        cmd_mp4 = [
            "ffmpeg", "-y",
            "-i", dest_webm,
            "-c:v", "mpeg4",
            "-q:v", "2",
            "-c:a", "aac",
            "-b:a", "192k",
            dest_mp4
        ]
        subprocess.run(cmd_mp4, check=True)

        print(f"SUCCESS!")
        print(f"WebM: {dest_webm} ({os.path.getsize(dest_webm):,} bytes)")
        print(f"MP4:  {dest_mp4} ({os.path.getsize(dest_mp4):,} bytes)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", default="/home/dk/Documents/main/clean_audio_prabhat.mp3")
    parser.add_argument("--name", default="Catenary_Enterprise_Demonstration")
    args = parser.parse_args()
    record_and_sync(args.audio, args.name)

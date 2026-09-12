import os
import sys
import time
import math
import json
import subprocess
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = "/home/dk/.gemini/antigravity/brain/d4e83e54-41c6-4683-acec-1a04cdf3d66c"
VIDEO_TEMP_DIR = "/home/dk/Documents/main/scratch/video_temp_clean"
USER_AUDIO = "/home/dk/Documents/main/audio.mp3"
SRT_FILE = "/home/dk/Documents/main/subtitles.srt"

os.makedirs(VIDEO_TEMP_DIR, exist_ok=True)
os.makedirs(ARTIFACT_DIR, exist_ok=True)

# 22 Visual choreography actions with absolute start and end times matching audio.mp3
VISUAL_ACTIONS = [
    {"id": "01_intro", "start": 0.00, "end": 6.88, "action": "hover_title"},
    {"id": "02_attr", "start": 6.88, "end": 17.20, "action": "hover_attr"},
    {"id": "03_css_pump", "start": 17.20, "end": 26.48, "action": "wellbore_pump"},
    {"id": "04_cooling", "start": 26.48, "end": 36.32, "action": "wellbore_tapers"},
    {"id": "05_couette", "start": 36.32, "end": 44.88, "action": "wellbore_intake"},
    {"id": "06_buckling", "start": 44.88, "end": 53.76, "action": "wellbore_taper3"},
    {"id": "07_reactive", "start": 53.76, "end": 63.84, "action": "why_console"},
    {"id": "08_problem", "start": 63.84, "end": 72.08, "action": "overview_banner"},
    {"id": "09_edge_intro", "start": 72.08, "end": 77.76, "action": "glance_header"},
    {"id": "10_edge_modbus", "start": 77.76, "end": 90.80, "action": "inspect_header"},
    {"id": "11_telemetry", "start": 90.80, "end": 105.28, "action": "inspect_telemetry"},
    {"id": "12_dynacards", "start": 105.28, "end": 112.00, "action": "inspect_dynacards"},
    {"id": "13_tab2_stress", "start": 112.00, "end": 130.24, "action": "tab2_stress_map"},
    {"id": "14_tab3_horizon", "start": 130.24, "end": 144.48, "action": "tab3_horizon"},
    {"id": "15_scenario_a_click", "start": 144.48, "end": 152.88, "action": "click_scenario_a"},
    {"id": "16_scenario_a_cooling", "start": 152.88, "end": 162.32, "action": "scenario_a_telemetry"},
    {"id": "17_scenario_a_buckling", "start": 162.32, "end": 180.56, "action": "scenario_a_hazard"},
    {"id": "18_scenario_b_click", "start": 180.56, "end": 198.00, "action": "click_scenario_b"},
    {"id": "19_scenario_b_recovery", "start": 198.00, "end": 215.04, "action": "scenario_b_envelope"},
    {"id": "20_scenario_c_sever", "start": 215.04, "end": 237.20, "action": "click_scenario_c"},
    {"id": "21_tab4_basin", "start": 237.20, "end": 255.04, "action": "tab4_basin"},
    {"id": "22_reset_close", "start": 255.04, "end": 264.89, "action": "click_reset"}
]

# Injected script: ONLY the sleek virtual cursor and click ring (NO DOM subtitle box)
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
})();
"""

class AbsoluteCursorDriver:
    def __init__(self, page, t_start):
        self.page = page
        self.t_start = t_start
        self.cur_x = 960.0
        self.cur_y = 200.0

    def wait_until(self, target_sec):
        now = time.time() - self.t_start
        rem = target_sec - now
        if rem > 0:
            time.sleep(rem)

    def move_to(self, target_x, target_y, steps=18, duration=0.40):
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

    def click_at(self, target_x, target_y, duration=0.40):
        self.move_to(target_x, target_y, duration=duration)
        self.page.evaluate("() => window.pulseVirtualCursor()")
        self.page.mouse.click(target_x, target_y)

def run():
    print("Launching Playwright for clean 1080p recording with absolute timing lock...")
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

        # Baseline button coordinates for zero-latency interactions
        BTN_SCENARIO_A = (705, 75)
        BTN_SCENARIO_B = (805, 75)
        BTN_SEVER_MODBUS = (895, 75)
        BTN_RESET = (950, 75)
        TAB_STUDIO = (495, 335)
        TAB_STRESS = (630, 335)
        TAB_HORIZON = (755, 335)
        TAB_BASIN = (890, 335)

        t_zero = time.time()
        driver = AbsoluteCursorDriver(page, t_zero)
        driver.move_to(960, 200, duration=0.2)

        print("=== STARTING ABSOLUTELY TIMED VISUAL CHOREOGRAPHY ===")
        for item in VISUAL_ACTIONS:
            driver.wait_until(item["start"])
            aid = item["action"]
            dur = item["end"] - item["start"]
            print(f"[{item['start']:6.2f}s] Action: {item['id']} ({aid})")

            if aid == "hover_title":
                driver.move_to(200, 35, duration=0.5)
            elif aid == "hover_attr":
                driver.move_to(330, 35, duration=0.4)
                time.sleep(1.2)
                driver.move_to(450, 42, duration=0.5)
            elif aid == "wellbore_pump":
                driver.move_to(360, 480, duration=0.6)
            elif aid == "wellbore_tapers":
                driver.move_to(360, 620, duration=0.5)
                time.sleep(dur * 0.4)
                driver.move_to(360, 780, duration=0.5)
            elif aid == "wellbore_intake":
                driver.move_to(360, 870, duration=0.5)
            elif aid == "wellbore_taper3":
                driver.move_to(360, 750, duration=0.5)
                time.sleep(dur * 0.4)
                driver.move_to(360, 680, duration=0.5)
            elif aid == "why_console":
                driver.move_to(200, 960, duration=0.5)
            elif aid == "overview_banner":
                driver.move_to(300, 140, duration=0.5)
            elif aid == "glance_header":
                driver.move_to(650, 42, duration=0.5)
            elif aid == "inspect_header":
                driver.move_to(540, 35, duration=0.5)
                time.sleep(dur * 0.3)
                driver.move_to(660, 35, duration=0.4)
                time.sleep(dur * 0.3)
                driver.move_to(760, 35, duration=0.4)
            elif aid == "inspect_telemetry":
                sub_d = dur / 4.0
                driver.move_to(120, 230, duration=0.5)
                time.sleep(sub_d * 0.7)
                driver.move_to(330, 230, duration=0.4)
                time.sleep(sub_d * 0.7)
                driver.move_to(550, 230, duration=0.4)
                time.sleep(sub_d * 0.7)
                driver.move_to(770, 230, duration=0.4)
            elif aid == "inspect_dynacards":
                driver.move_to(650, 600, duration=0.5)
                time.sleep(dur * 0.4)
                driver.move_to(1250, 600, duration=0.5)
            elif aid == "tab2_stress_map":
                driver.click_at(TAB_STRESS[0], TAB_STRESS[1], duration=0.4)
                time.sleep(1.0)
                driver.move_to(1100, 520, duration=0.6)
                time.sleep(dur * 0.3)
                driver.move_to(800, 780, duration=0.4)
                time.sleep(dur * 0.3)
                driver.move_to(1450, 780, duration=0.4)
            elif aid == "tab3_horizon":
                driver.click_at(TAB_HORIZON[0], TAB_HORIZON[1], duration=0.4)
                time.sleep(1.0)
                driver.move_to(900, 490, duration=0.5)
                time.sleep(dur * 0.3)
                driver.move_to(1300, 490, duration=0.4)
                time.sleep(dur * 0.3)
                driver.move_to(1100, 680, duration=0.4)
            elif aid == "click_scenario_a":
                driver.click_at(BTN_SCENARIO_A[0], BTN_SCENARIO_A[1], duration=0.4)
            elif aid == "scenario_a_telemetry":
                driver.move_to(120, 230, duration=0.4)
                time.sleep(dur * 0.4)
                driver.move_to(330, 230, duration=0.4)
            elif aid == "scenario_a_hazard":
                driver.move_to(550, 230, duration=0.4)
                time.sleep(dur * 0.25)
                driver.move_to(360, 800, duration=0.5)
                time.sleep(dur * 0.25)
                driver.move_to(1250, 630, duration=0.5)
                time.sleep(dur * 0.25)
                driver.move_to(760, 35, duration=0.4)
            elif aid == "click_scenario_b":
                driver.click_at(BTN_SCENARIO_B[0], BTN_SCENARIO_B[1], duration=0.4)
                time.sleep(1.2)
                driver.move_to(770, 230, duration=0.4)
            elif aid == "scenario_b_envelope":
                driver.move_to(550, 230, duration=0.4)
                time.sleep(dur * 0.3)
                driver.move_to(360, 700, duration=0.5)
                time.sleep(dur * 0.3)
                driver.move_to(1250, 560, duration=0.5)
            elif aid == "click_scenario_c":
                driver.click_at(BTN_SEVER_MODBUS[0], BTN_SEVER_MODBUS[1], duration=0.4)
                time.sleep(1.2)
                driver.move_to(660, 35, duration=0.4)
                time.sleep(dur * 0.3)
                driver.move_to(760, 35, duration=0.4)
                time.sleep(dur * 0.3)
                driver.move_to(770, 230, duration=0.4)
            elif aid == "tab4_basin":
                driver.click_at(TAB_BASIN[0], TAB_BASIN[1], duration=0.4)
                time.sleep(1.2)
                driver.move_to(1100, 560, duration=0.6)
                time.sleep(dur * 0.4)
                driver.move_to(1050, 780, duration=0.5)
            elif aid == "click_reset":
                driver.click_at(TAB_STUDIO[0], TAB_STUDIO[1], duration=0.3)
                time.sleep(0.5)
                driver.click_at(BTN_RESET[0], BTN_RESET[1], duration=0.4)
                time.sleep(1.0)
                driver.move_to(760, 35, duration=0.4)
                time.sleep(1.0)
                driver.move_to(960, 540, duration=0.8)

        driver.wait_until(264.89)
        time.sleep(0.5)
        video = page.video
        raw_video_path = video.path() if video else None

        context.close()
        browser.close()

        if not raw_video_path or not os.path.exists(raw_video_path):
            print("Error: Raw video not recorded.")
            return

        print(f"Raw video recorded: {raw_video_path} ({os.path.getsize(raw_video_path)} bytes)")

        # Multiplex raw video with audio + burn REAL-TIME LOW NON-DISTURBING SUBTITLES
        dest_webm = os.path.join(ARTIFACT_DIR, "catenary_scada_demonstration.webm")
        dest_mp4 = "/home/dk/Documents/main/Catenary_Winning_Demo.mp4"

        # Style: Bottom-aligned (MarginV=16), clean white text, crisp black outline (Outline=2.2, Shadow=1.0),
        # NO opaque box (BorderStyle=1), compact 18pt font. Completely non-disturbing, true YouTube-style captions!
        sub_style = "FontName=DejaVu Sans,FontSize=18,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2.2,Shadow=1.0,MarginV=16"

        print(f"Multiplexing and burning real-time subtitles into MP4: {dest_mp4}...")
        cmd_mp4 = [
            "ffmpeg", "-y",
            "-i", raw_video_path,
            "-i", USER_AUDIO,
            "-vf", f"subtitles={SRT_FILE}:force_style='{sub_style}'",
            "-c:v", "mpeg4",
            "-q:v", "2",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            dest_mp4
        ]
        subprocess.run(cmd_mp4, check=True)

        print(f"Multiplexing and burning real-time subtitles into WebM: {dest_webm}...")
        cmd_webm = [
            "ffmpeg", "-y",
            "-i", raw_video_path,
            "-i", USER_AUDIO,
            "-vf", f"subtitles={SRT_FILE}:force_style='{sub_style}'",
            "-c:v", "libvpx",
            "-b:v", "1200k",
            "-c:a", "libopus",
            "-b:a", "128k",
            "-shortest",
            dest_webm
        ]
        subprocess.run(cmd_webm, check=True)

        print("=== FINAL DEMO RECORDING & SUBTITLE SYNCHRONIZATION COMPLETE ===")
        print(f"MP4:  {dest_mp4} ({os.path.getsize(dest_mp4):,} bytes)")
        print(f"WebM: {dest_webm} ({os.path.getsize(dest_webm):,} bytes)")

if __name__ == "__main__":
    run()

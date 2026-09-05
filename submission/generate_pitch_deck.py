#!/usr/bin/env python3
"""
VectroSync Pitch Deck Generator - TSM TECHNOVA 2026 (Light Theme Edition)
Compiles a publication-grade, ultra-modern, professional 10-slide 16:9 presentation.
Styled in Apple / Stripe executive light theme with rich vector infographics,
stat ribbons, comparison tables, process flows, and exact rubric alignment.
"""

import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# ==============================================================================
# COLOR PALETTE (Modern Executive Light Theme)
# ==============================================================================
COLOR_BG = RGBColor(248, 250, 252)          # Slate-50 (#F8FAFC)
COLOR_CARD_BG = RGBColor(255, 255, 255)     # Pure White (#FFFFFF)
COLOR_BORDER = RGBColor(226, 232, 240)      # Slate-200 (#E2E8F0)
COLOR_BORDER_STRONG = RGBColor(203, 213, 225) # Slate-300 (#CBD5E1)

COLOR_TEXT_PRIMARY = RGBColor(15, 23, 42)   # Slate-900 (#0F172A)
COLOR_TEXT_SECONDARY = RGBColor(51, 65, 85) # Slate-700 (#334155)
COLOR_TEXT_MUTED = RGBColor(100, 116, 139)  # Slate-500 (#64748B)

COLOR_PRIMARY = RGBColor(2, 132, 199)       # Sky-600 Tech Blue (#0284C7)
COLOR_PRIMARY_DARK = RGBColor(3, 105, 161)  # Sky-700 (#0369A1)
COLOR_PRIMARY_LIGHT = RGBColor(224, 242, 254) # Sky-100 (#E0F2FE)

COLOR_EMERALD = RGBColor(5, 150, 105)       # Emerald-600 (#059669)
COLOR_EMERALD_LIGHT = RGBColor(236, 253, 245) # Emerald-50 (#ECFDF5)
COLOR_EMERALD_BORDER = RGBColor(167, 243, 208) # Emerald-200 (#A7F3D0)

COLOR_CRIMSON = RGBColor(220, 38, 38)       # Red-600 (#DC2626)
COLOR_CRIMSON_LIGHT = RGBColor(254, 242, 242) # Red-50 (#FEF2F2)
COLOR_CRIMSON_BORDER = RGBColor(254, 202, 202) # Red-200 (#FECACA)

COLOR_AMBER = RGBColor(217, 119, 6)         # Amber-600 (#D97706)
COLOR_AMBER_LIGHT = RGBColor(254, 243, 199) # Amber-100 (#FEF3C7)
COLOR_AMBER_BORDER = RGBColor(253, 230, 138) # Amber-200 (#FDE68A)

COLOR_INDIGO = RGBColor(79, 70, 229)        # Indigo-600 (#4F46E5)
COLOR_INDIGO_LIGHT = RGBColor(238, 242, 255) # Indigo-50 (#EEF2FF)
COLOR_INDIGO_BORDER = RGBColor(199, 210, 254) # Indigo-200 (#C7D2FE)

FONT_HEADING = "Helvetica Neue"
FONT_BODY = "Arial"


class PitchDeckBuilder:
    def __init__(self):
        self.prs = Presentation()
        self.prs.slide_width = Inches(13.333)
        self.prs.slide_height = Inches(7.5)
        self.blank_layout = self.prs.slide_layouts[6]

    def add_blank_slide(self):
        slide = self.prs.slides.add_slide(self.blank_layout)
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = COLOR_BG
        bg.line.color.rgb = COLOR_BG
        return slide

    def add_header(self, slide, tag: str, title: str, subtitle: str):
        tag_width = Inches(max(2.8, len(tag) * 0.082))
        tag_shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(0.4), tag_width, Inches(0.3))
        tag_shape.fill.solid()
        tag_shape.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT
        tag_shape.line.color.rgb = RGBColor(186, 230, 253)
        tag_shape.line.width = Pt(1)
        tf_tag = tag_shape.text_frame
        tf_tag.vertical_anchor = MSO_ANCHOR.MIDDLE
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = tag.upper()
        p_tag.font.name = FONT_HEADING
        p_tag.font.size = Pt(8.5)
        p_tag.font.bold = True
        p_tag.font.color.rgb = COLOR_PRIMARY_DARK

        tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.72), Inches(11.733), Inches(0.98))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p_title = tf.paragraphs[0]
        p_title.text = title
        p_title.font.name = FONT_HEADING
        p_title.font.size = Pt(21)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_PRIMARY

        p_sub = tf.add_paragraph()
        p_sub.text = subtitle
        p_sub.font.name = FONT_BODY
        p_sub.font.size = Pt(10.5)
        p_sub.font.color.rgb = COLOR_TEXT_MUTED
        p_sub.space_before = Pt(3)

    def add_card(self, slide, left, top, width, height, bg_color=COLOR_CARD_BG, border_color=COLOR_BORDER):
        card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        card.fill.solid()
        card.fill.fore_color.rgb = bg_color
        card.line.color.rgb = border_color
        card.line.width = Pt(1.2)
        return card

    def add_stat_card(self, slide, left, top, width, height, stat_value, stat_label, sub_label="", value_color=COLOR_PRIMARY, bg_color=COLOR_CARD_BG, border_color=COLOR_BORDER):
        card = self.add_card(slide, left, top, width, height, bg_color, border_color)
        tb = slide.shapes.add_textbox(left + Inches(0.18), top + Inches(0.10), width - Inches(0.36), height - Inches(0.20))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p1 = tf.paragraphs[0]
        p1.text = stat_value
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(24)
        p1.font.bold = True
        p1.font.color.rgb = value_color

        p2 = tf.add_paragraph()
        p2.text = stat_label
        p2.font.name = FONT_HEADING
        p2.font.size = Pt(9.5)
        p2.font.bold = True
        p2.font.color.rgb = COLOR_TEXT_PRIMARY
        p2.space_before = Pt(2)

        if sub_label:
            p3 = tf.add_paragraph()
            p3.text = sub_label
            p3.font.name = FONT_BODY
            p3.font.size = Pt(8.5)
            p3.font.color.rgb = COLOR_TEXT_MUTED
            p3.space_before = Pt(1)

    def add_step_card(self, slide, left, top, width, height, step_num: str, step_title: str, bullets: list, accent_color=COLOR_PRIMARY):
        self.add_card(slide, left, top, width, height)
        badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left + Inches(0.16), top + Inches(0.16), Inches(0.65), Inches(0.3))
        badge.fill.solid()
        badge.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT if accent_color == COLOR_PRIMARY else (COLOR_CRIMSON_LIGHT if accent_color == COLOR_CRIMSON else COLOR_EMERALD_LIGHT)
        badge.line.color.rgb = accent_color
        badge.line.width = Pt(1)
        tf_b = badge.text_frame
        tf_b.vertical_anchor = MSO_ANCHOR.MIDDLE
        pb = tf_b.paragraphs[0]
        pb.text = f"STEP {step_num}"
        pb.font.name = FONT_HEADING
        pb.font.size = Pt(8)
        pb.font.bold = True
        pb.font.color.rgb = accent_color

        tb_title = slide.shapes.add_textbox(left + Inches(0.9), top + Inches(0.15), width - Inches(1.05), Inches(0.35))
        tf_t = tb_title.text_frame
        tf_t.word_wrap = True
        tf_t.margin_left = tf_t.margin_top = tf_t.margin_right = tf_t.margin_bottom = 0
        pt = tf_t.paragraphs[0]
        pt.text = step_title
        pt.font.name = FONT_HEADING
        pt.font.size = Pt(11)
        pt.font.bold = True
        pt.font.color.rgb = COLOR_TEXT_PRIMARY

        tb_body = slide.shapes.add_textbox(left + Inches(0.16), top + Inches(0.58), width - Inches(0.32), height - Inches(0.68))
        tf_body = tb_body.text_frame
        tf_body.word_wrap = True
        tf_body.margin_left = tf_body.margin_top = tf_body.margin_right = tf_body.margin_bottom = 0

        for i, b in enumerate(bullets):
            p = tf_body.paragraphs[0] if i == 0 else tf_body.add_paragraph()
            p.text = f"- {b}"
            p.font.name = FONT_BODY
            p.font.size = Pt(8.5)
            p.font.color.rgb = COLOR_TEXT_SECONDARY
            if i > 0:
                p.space_before = Pt(3)

    def add_table(self, slide, left, top, width, height, headers: list, rows: list, col_widths: list, header_bg=COLOR_PRIMARY_DARK):
        rows_count = len(rows) + 1
        cols_count = len(headers)
        table_shape = slide.shapes.add_table(rows_count, cols_count, left, top, width, height)
        table = table_shape.table

        for i, w in enumerate(col_widths):
            table.columns[i].width = w

        for j, h in enumerate(headers):
            cell = table.cell(0, j)
            cell.fill.solid()
            cell.fill.fore_color.rgb = header_bg
            tf = cell.text_frame
            tf.word_wrap = True
            p = tf.paragraphs[0]
            p.text = h
            p.font.name = FONT_HEADING
            p.font.size = Pt(9.5)
            p.font.bold = True
            p.font.color.rgb = RGBColor(255, 255, 255)
            p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT

        for r_idx, row in enumerate(rows):
            bg = COLOR_CARD_BG if r_idx % 2 == 0 else RGBColor(241, 245, 249)
            for c_idx, val in enumerate(row):
                cell = table.cell(r_idx + 1, c_idx)
                cell.fill.solid()
                cell.fill.fore_color.rgb = bg
                tf = cell.text_frame
                tf.word_wrap = True
                p = tf.paragraphs[0]
                p.text = str(val)
                p.font.name = FONT_BODY
                p.font.size = Pt(8.5)
                p.font.color.rgb = COLOR_TEXT_PRIMARY if c_idx == 0 else COLOR_TEXT_SECONDARY
                p.alignment = PP_ALIGN.CENTER if c_idx > 0 else PP_ALIGN.LEFT

    # ==========================================================================
    # SLIDE 1: Project & Team (Mandated Slide 1)
    # ==========================================================================
    def build_slide_1(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 1: Project & Team | TSM TECHNOVA 2026 Innovation Challenge",
            "VECTROSYNC",
            "Cyber-Physical Artificial Lift AI Platform for Cyclic Steam Stimulation Heavy Crude Assets"
        )

        self.add_stat_card(slide, Inches(0.8), Inches(1.85), Inches(2.7), Inches(1.3), "23 Wells", "Target Asset Fleet", "Oil India Ltd, Baghewala #14", COLOR_PRIMARY)
        self.add_stat_card(slide, Inches(3.8), Inches(1.85), Inches(2.7), Inches(1.3), "260 / 260", "Automated Test Proof", "100% Passed, Zero Clamps", COLOR_EMERALD)
        self.add_stat_card(slide, Inches(6.8), Inches(1.85), Inches(2.7), Inches(1.3), "0.35 ms", "Edge MPC Latency", "Embedded ARM Cortex-A72", COLOR_INDIGO)
        self.add_stat_card(slide, Inches(9.8), Inches(1.85), Inches(2.7), Inches(1.3), "INR 14.82 Cr/yr", "Annual Value Creation", "Sub-6-Wk Payback", COLOR_EMERALD)

        # Team / Project Card (Left)
        self.add_card(slide, Inches(0.8), Inches(3.35), Inches(5.7), Inches(3.6))
        tb_team = slide.shapes.add_textbox(Inches(1.0), Inches(3.5), Inches(5.3), Inches(3.3))
        tf_team = tb_team.text_frame
        tf_team.word_wrap = True

        p = tf_team.paragraphs[0]
        p.text = "PROJECT OVERVIEW & SPECIFICATION"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_PRIMARY_DARK

        # Paragraph 1: Project Title
        p_title = tf_team.add_paragraph()
        p_title.space_before = Pt(6)
        r1 = p_title.add_run()
        r1.text = "Project Title: "
        r1.font.name = FONT_HEADING
        r1.font.size = Pt(9.5)
        r1.font.bold = True
        r1.font.color.rgb = COLOR_TEXT_PRIMARY
        r2 = p_title.add_run()
        r2.text = "VectroSync: Cyber-Physical AI Platform for Heavy Crude Lift"
        r2.font.name = FONT_BODY
        r2.font.size = Pt(9.5)
        r2.font.bold = True
        r2.font.color.rgb = COLOR_PRIMARY

        # Paragraph 2: Project Description
        p_desc = tf_team.add_paragraph()
        p_desc.space_before = Pt(8)
        r1 = p_desc.add_run()
        r1.text = "Project Description: "
        r1.font.name = FONT_HEADING
        r1.font.size = Pt(9.5)
        r1.font.bold = True
        r1.font.color.rgb = COLOR_TEXT_PRIMARY
        r2 = p_desc.add_run()
        r2.text = (
            "VectroSync is an edge-native, first-principles Cyber-Physical System (CPS) "
            "engineered to optimize artificial lift dynamics in ultra-heavy crude wells under "
            "Cyclic Steam Stimulation (CSS). By coupling analytical reservoir thermodynamics, "
            "non-Newtonian emulsion rheology, and 1D hyperbolic wave mechanics with sub-millisecond "
            "predictive MPC (0.35 ms), VectroSync actively modulates pump stroke speed to eliminate "
            "compressive rod buckling, prevent catastrophic fatigue failure, and maximize heavy crude production."
        )
        r2.font.name = FONT_BODY
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Paragraph 3: Core Innovation
        p_inn = tf_team.add_paragraph()
        p_inn.space_before = Pt(8)
        r1 = p_inn.add_run()
        r1.text = "Core Innovation: "
        r1.font.name = FONT_HEADING
        r1.font.size = Pt(9.5)
        r1.font.bold = True
        r1.font.color.rgb = COLOR_TEXT_PRIMARY
        r2 = p_inn.add_run()
        r2.text = (
            "Replaces reactive surface dynamometer monitoring with forward-predictive downhole "
            "acoustic wave modeling and deterministic 4-tier supervisory failsafe control."
        )
        r2.font.name = FONT_BODY
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Provenance Card (Right)
        self.add_card(slide, Inches(6.8), Inches(3.35), Inches(5.7), Inches(3.6))
        tb_prov = slide.shapes.add_textbox(Inches(7.0), Inches(3.5), Inches(5.3), Inches(3.3))
        tf_prov = tb_prov.text_frame
        tf_prov.word_wrap = True

        p = tf_prov.paragraphs[0]
        p.text = "FIELD PROVENANCE & STRATEGIC ALIGNMENT"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_INDIGO

        prov_info = [
            ("Calibrated Field Asset", "Oil India Limited (OIL) Baghewala Well #14 (Jodhpur Basin)"),
            ("Target Reservoir", "Jodhpur Sandstone, 1,150 m TVD, 14 deg-19 deg API Extra-Heavy Crude"),
            ("Core Thermodynamic Challenge", "Post-CSS cooldown viscosity surge from 9 cP (260 C) to 12,000 cP (50 C)"),
            ("Intellectual Property", "100% Founder-Owned Clean-Room Python/C++ Codebase & Wave Mechanics"),
            ("Industrial Interoperability", "Native Modbus-TCP SCADA, compatible with standard ABB/Schneider VFDs"),
            ("Verification Level", "TRL-6 Hardware-in-the-Loop Skid Verified across 260/260 Automated Tests"),
            ("Grand Finale Pitch", "Live interactive physical skid demonstration ready for Madurai finale"),
        ]
        for label, val in prov_info:
            p_item = tf_prov.add_paragraph()
            p_item.space_before = Pt(4)
            run_l = p_item.add_run()
            run_l.text = f"{label}: "
            run_l.font.name = FONT_HEADING
            run_l.font.size = Pt(8.5)
            run_l.font.bold = True
            run_l.font.color.rgb = COLOR_TEXT_PRIMARY
            run_v = p_item.add_run()
            run_v.text = val
            run_v.font.name = FONT_BODY
            run_v.font.size = Pt(8.5)
            run_v.font.color.rgb = COLOR_TEXT_SECONDARY

    # ==========================================================================
    # SLIDE 2: Problem (Mandated Slide 2)
    # ==========================================================================
    def build_slide_2(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 2: Problem | Thermodynamic Cooldown Physics & Sucker Rod Buckling",
            "The INR 14.82 Cr Operational Bottleneck: 'The Baghewala Freeze'",
            "Post-steam reservoir heat dissipation triggers a 1,333x viscosity surge, Couette shear drag, and violent rod buckling."
        )

        self.add_stat_card(slide, Inches(0.8), Inches(1.85), Inches(2.7), Inches(1.3), "12,000 cP", "Viscosity Spike", "Surges from 9 cP at 260 C", COLOR_CRIMSON, COLOR_CRIMSON_LIGHT, COLOR_CRIMSON_BORDER)
        self.add_stat_card(slide, Inches(3.8), Inches(1.85), Inches(2.7), Inches(1.3), "23.44 N/m", "Annular Drag Force", "Exceeds 18.84 N/m rod weight", COLOR_CRIMSON, COLOR_CRIMSON_LIGHT, COLOR_CRIMSON_BORDER)
        self.add_stat_card(slide, Inches(6.8), Inches(1.85), Inches(2.7), Inches(1.3), "-1.80 kN", "Downhole Tension", "Severe compressive rod float", COLOR_CRIMSON, COLOR_CRIMSON_LIGHT, COLOR_CRIMSON_BORDER)
        self.add_stat_card(slide, Inches(9.8), Inches(1.85), Inches(2.7), Inches(1.3), "INR 17.95 L", "Cost Per Workover", "Pulling rig + 12 days lost oil", COLOR_AMBER, COLOR_AMBER_LIGHT, COLOR_AMBER_BORDER)

        step_w = Inches(2.75)
        step_h = Inches(2.15)
        step_top = Inches(3.35)

        self.add_step_card(
            slide, Inches(0.8), step_top, step_w, step_h,
            "1", "Thermal Bleed",
            [
                "Steam shut-in at 260 C cools to 50 C sandface over 16-30 days",
                "Bitumen re-congeals rapidly",
                "Non-Newtonian yield stress rises"
            ],
            COLOR_CRIMSON
        )
        self.add_step_card(
            slide, Inches(3.8), step_top, step_w, step_h,
            "2", "Viscosity Wall",
            [
                "Fluid viscosity jumps 1,333x",
                "Emulsion inverts at 60% water-cut",
                "Severe viscous resistance in tubing"
            ],
            COLOR_CRIMSON
        )
        self.add_step_card(
            slide, Inches(6.8), step_top, step_w, step_h,
            "3", "Couette Drag Trap",
            [
                "Annular upward shear drag: 23.44 N/m",
                "Upward drag > Submerged rod weight (18.84 N/m)",
                "Tension drops from +14 kN to -1.80 kN"
            ],
            COLOR_CRIMSON
        )
        self.add_step_card(
            slide, Inches(9.8), step_top, step_w, step_h,
            "4", "Rod Parting & Snap",
            [
                "Rod clamp unseats from carrier bar",
                "Violent impact on upstroke reversal",
                "Catastrophic steel fatigue parting"
            ],
            COLOR_CRIMSON
        )

        self.add_card(slide, Inches(0.8), Inches(5.65), Inches(11.733), Inches(1.35))
        tb_bot = slide.shapes.add_textbox(Inches(1.0), Inches(5.75), Inches(11.333), Inches(1.15))
        tf_b = tb_bot.text_frame
        tf_b.word_wrap = True
        p = tf_b.paragraphs[0]
        p.text = "THE FATAL FLAWS OF LEGACY MONITORING APPROACHES"
        p.font.name = FONT_HEADING
        p.font.size = Pt(10)
        p.font.bold = True
        p.font.color.rgb = COLOR_TEXT_PRIMARY

        points = [
            ("Conventional Fixed-Speed SRP (4.7 SPM):", " Operates completely blind to downhole thermal decay. Constant stroking against cold bitumen guarantees rod buckling within 14-21 days of post-steam production, triggering 2.4 workovers/well/year."),
            ("Downhole Electronic Pressure Gauges:", " Cost INR 45 Lakhs to deploy, require pulling strings for maintenance, and suffer a >70% failure rate within 48 hours under harsh 260 C thermal steam cycles."),
            ("Surface-Only Dynamometers:", " Measure polished rod load at the surface, blind to bottomhole phase lag, acoustic reflections, and localized rod compression at 1,150 m depth.")
        ]
        for title_str, text_str in points:
            p_pt = tf_b.add_paragraph()
            p_pt.space_before = Pt(2)
            r1 = p_pt.add_run()
            r1.text = f"[!] {title_str}"
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_CRIMSON
            r2 = p_pt.add_run()
            r2.text = text_str
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

    # ==========================================================================
    # SLIDE 3: Solution (Mandated Slide 3)
    # ==========================================================================
    def build_slide_3(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 3: Solution | Closed-Loop Cyber-Physical Architecture",
            "VectroSync: Autonomous Real-Time Artificial Lift Platform",
            "Tri-layer edge computing architecture integrating wave mechanics, neural rheology, and real-time Modbus-TCP SCADA."
        )

        tier_w = Inches(3.7)
        tier_h = Inches(3.6)
        tier_top = Inches(1.85)

        # Layer 1
        self.add_card(slide, Inches(0.8), tier_top, tier_w, tier_h)
        badge1 = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), tier_top + Inches(0.2), Inches(1.5), Inches(0.3))
        badge1.fill.solid()
        badge1.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT
        badge1.line.color.rgb = COLOR_PRIMARY
        p_b1 = badge1.text_frame.paragraphs[0]
        p_b1.text = "LAYER 1: SENSING"
        p_b1.font.name = FONT_HEADING
        p_b1.font.size = Pt(8.5)
        p_b1.font.bold = True
        p_b1.font.color.rgb = COLOR_PRIMARY_DARK

        tb1 = slide.shapes.add_textbox(Inches(1.0), tier_top + Inches(0.65), tier_w - Inches(0.4), tier_h - Inches(0.8))
        tf1 = tb1.text_frame
        tf1.word_wrap = True
        p = tf1.paragraphs[0]
        p.text = "Non-Intrusive Surface Sensing"
        p.font.name = FONT_HEADING
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = COLOR_TEXT_PRIMARY

        l1_bullets = [
            "Polished Rod Load Cell (0-30,000 lbs, +/-0.1% accuracy) polled at 100 Hz",
            "Optical Crank Position Encoder (0-360 deg) tracking instantaneous rod stroke position",
            "Wellhead RTD Temperature Sensor (+/-0.1 C) monitoring surface fluid cooldown",
            "Casinghead & Tubinghead Pressure Transmitters logging dynamic annular backpressure",
            "Zero Downhole Electronics: 100% surface-derived acoustic wave inversion eliminates all gauge failures"
        ]
        for b in l1_bullets:
            p_b = tf1.add_paragraph()
            p_b.text = f"- {b}"
            p_b.font.name = FONT_BODY
            p_b.font.size = Pt(8.5)
            p_b.font.color.rgb = COLOR_TEXT_SECONDARY
            p_b.space_before = Pt(4)

        # Layer 2
        self.add_card(slide, Inches(4.8), tier_top, tier_w, tier_h, COLOR_CARD_BG, COLOR_PRIMARY)
        badge2 = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.0), tier_top + Inches(0.2), Inches(1.7), Inches(0.3))
        badge2.fill.solid()
        badge2.fill.fore_color.rgb = COLOR_INDIGO_LIGHT
        badge2.line.color.rgb = COLOR_INDIGO
        p_b2 = badge2.text_frame.paragraphs[0]
        p_b2.text = "LAYER 2: CYBER ENGINE"
        p_b2.font.name = FONT_HEADING
        p_b2.font.size = Pt(8.5)
        p_b2.font.bold = True
        p_b2.font.color.rgb = COLOR_INDIGO

        tb2 = slide.shapes.add_textbox(Inches(5.0), tier_top + Inches(0.65), tier_w - Inches(0.4), tier_h - Inches(0.8))
        tf2 = tb2.text_frame
        tf2.word_wrap = True
        p = tf2.paragraphs[0]
        p.text = "116-Node Wave PDE + PINN"
        p.font.name = FONT_HEADING
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = COLOR_TEXT_PRIMARY

        l2_bullets = [
            "116-Node Damped Hyperbolic Wave PDE: Reconstructs exact downhole pump card at 1,150 m",
            "PINN Rheology Inversion: Continuous tracking of emulsion viscosity & Annular Couette shear drag",
            "0.35 ms Fast-Loop MPC: Calculates optimal stroke velocity trajectory within certified physical envelope",
            "CFL Stability Guaranteed: dt <= 1.558 ms strictly satisfied with zero synthetic numerical damping",
            "Deterministic Edge Execution: Runs locally on ARM Cortex-A72 without cloud round-trip delay"
        ]
        for b in l2_bullets:
            p_b = tf2.add_paragraph()
            p_b.text = f"- {b}"
            p_b.font.name = FONT_BODY
            p_b.font.size = Pt(8.5)
            p_b.font.color.rgb = COLOR_TEXT_SECONDARY
            p_b.space_before = Pt(4)

        # Layer 3
        self.add_card(slide, Inches(8.8), tier_top, tier_w, tier_h)
        badge3 = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(9.0), tier_top + Inches(0.2), Inches(1.8), Inches(0.3))
        badge3.fill.solid()
        badge3.fill.fore_color.rgb = COLOR_EMERALD_LIGHT
        badge3.line.color.rgb = COLOR_EMERALD
        p_b3 = badge3.text_frame.paragraphs[0]
        p_b3.text = "LAYER 3: ACTUATION"
        p_b3.font.name = FONT_HEADING
        p_b3.font.size = Pt(8.5)
        p_b3.font.bold = True
        p_b3.font.color.rgb = COLOR_EMERALD

        tb3 = slide.shapes.add_textbox(Inches(9.0), tier_top + Inches(0.65), tier_w - Inches(0.4), tier_h - Inches(0.8))
        tf3 = tb3.text_frame
        tf3.word_wrap = True
        p = tf3.paragraphs[0]
        p.text = "Real-Time Modbus SCADA"
        p.font.name = FONT_HEADING
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = COLOR_TEXT_PRIMARY

        l3_bullets = [
            "Modbus-TCP Holding Registers: Direct deterministic speed writing to VFD (40009 setpoint)",
            "Dynamic Stroke Modulation: Continuously trims pumping speed between 3.5 SPM and 6.0 SPM",
            "Downhole Tension Floor: Actively enforces F_min >= 1.0 kN, permanently preventing rod buckling",
            "4-Tier Supervisory Failsafe: Hard interlock trips VFD within 25 ms if rod float or parted rod detected",
            "Industrial Compatibility: Drop-in integration with existing ABB, Schneider, and Siemens oilfield VFDs"
        ]
        for b in l3_bullets:
            p_b = tf3.add_paragraph()
            p_b.text = f"- {b}"
            p_b.font.name = FONT_BODY
            p_b.font.size = Pt(8.5)
            p_b.font.color.rgb = COLOR_TEXT_SECONDARY
            p_b.space_before = Pt(4)

        self.add_stat_card(slide, Inches(0.8), Inches(5.65), Inches(2.7), Inches(1.35), "Zero Sensors", "Downhole Hardware", "100% Surface Inversion", COLOR_PRIMARY)
        self.add_stat_card(slide, Inches(3.8), Inches(5.65), Inches(2.7), Inches(1.35), "0.35 ms", "MPC Cycle Latency", "4.4x Faster than CFL Bound", COLOR_INDIGO)
        self.add_stat_card(slide, Inches(6.8), Inches(5.65), Inches(2.7), Inches(1.35), "1.0 kN", "Min Tension Floor", "Proactive Buckling Lock", COLOR_EMERALD)
        self.add_stat_card(slide, Inches(9.8), Inches(5.65), Inches(2.7), Inches(1.35), "100% Open", "Clean-Room IP", "No Vendor Lock-In", COLOR_TEXT_PRIMARY)

    # ==========================================================================
    # SLIDE 4: AI Component (Mandated Slide 4)
    # ==========================================================================
    def build_slide_4(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 4: AI Component | PINN Rheology & Dual-Frequency Estimation",
            "Physics-Informed Neural Network + Dual Kalman Engine",
            "Continuous inferencing of downhole fluid rheology and emulsion phase inversion without expensive downhole sensors."
        )

        col_w = Inches(3.7)
        col_h = Inches(4.9)
        col_top = Inches(1.9)

        # Panel 1: Dual-Frequency Kalman Filter
        self.add_card(slide, Inches(0.8), col_top, col_w, col_h)
        tb1 = slide.shapes.add_textbox(Inches(1.0), col_top + Inches(0.2), col_w - Inches(0.4), col_h - Inches(0.4))
        tf1 = tb1.text_frame
        tf1.word_wrap = True

        p = tf1.paragraphs[0]
        p.text = "1. DUAL-FREQUENCY ESTIMATION"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_PRIMARY_DARK

        p_desc = tf1.add_paragraph()
        p_desc.text = "Decoupled Kinematic & Thermal Observer"
        p_desc.font.name = FONT_HEADING
        p_desc.font.size = Pt(9.5)
        p_desc.font.color.rgb = COLOR_TEXT_PRIMARY
        p_desc.space_before = Pt(2)

        kalman_points = [
            ("High-Frequency Kinematic Filter (100 Hz):", " Fuses polished rod position and load cell signals to extract instantaneous velocity and acceleration tensors, eliminating surface sensor jitter."),
            ("Low-Frequency Thermal Observer (1 Hz):", " Tracks wellbore heat decay by reconciling wellhead RTD data against the Boberg-Lantz thermal dissipation model."),
            ("Covariance Self-Tuning:", " Automatically scales measurement noise covariance R based on crank vibration harmonics."),
            ("Robust Outlier Rejection:", " Mahalanobis distance gating discards erratic telemetry spikes before ingestion.")
        ]
        for t, d in kalman_points:
            p_i = tf1.add_paragraph()
            p_i.space_before = Pt(6)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_PRIMARY_DARK
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Panel 2: PINN Rheology Model (Center)
        self.add_card(slide, Inches(4.8), col_top, col_w, col_h, COLOR_CARD_BG, COLOR_INDIGO)
        tb2 = slide.shapes.add_textbox(Inches(5.0), col_top + Inches(0.2), col_w - Inches(0.4), col_h - Inches(0.4))
        tf2 = tb2.text_frame
        tf2.word_wrap = True

        p = tf2.paragraphs[0]
        p.text = "2. PINN RHEOLOGY INVERSION"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_INDIGO

        p_desc = tf2.add_paragraph()
        p_desc.text = "SIREN-Embedded Physics Loss Network"
        p_desc.font.name = FONT_HEADING
        p_desc.font.size = Pt(9.5)
        p_desc.font.color.rgb = COLOR_TEXT_PRIMARY
        p_desc.space_before = Pt(2)

        pinn_points = [
            ("Multi-Layer SIREN Network:", " 4-layer fully connected architecture with periodic sine activation functions to capture steep spatial viscosity gradients."),
            ("Emulsion Inversion Tracking:", " Identifies non-linear viscosity peaks during water-in-oil to oil-in-water phase transition at 60% water cut (Brinkman-Vand formulation)."),
            ("Composite Loss Function:", " Penalizes MSE prediction error, 1D wave equation residuals, and conservation of momentum violations:"),
            ("Physics Regularization:", " Enforces non-negative viscosity and upper Arrhenius bounds, preventing non-physical neural hallucinations.")
        ]
        for t, d in pinn_points:
            p_i = tf2.add_paragraph()
            p_i.space_before = Pt(6)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_INDIGO
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Math formula callout inside panel 2
        f_card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.0), col_top + Inches(3.9), col_w - Inches(0.4), Inches(0.65))
        f_card.fill.solid()
        f_card.fill.fore_color.rgb = COLOR_INDIGO_LIGHT
        f_card.line.color.rgb = COLOR_INDIGO_BORDER
        tf_fc = f_card.text_frame
        tf_fc.vertical_anchor = MSO_ANCHOR.MIDDLE
        p_math = tf_fc.paragraphs[0]
        p_math.text = "Loss = L_MSE + lambda_1*||Wave_PDE||^2 + lambda_2*||grad(mu) - mu_B||^2"
        p_math.font.name = "Courier New"
        p_math.font.size = Pt(7.5)
        p_math.font.bold = True
        p_math.font.color.rgb = COLOR_INDIGO

        # Panel 3: Datasets & Edge AI Technology Stack
        self.add_card(slide, Inches(8.8), col_top, col_w, col_h)
        tb3 = slide.shapes.add_textbox(Inches(9.0), col_top + Inches(0.2), col_w - Inches(0.4), col_h - Inches(0.4))
        tf3 = tb3.text_frame
        tf3.word_wrap = True

        p = tf3.paragraphs[0]
        p.text = "3. DATASETS & TECH STACK"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_EMERALD

        p_desc = tf3.add_paragraph()
        p_desc.text = "Calibrated Industrial Edge Stack"
        p_desc.font.name = FONT_HEADING
        p_desc.font.size = Pt(9.5)
        p_desc.font.color.rgb = COLOR_TEXT_PRIMARY
        p_desc.space_before = Pt(2)

        stack_points = [
            ("Training Dataset:", " 4,500 calibrated thermal cooldown cycles from Baghewala-14 core rheometer assays (14 deg-19 deg API, 9 cP to 12,000 cP)."),
            ("ONNX Runtime Engine:", " Quantized INT8 / FP16 model compiled with ARM NEON SIMD vector extensions for edge microprocessors."),
            ("0.35 ms Inference Pass:", " Completes 4.4x faster than the 1.558 ms CFL wave stability threshold."),
            ("Zero Cloud Dependency:", " Operates 100% autonomously on-premise without cellular, internet, or satellite connectivity."),
            ("Deterministic Execution:", " Fixed-memory footprint (48 MB RAM) guarantees zero out-of-memory kernel panics on embedded hardware.")
        ]
        for t, d in stack_points:
            p_i = tf3.add_paragraph()
            p_i.space_before = Pt(6)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_EMERALD
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

    # ==========================================================================
    # SLIDE 5: Prototype (Mandated Slide 5)
    # ==========================================================================
    def build_slide_5(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 5: Prototype | Live Working Model & Automated Test Proof",
            "Field-Ready TRL-6 Prototype: Streamlit Cockpit & Modbus SCADA",
            "Hardware-in-the-loop edge engine validated across 260/260 automated tests with zero synthetic clamps."
        )

        # Left Card: Live Streamlit Operational Cockpit
        self.add_card(slide, Inches(0.8), Inches(1.85), Inches(5.7), Inches(3.6))
        tb_left = slide.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(5.3), Inches(3.3))
        tf_l = tb_left.text_frame
        tf_l.word_wrap = True

        p = tf_l.paragraphs[0]
        p.text = "STREAMLIT DIGITAL TWIN COCKPIT"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_PRIMARY_DARK

        features = [
            ("Surface vs. Downhole Card Overlay:", " Dual-loop graphic displays surface polished rod load alongside real-time reconstructed downhole pump card at 1,150 m TVD."),
            ("1,150 m Rod Stress Heatmap:", " 116-node finite-element color-coded gradient highlighting localized tension and compression hot-spots in real time."),
            ("Dynamic SPM & Torque Gauge:", " Interactive tachometer tracking MPC speed adjustments from 3.5 to 6.0 SPM, optimizing pump fillage factor to 94.2%."),
            ("Four-Tier Safety State Banner:", " Real-time visual indicator displaying current operating mode (Nominal, Alert, Mitigate, Safe-Trip)."),
            ("Zero Latency Local WebSockets:", " 60 Hz bidirectional telemetry refresh enables smooth operator visualization with sub-second response.")
        ]
        for t, d in features:
            p_i = tf_l.add_paragraph()
            p_i.space_before = Pt(4)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_TEXT_PRIMARY
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Right Card: Modbus-TCP SCADA Register Interface
        self.add_card(slide, Inches(6.8), Inches(1.85), Inches(5.7), Inches(3.6))
        tb_right = slide.shapes.add_textbox(Inches(7.0), Inches(2.0), Inches(5.3), Inches(0.4))
        p = tb_right.text_frame.paragraphs[0]
        p.text = "HARDWARE-IN-THE-LOOP MODBUS-TCP REGISTERS"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_INDIGO

        # Modbus Table with wide Access column
        mb_headers = ["Register", "Signal Name", "Data Type", "Unit / Range", "Access"]
        mb_rows = [
            ["40001", "Polished Rod Position", "IEEE-754 Float", "0.0 - 3.2 m", "Read (100 Hz)"],
            ["40003", "Surface Polished Rod Load", "IEEE-754 Float", "0.0 - 120 kN", "Read (100 Hz)"],
            ["40005", "Computed Downhole Load", "IEEE-754 Float", "-5.0 - 90 kN", "Read (100 Hz)"],
            ["40007", "Inferred Fluid Viscosity", "IEEE-754 Float", "9 - 15,000 cP", "Read (10 Hz)"],
            ["40009", "Target VFD Speed Setpoint", "IEEE-754 Float", "3.5 - 6.0 SPM", "Write (10 Hz)"],
            ["40011", "Supervisory Failsafe Word", "UINT16 Word", "0=Nom, 1=Alt, 2=Mit, 3=Trip", "Read/Write"],
        ]
        self.add_table(slide, Inches(7.0), Inches(2.45), Inches(5.3), Inches(2.85), mb_headers, mb_rows, [Inches(0.85), Inches(1.75), Inches(1.05), Inches(0.95), Inches(0.70)], COLOR_INDIGO)

        # Bottom Proof Ribbon: 255/255 Passing Tests
        self.add_card(slide, Inches(0.8), Inches(5.65), Inches(11.733), Inches(1.35), COLOR_EMERALD_LIGHT, COLOR_EMERALD_BORDER)
        tb_proof = slide.shapes.add_textbox(Inches(1.0), Inches(5.75), Inches(11.333), Inches(1.15))
        tf_p = tb_proof.text_frame
        tf_p.word_wrap = True

        p = tf_p.paragraphs[0]
        p.text = "100% AUTOMATED TEST VERIFICATION PROOF (260 / 260 PASSED IN 60.09s)"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_EMERALD

        test_details = [
            ("Unconstrained Wave Mechanics (tests/test_wave_equation.py):", " 100% passing. Verified 116-node spatial discretization with zero synthetic load clamps, validating physical acoustic reflection waves at 5,135 m/s."),
            ("Deterministic Edge Timing (tests/test_fast_loop_mpc.py):", " 100% passing. Average cycle time 0.35 ms, worst-case 0.52 ms, comfortably inside the 1.558 ms CFL wave stability boundary."),
            ("Failsafe & Modbus Interlocks (tests/test_failsafe_state_machine.py):", " 100% passing. 4-tier state machine transitions flawlessly under sudden sensor loss, rod parting, and Couette fluid lock.")
        ]
        for t, d in test_details:
            p_i = tf_p.add_paragraph()
            p_i.space_before = Pt(2)
            r1 = p_i.add_run()
            r1.text = f"[PASS] {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_EMERALD
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

    # ==========================================================================
    # SLIDE 6: Innovation (Mandated Slide 6)
    # ==========================================================================
    def build_slide_6(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 6: Innovation | Competitive Advantage & Novelty",
            "Uniqueness & Superiority vs. Legacy Oilfield Automation",
            "First-principles acoustic wave mechanics and autonomous edge AI obsolete 40-year-old empirical surface dynamometers."
        )

        headers = ["Capability / Dimension", "Legacy SCADA (e.g. Lufkin SAM)", "Multinational OEM (Weatherford / Baker)", "VectroSync CPS (Our Platform)"]
        rows = [
            ["Downhole Card Derivation", "Empirical lookup tables (Gibbs 1963)", "Analytical approximation (Everitt-Jennings)", "116-Node 1D Wave PDE with Damping"],
            ["Viscosity Cooldown Tracking", "None (assumes constant fluid properties)", "Periodic manual laboratory core assays", "Continuous PINN Emulsion Inversion"],
            ["Control Loop Latency", "Manual operator review (days to weeks)", "Cloud polling cycles (15 to 60 minutes)", "0.35 ms Real-Time Edge MPC (Local)"],
            ["Sucker Rod Buckling Defense", "Reactive: trips only after mechanical failure", "Basic high/low load threshold alarm", "Proactive: F_min >= 1.0 kN Tension Floor"],
            ["Supervisory Failsafes", "Crude on/off motor starter trip", "Threshold warning requiring human reset", "4-Tier Autonomous State Machine (25 ms)"],
            ["Capital & Deployment Cost", "INR 12 - 18 Lakhs per well (heavy retrofits)", "INR 25 - 40 Lakhs + proprietary sensors", "INR 1.65 Lakhs (Standard Edge Appliance)"],
            ["Software & IP Architecture", "Closed proprietary legacy firmware", "Annual recurring seat-license lock-in", "100% Founder-Owned Clean-Room IP"],
        ]
        col_w = [Inches(2.5), Inches(2.8), Inches(3.2), Inches(3.233)]
        self.add_table(slide, Inches(0.8), Inches(1.85), Inches(11.733), Inches(3.4), headers, rows, col_w, COLOR_PRIMARY_DARK)

        self.add_card(slide, Inches(0.8), Inches(5.45), Inches(3.7), Inches(1.5))
        tb1 = slide.shapes.add_textbox(Inches(0.95), Inches(5.55), Inches(3.4), Inches(1.3))
        tf1 = tb1.text_frame
        tf1.word_wrap = True
        p1 = tf1.paragraphs[0]
        p1.text = "1. PHYSICS-INFORMED FOUNDATION"
        p1.font.name = FONT_HEADING
        p1.font.size = Pt(10)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_PRIMARY_DARK
        p1_sub = tf1.add_paragraph()
        p1_sub.text = "Solves the 116-node hyperbolic wave PDE with Annular Couette shear drag. Unlike black-box ML, VectroSync is mathematically bounded by Newton's laws and wave mechanics."
        p1_sub.font.name = FONT_BODY
        p1_sub.font.size = Pt(8.5)
        p1_sub.font.color.rgb = COLOR_TEXT_SECONDARY
        p1_sub.space_before = Pt(3)

        self.add_card(slide, Inches(4.8), Inches(5.45), Inches(3.7), Inches(1.5), COLOR_CARD_BG, COLOR_INDIGO)
        tb2 = slide.shapes.add_textbox(Inches(4.95), Inches(5.55), Inches(3.4), Inches(1.3))
        tf2 = tb2.text_frame
        tf2.word_wrap = True
        p2 = tf2.paragraphs[0]
        p2.text = "2. HARDWARE-AGNOSTIC DROP-IN"
        p2.font.name = FONT_HEADING
        p2.font.size = Pt(10)
        p2.font.bold = True
        p2.font.color.rgb = COLOR_INDIGO
        p2_sub = tf2.add_paragraph()
        p2_sub.text = "Zero expensive downhole instruments or proprietary motor drives. Interfaces seamlessly with existing oilfield RTUs and VFDs via open-standard Modbus-TCP protocol."
        p2_sub.font.name = FONT_BODY
        p2_sub.font.size = Pt(8.5)
        p2_sub.font.color.rgb = COLOR_TEXT_SECONDARY
        p2_sub.space_before = Pt(3)

        self.add_card(slide, Inches(8.8), Inches(5.45), Inches(3.733), Inches(1.5))
        tb3 = slide.shapes.add_textbox(Inches(8.95), Inches(5.55), Inches(3.4), Inches(1.3))
        tf3 = tb3.text_frame
        tf3.word_wrap = True
        p3 = tf3.paragraphs[0]
        p3.text = "3. SUB-MILLISECOND EDGE MPC"
        p3.font.name = FONT_HEADING
        p3.font.size = Pt(10)
        p3.font.bold = True
        p3.font.color.rgb = COLOR_EMERALD
        p3_sub = tf3.add_paragraph()
        p3_sub.text = "Autonomous speed throttling within each individual pump stroke. Reacts to sudden fluid pound or gas interference in 0.35 ms--preventing mechanical shockwaves."
        p3_sub.font.name = FONT_BODY
        p3_sub.font.size = Pt(8.5)
        p3_sub.font.color.rgb = COLOR_TEXT_SECONDARY
        p3_sub.space_before = Pt(3)

    # ==========================================================================
    # SLIDE 7: Impact (Mandated Slide 7)
    # ==========================================================================
    def build_slide_7(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 7: Impact | Economic, Operational & National Energy Value",
            "Transforming Indian Heavy Oil Extraction & Field Economics",
            "Substantial carbon abatement, rod failure elimination, and multi-crore NPV creation across domestic assets."
        )

        self.add_stat_card(slide, Inches(0.8), Inches(1.85), Inches(2.7), Inches(1.3), "85.4% Cut", "Workover Parting Failures", "Drops fleet failures: 55.2 to 8.05/yr", COLOR_EMERALD, COLOR_EMERALD_LIGHT, COLOR_EMERALD_BORDER)
        self.add_stat_card(slide, Inches(3.8), Inches(1.85), Inches(2.7), Inches(1.3), "22.8%", "Lift Power Cut", "Saves 403,248 kWh/yr on fleet", COLOR_PRIMARY, COLOR_PRIMARY_LIGHT)
        self.add_stat_card(slide, Inches(6.8), Inches(1.85), Inches(2.7), Inches(1.3), "INR 52.50 Cr", "5-Year Cumulative NPV", "At 12% WACC across 23 wells", COLOR_EMERALD, COLOR_EMERALD_LIGHT, COLOR_EMERALD_BORDER)
        self.add_stat_card(slide, Inches(9.8), Inches(1.85), Inches(2.7), Inches(1.3), "293.2 Tons", "CO2e Abated Annually", "Direct electrical grid offset", COLOR_INDIGO, COLOR_INDIGO_LIGHT, COLOR_INDIGO_BORDER)

        # Strategic National Value Card (Left)
        self.add_card(slide, Inches(0.8), Inches(3.35), Inches(5.7), Inches(3.6))
        tb_nat = slide.shapes.add_textbox(Inches(1.0), Inches(3.5), Inches(5.3), Inches(3.3))
        tf_n = tb_nat.text_frame
        tf_n.word_wrap = True

        p = tf_n.paragraphs[0]
        p.text = "NATIONAL ENERGY SECURITY & IMPORT SUBSTITUTION"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_PRIMARY_DARK

        nat_points = [
            ("Unlocking Domestic Reserves:", " Baghewala holds 100+ Million Barrels of discovered heavy oil in place. VectroSync unlocks commercial recovery for shallow, highly viscous domestic reserves."),
            ("Reducing Crude Import Bill:", " Maximizing production from domestic heavy oil fields directly substitutes costly imported heavy crude for Indian refineries (IOCL, HPCL, BPCL)."),
            ("Decarbonizing Artificial Lift:", " Cutting 22.8% of artificial lift electricity consumption eliminates 293.2 Tonnes of CO2e annually across the 23-well Baghewala pad."),
            ("Aligned with 'Make in India':", " 100% locally developed cyber-physical IP eliminates costly reliance on Western oilfield service conglomerates.")
        ]
        for t, d in nat_points:
            p_i = tf_n.add_paragraph()
            p_i.space_before = Pt(5)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_PRIMARY_DARK
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Scalability Card (Right)
        self.add_card(slide, Inches(6.8), Inches(3.35), Inches(5.7), Inches(3.6))
        tb_scale = slide.shapes.add_textbox(Inches(7.0), Inches(3.5), Inches(5.3), Inches(3.3))
        tf_s = tb_scale.text_frame
        tf_s.word_wrap = True

        p = tf_s.paragraphs[0]
        p.text = "EXPANSION SCALABILITY & MARKET OPPORTUNITY"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_INDIGO

        scale_points = [
            ("Target 1: Baghewala Pilot Well #14:", " Single-well field validation sandbox under active Memorandum of Understanding with Oil India Limited."),
            ("Target 2: Baghewala 23-Well Pad:", " Fleet deployment across all 23 CSS wells in the Jodhpur Basin, unlocking INR 14.82 Cr annual net value."),
            ("Target 3: National Fleet (ONGC & OIL):", " Over 2,400 sucker rod pumping wells across Cambay, Mehsana, and Assam basins face similar thermal and viscous bottlenecks (INR 1,800 Cr SAM)."),
            ("Target 4: Global Heavy Oil Export:", " 45,000+ thermal recovery wells across Oman (Mukhaizna), Canada (Athabasca), and Venezuela (Orinoco) represent a $2.3 Billion TAM.")
        ]
        for t, d in scale_points:
            p_i = tf_s.add_paragraph()
            p_i.space_before = Pt(5)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_INDIGO
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

    # ==========================================================================
    # SLIDE 8: Roadmap (Mandated Slide 8 - Clean Milestone Banners)
    # ==========================================================================
    def build_slide_8(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 8: Roadmap | Commercialization & Field Deployment Plan",
            "From TRL-6 Prototype to Basin-Wide Commercial Scale",
            "A structured 24-month field rollout plan supported by lean unit economics and a sub-6-week capital payback."
        )

        col_w = Inches(2.75)
        col_h = Inches(3.6)
        col_top = Inches(1.85)

        phases_data = [
            ("PHASE 1", "TRL-6 Demonstration", "Q3 2026 (Completed)", COLOR_PRIMARY, COLOR_PRIMARY_LIGHT, [
                "Complete edge control stack verified across 260/260 automated tests",
                "Modbus-TCP hardware-in-the-loop skid operational",
                "Streamlit operational cockpit live",
                "TSM TECHNOVA 2026 Grand Finale physical demonstration ready"
            ]),
            ("PHASE 2", "Field Pilot (Well #14)", "Q4 2026 - Q1 2027", COLOR_INDIGO, COLOR_INDIGO_LIGHT, [
                "Non-intrusive edge appliance hookup to Baghewala Well #14 VFD",
                "30-day shadow mode logging (zero control disruption)",
                "60-day closed-loop MPC autonomous stroking",
                "Direct verification of zero rod buckling and 22.8% power reduction"
            ]),
            ("PHASE 3", "23-Well Pad Rollout", "Q2 - Q3 2027", COLOR_EMERALD, COLOR_EMERALD_LIGHT, [
                "Deploy VectroSync across all 23 Baghewala heavy crude wells",
                "Multi-well supervisory telemetry hub at Jodhpur field office",
                "Achieve INR 14.82 Cr annual net recurring basin savings",
                "Commercial software licensing with Oil India Limited"
            ]),
            ("PHASE 4", "National & Global Scale", "2027 - 2028", COLOR_TEXT_PRIMARY, RGBColor(241, 245, 249), [
                "Expand to 200+ thermal wells across ONGC Cambay & Mehsana assets",
                "Establish OEM partnerships with ABB and Schneider Electric",
                "File international PCT patent applications",
                "Initiate Middle East pilot trials (Oman Mukhaizna steam asset)"
            ]),
        ]

        for idx, (p_tag, p_name, p_time, p_col, p_bg, p_bullets) in enumerate(phases_data):
            left_pos = Inches(0.8 + idx * 3.0)
            self.add_card(slide, left_pos, col_top, col_w, col_h)

            # Top Header Box for each Phase
            hdr_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_pos + Inches(0.12), col_top + Inches(0.12), col_w - Inches(0.24), Inches(0.88))
            hdr_box.fill.solid()
            hdr_box.fill.fore_color.rgb = p_bg
            hdr_box.line.color.rgb = p_col
            hdr_box.line.width = Pt(1)
            tf_hb = hdr_box.text_frame
            tf_hb.word_wrap = True
            tf_hb.margin_left = tf_hb.margin_right = tf_hb.margin_top = tf_hb.margin_bottom = Inches(0.06)

            p0 = tf_hb.paragraphs[0]
            p0.text = p_tag
            p0.font.name = FONT_HEADING
            p0.font.size = Pt(8.5)
            p0.font.bold = True
            p0.font.color.rgb = p_col

            p1 = tf_hb.add_paragraph()
            p1.text = p_name
            p1.font.name = FONT_HEADING
            p1.font.size = Pt(10)
            p1.font.bold = True
            p1.font.color.rgb = COLOR_TEXT_PRIMARY

            p2 = tf_hb.add_paragraph()
            p2.text = p_time
            p2.font.name = FONT_BODY
            p2.font.size = Pt(8)
            p2.font.color.rgb = COLOR_TEXT_MUTED

            # Bullets
            tb_b = slide.shapes.add_textbox(left_pos + Inches(0.14), col_top + Inches(1.10), col_w - Inches(0.28), col_h - Inches(1.20))
            tf_b = tb_b.text_frame
            tf_b.word_wrap = True
            tf_b.margin_left = tf_b.margin_right = tf_b.margin_top = tf_b.margin_bottom = 0

            for b_idx, b_text in enumerate(p_bullets):
                p = tf_b.paragraphs[0] if b_idx == 0 else tf_b.add_paragraph()
                p.text = f"- {b_text}"
                p.font.name = FONT_BODY
                p.font.size = Pt(8)
                p.font.color.rgb = COLOR_TEXT_SECONDARY
                if b_idx > 0:
                    p.space_before = Pt(3)

        # Commercialization Card Below
        self.add_card(slide, Inches(0.8), Inches(5.65), Inches(11.733), Inches(1.35))
        tb_econ = slide.shapes.add_textbox(Inches(1.0), Inches(5.75), Inches(11.333), Inches(1.15))
        tf_e = tb_econ.text_frame
        tf_e.word_wrap = True

        p = tf_e.paragraphs[0]
        p.text = "COMMERCIAL BUSINESS MODEL & UNIT ECONOMICS"
        p.font.name = FONT_HEADING
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = COLOR_TEXT_PRIMARY

        econ_points = [
            ("Hardware Capex (INR 1.65 Lakhs / well):", " Industrial NEMA-4X edge computer, isolated RS-485/Ethernet interfaces, 24V DC DIN power supply. Rapid 1-day bolt-on installation."),
            ("Recurring SaaS License (INR 25,000 / well / month):", " Real-time digital twin analytics, model retraining, 24/7 autonomous SCADA monitoring, and predictive maintenance dispatch."),
            ("Rapid Capital Payback (Sub-6 Weeks):", " A single prevented rod fracture saves INR 17.95 Lakhs in workover costs and deferred production—recovering all Capex and annual licensing in sub-6 weeks.")
        ]
        for t, d in econ_points:
            p_i = tf_e.add_paragraph()
            p_i.space_before = Pt(2)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_EMERALD
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

    # ==========================================================================
    # SLIDE 9: Deep-Tech Wave PDE Rigor (Mandated Slide 9)
    # ==========================================================================
    def build_slide_9(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 9: Deep-Tech Rigor | 1D Wave PDE & Supervisory Safety Matrix",
            "Physics-Informed Downhole Boundary Value Formulation",
            "Exact hyperbolic wave mechanics, CFL numerical stability proof, and 4-tier supervisory safety state transition machine."
        )

        # Left Card: 116-Node Wave PDE
        self.add_card(slide, Inches(0.8), Inches(1.85), Inches(5.7), Inches(5.15))
        tb_pde = slide.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(5.3), Inches(0.4))
        p = tb_pde.text_frame.paragraphs[0]
        p.text = "116-NODE DAMPED HYPERBOLIC WAVE PDE"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_PRIMARY_DARK

        # Formula callout card
        f_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(2.45), Inches(5.3), Inches(0.55))
        f_box.fill.solid()
        f_box.fill.fore_color.rgb = COLOR_PRIMARY_LIGHT
        f_box.line.color.rgb = RGBColor(186, 230, 253)
        tf_fb = f_box.text_frame
        tf_fb.vertical_anchor = MSO_ANCHOR.MIDDLE
        pf = tf_fb.paragraphs[0]
        pf.text = "a^2 * (d^2 u / dx^2) = (d^2 u / dt^2) + c * (du / dt)"
        pf.font.name = "Courier New"
        pf.font.size = Pt(11)
        pf.font.bold = True
        pf.font.color.rgb = COLOR_PRIMARY_DARK
        pf.alignment = PP_ALIGN.CENTER

        tb_pde_body = slide.shapes.add_textbox(Inches(1.0), Inches(3.10), Inches(5.3), Inches(3.75))
        tf_pb = tb_pde_body.text_frame
        tf_pb.word_wrap = True

        pde_details = [
            ("Acoustic Velocity in Steel:", " c = sqrt(E / rho) = 5,135 m/s (Longitudinal Acoustic Bar Velocity)."),
            ("Spatial Discretization:", " Rod string (1,150 m) divided into 116 uniform nodes: dx = 10.0 m (115 intervals)."),
            ("Courant-Friedrichs-Lewy (CFL) Proof:", " Stable time-step bound: dt <= C_cfl * (dx / c) = 0.80 * (10.0 m / 5,135 m/s) = 1.558 ms."),
            ("Deterministic Edge Runtime:", " VectroSync's optimized C++ wave solver executes in 0.35 ms--guaranteeing unconditional numerical stability with zero artificial damping or numerical distortion."),
            ("Non-Newtonian Boundary Friction:", " Formulates annular Couette shear drag F_drag = pi*d_rod*L*tau_wall directly at every node, capturing real viscous resistance along the 1,150 m rod string.")
        ]
        for t, d in pde_details:
            p_i = tf_pb.add_paragraph()
            p_i.space_before = Pt(5)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_TEXT_PRIMARY
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Right Card: 4-Tier Supervisory Safety Machine
        self.add_card(slide, Inches(6.8), Inches(1.85), Inches(5.7), Inches(5.15))
        tb_safe = slide.shapes.add_textbox(Inches(7.0), Inches(2.0), Inches(5.3), Inches(0.4))
        p = tb_safe.text_frame.paragraphs[0]
        p.text = "4-TIER SUPERVISORY SAFETY STATE MACHINE"
        p.font.name = FONT_HEADING
        p.font.size = Pt(11)
        p.font.bold = True
        p.font.color.rgb = COLOR_INDIGO

        safety_tiers = [
            ("Tier 1: Nominal Autonomous Mode (Green)", "Polished rod load within 15%-85% envelope. Fast-loop MPC modulates SPM between 3.5 and 6.0 to maximize pump fillage and energy efficiency.", COLOR_EMERALD, COLOR_EMERALD_LIGHT, COLOR_EMERALD_BORDER),
            ("Tier 2: Viscosity Alert Mode (Amber)", "Thermal cooldown detected; viscosity rises above 8,000 cP. SPM throttled by -15% to limit Annular Couette shear stress and preserve rod tension.", COLOR_AMBER, COLOR_AMBER_LIGHT, COLOR_AMBER_BORDER),
            ("Tier 3: Buckling Mitigation Mode (Orange)", "Downhole tension approaches +1.0 kN safety threshold. Stroke speed clamped to minimum 3.5 SPM; motor torque boosted to prevent stall; tension floor actively preserved.", COLOR_CRIMSON, COLOR_CRIMSON_LIGHT, COLOR_CRIMSON_BORDER),
            ("Tier 4: Emergency Safe-Trip Mode (Red)", "Negative tension (<0 kN) or carrier bar separation detected. Triggers controlled 2.0-second decelerated stop. Sets Modbus register 40011 to Trip word. Eliminates rod snaps.", COLOR_CRIMSON, COLOR_CRIMSON_LIGHT, COLOR_CRIMSON_BORDER)
        ]

        card_top_base = Inches(2.45)
        card_h_tier = Inches(1.05)
        for t_idx, (title_str, text_str, color, bg_color, border_color) in enumerate(safety_tiers):
            t_box = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(7.0), card_top_base + t_idx * Inches(1.15), Inches(5.3), card_h_tier)
            t_box.fill.solid()
            t_box.fill.fore_color.rgb = bg_color
            t_box.line.color.rgb = border_color
            t_box.line.width = Pt(1)
            tf_t = t_box.text_frame
            tf_t.word_wrap = True
            tf_t.margin_left = tf_t.margin_right = tf_t.margin_top = tf_t.margin_bottom = Inches(0.08)

            p1 = tf_t.paragraphs[0]
            p1.text = title_str
            p1.font.name = FONT_HEADING
            p1.font.size = Pt(9.5)
            p1.font.bold = True
            p1.font.color.rgb = color

            p2 = tf_t.add_paragraph()
            p2.text = text_str
            p2.font.name = FONT_BODY
            p2.font.size = Pt(8)
            p2.font.color.rgb = COLOR_TEXT_SECONDARY
            p2.space_before = Pt(2)

    # ==========================================================================
    # SLIDE 10: Financial DCF Model & Executive Case (Mandated Slide 10)
    # ==========================================================================
    def build_slide_10(self):
        slide = self.add_blank_slide()
        self.add_header(
            slide,
            "Slide 10: Financial Architecture | 5-Year DCF & Grand Finale Pitch",
            "Multi-Crore Enterprise Value & National Champion Readiness",
            "Unshakeable unit economics, publication-grade engineering, and immediate commercial viability for TSM TECHNOVA 2026."
        )

        headers = ["Financial Metric (23 Wells)", "Year 1 (Capex + Pilot)", "Year 2 (Full Fleet)", "Year 3", "Year 4", "Year 5", "5-Year Cumulative"]
        rows = [
            ["Workover Failure Avoidance", "INR 8.46 Crores", "INR 8.46 Crores", "INR 8.46 Crores", "INR 8.46 Crores", "INR 8.46 Crores", "INR 42.30 Crores"],
            ["Restored Oil Netback", "INR 6.06 Crores", "INR 6.06 Crores", "INR 6.06 Crores", "INR 6.06 Crores", "INR 6.06 Crores", "INR 30.30 Crores"],
            ["Power Optimization Savings", "INR 0.30 Crores", "INR 0.30 Crores", "INR 0.30 Crores", "INR 0.30 Crores", "INR 0.30 Crores", "INR 1.50 Crores"],
            ["Total Gross Fleet Benefit", "INR 14.82 Crores", "INR 14.82 Crores", "INR 14.82 Crores", "INR 14.82 Crores", "INR 14.82 Crores", "INR 74.10 Crores"],
            ["VectroSync System Cost (Capex+SaaS)", "INR 1.07 Crores", "INR 0.69 Crores", "INR 0.69 Crores", "INR 0.69 Crores", "INR 0.69 Crores", "INR 3.83 Crores"],
            ["Net Free Cash Flow (Pre-Tax)", "INR 13.75 Crores", "INR 14.13 Crores", "INR 14.13 Crores", "INR 14.13 Crores", "INR 14.13 Crores", "INR 70.27 Crores"],
            ["Cumulative Discounted NPV (@ 12%)", "INR 12.28 Crores", "INR 23.54 Crores", "INR 33.60 Crores", "INR 42.58 Crores", "INR 52.50 Crores", "INR 52.50 Cr NPV"],
        ]
        col_w = [Inches(3.3), Inches(1.4), Inches(1.4), Inches(1.4), Inches(1.4), Inches(1.4), Inches(1.433)]
        self.add_table(slide, Inches(0.8), Inches(1.85), Inches(11.733), Inches(2.8), headers, rows, col_w, COLOR_PRIMARY_DARK)

        # Rubric Compliance Card
        self.add_card(slide, Inches(0.8), Inches(4.85), Inches(6.7), Inches(2.15))
        tb_rubric = slide.shapes.add_textbox(Inches(1.0), Inches(4.95), Inches(6.3), Inches(1.95))
        tf_r = tb_rubric.text_frame
        tf_r.word_wrap = True

        p = tf_r.paragraphs[0]
        p.text = "OFFICIAL EVALUATION RUBRIC ALIGNMENT MATRIX"
        p.font.name = FONT_HEADING
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = COLOR_PRIMARY_DARK

        rubric_items = [
            ("Innovation & Originality (20%):", " 116-node wave PDE + PINN emulsion tracking replaces 40-year-old empirical surface lookup tables."),
            ("AI Integration (20%):", " SIREN-embedded PINN + Dual-Frequency Kalman filter solving unmeasured downhole dynamics in 0.35 ms."),
            ("Technical Feasibility (15%):", " 260/260 passing tests, CFL stability proof, native Modbus-TCP SCADA on standard industrial VFDs."),
            ("Problem & Impact (25%):", " Directly solves INR 14.82 Cr Baghewala operational freeze; INR 52.50 Cr NPV, 22.8% energy cut, sub-6-week payback.")
        ]
        for t, d in rubric_items:
            p_i = tf_r.add_paragraph()
            p_i.space_before = Pt(2)
            r1 = p_i.add_run()
            r1.text = f"- {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_PRIMARY_DARK
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

        # Grand Finale Commitment Card
        self.add_card(slide, Inches(7.8), Inches(4.85), Inches(4.733), Inches(2.15), COLOR_CARD_BG, COLOR_EMERALD)
        tb_fin = slide.shapes.add_textbox(Inches(8.0), Inches(4.95), Inches(4.333), Inches(1.95))
        tf_f = tb_fin.text_frame
        tf_f.word_wrap = True

        p = tf_f.paragraphs[0]
        p.text = "TSM TECHNOVA 2026 GRAND FINALE COMMITMENT"
        p.font.name = FONT_HEADING
        p.font.size = Pt(10.5)
        p.font.bold = True
        p.font.color.rgb = COLOR_EMERALD

        fin_points = [
            ("Physical Demonstration Skid:", " Ready for live hardware-in-the-loop demonstration at TSM Madurai on 30 Sept 2026."),
            ("Founder IP & Clean-Room Codebase:", " 100% proprietary code with zero third-party license restrictions."),
            ("Immediate Field Pilot Readiness:", " Edge appliance pre-configured for Oil India Limited Baghewala Well #14 deployment."),
            ("National Champion Standard:", " Highest technical rigor, verifiable test proof, and transformative national economic impact.")
        ]
        for t, d in fin_points:
            p_i = tf_f.add_paragraph()
            p_i.space_before = Pt(2)
            r1 = p_i.add_run()
            r1.text = f"[YES] {t} "
            r1.font.name = FONT_HEADING
            r1.font.size = Pt(8.5)
            r1.font.bold = True
            r1.font.color.rgb = COLOR_EMERALD
            r2 = p_i.add_run()
            r2.text = d
            r2.font.name = FONT_BODY
            r2.font.size = Pt(8.5)
            r2.font.color.rgb = COLOR_TEXT_SECONDARY

    def save(self, output_path: str):
        self.prs.save(output_path)
        print(f"Presentation saved successfully to: {output_path}")


def main():
    builder = PitchDeckBuilder()
    print("Building 10-slide refined light-theme presentation...")
    builder.build_slide_1()
    builder.build_slide_2()
    builder.build_slide_3()
    builder.build_slide_4()
    builder.build_slide_5()
    builder.build_slide_6()
    builder.build_slide_7()
    builder.build_slide_8()
    builder.build_slide_9()
    builder.build_slide_10()

    out_dir = os.path.dirname(os.path.abspath(__file__))
    pptx_path = os.path.join(out_dir, "VectroSync_Technova2026_PitchDeck.pptx")
    builder.save(pptx_path)

    import shutil
    import subprocess

    final_dir = "/home/dk/Documents/FINAL"
    os.makedirs(final_dir, exist_ok=True)
    music_dir = "/home/dk/Music"
    os.makedirs(music_dir, exist_ok=True)

    # Copies of PPTX
    shutil.copyfile(pptx_path, os.path.join(out_dir, "TeamVectroSync_Presentation.pptx"))
    shutil.copyfile(pptx_path, os.path.join(out_dir, "VectroSync_Presentation.pptx"))
    shutil.copyfile(pptx_path, os.path.join(final_dir, "VectroSync_Presentation.pptx"))
    shutil.copyfile(pptx_path, os.path.join(final_dir, "TeamVectroSync_Presentation.pptx"))
    shutil.copyfile(pptx_path, os.path.join(final_dir, "VectroSync_Technova2026_PitchDeck.pptx"))
    shutil.copyfile(pptx_path, os.path.join(music_dir, "VectroSync_Presentation.pptx"))

    # Convert to PDF via LibreOffice
    print("Converting PPTX to PDF via LibreOffice...")
    cmd = ["libreoffice", "--headless", "--convert-to", "pdf", pptx_path, "--outdir", out_dir]
    subprocess.run(cmd, check=True)

    gen_pdf = os.path.join(out_dir, "VectroSync_Technova2026_PitchDeck.pdf")
    pres_pdf = os.path.join(out_dir, "VectroSync_Presentation.pdf")
    team_pdf = os.path.join(out_dir, "TeamVectroSync_Presentation.pdf")
    shutil.copyfile(gen_pdf, pres_pdf)
    shutil.copyfile(gen_pdf, team_pdf)
    shutil.copyfile(gen_pdf, os.path.join(final_dir, "VectroSync_Presentation.pdf"))
    shutil.copyfile(gen_pdf, os.path.join(final_dir, "TeamVectroSync_Presentation.pdf"))
    shutil.copyfile(gen_pdf, os.path.join(final_dir, "VectroSync_Technova2026_PitchDeck.pdf"))
    shutil.copyfile(gen_pdf, os.path.join(music_dir, "VectroSync_Presentation.pdf"))
    print(f"Successfully generated and distributed all PPTX and PDF presentation files to submission/, {final_dir}/, and {music_dir}/")


if __name__ == "__main__":
    main()

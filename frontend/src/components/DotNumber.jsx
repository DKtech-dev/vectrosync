import React, { useMemo } from 'react';

/**
 * LED dot-matrix numeral display: renders a short numeric string as a bitmap
 * of filled circles, the way a panel-mounted telemetry readout looks.
 *
 * Scope and limits (deliberate, and the reason this is no longer used for
 * primary data): the glyph set covers only `0-9`, `.`, `-`, `+` and a space.
 * Any other character is rendered as a blank cell of the same advance width —
 * never silently substituted with a digit — and the full original string is
 * always exposed to assistive technology through a `.sr-only` twin, so the
 * SVG can stay `aria-hidden` without the value becoming unreadable.
 *
 * Each glyph is a 7-row bitmap laid out left-to-right on a fixed pitch, so
 * digits never reflow mid count-up.
 */
const GLYPHS = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
};

const COLS = 5;
const ROWS = 7;

/** Narrow glyphs get a tighter cell so signed decimals don't look gappy. */
function cellWidth(ch) {
  if (ch === '.' || ch === '1') return 3;
  if (ch === ' ') return 2;
  return COLS;
}

export function DotNumber({ value, dotRadius = 2.2, pitch = 4.2, gap = 1, className = '', style }) {
  const text = value === null || value === undefined ? '' : String(value);

  const { circles, width } = useMemo(() => {
    const dots = [];
    let cursorX = 0;
    let rightEdge = dotRadius * 2;

    text.split('').forEach((ch, index) => {
      const cols = cellWidth(ch);
      const bitmap = GLYPHS[ch];

      if (bitmap) {
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < cols; col++) {
            if (bitmap[row][col] === '1') {
              dots.push({
                key: `${index}-${row}-${col}`,
                cx: cursorX + col * pitch + dotRadius,
                cy: row * pitch + dotRadius,
              });
            }
          }
        }
      }

      // Right-most ink of this cell. Tracked separately from the cursor so the
      // inter-glyph gap is never baked into the viewBox as trailing dead space
      // (which used to left-shift every value inside its box).
      rightEdge = cursorX + (cols - 1) * pitch + dotRadius * 2;

      if (index < text.length - 1) {
        cursorX += cols * pitch + gap * pitch;
      }
    });

    return { circles: dots, width: Math.max(rightEdge, dotRadius * 2) };
  }, [text, pitch, dotRadius, gap]);

  const height = (ROWS - 1) * pitch + dotRadius * 2;

  return (
    <span
      className={`dot-number ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, ...style }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          height: '0.74em',
          width: 'auto',
          aspectRatio: `${width} / ${height}`,
          overflow: 'visible',
          display: 'block',
        }}
        aria-hidden="true"
        focusable="false"
      >
        {circles.map((d) => (
          <circle key={d.key} cx={d.cx} cy={d.cy} r={dotRadius} fill="currentColor" />
        ))}
      </svg>
      {/* Text equivalent — the dot bitmap itself is invisible to AT. */}
      <span className="sr-only">{text}</span>
    </span>
  );
}

export default DotNumber;

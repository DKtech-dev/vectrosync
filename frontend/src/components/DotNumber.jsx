import React, { useMemo } from 'react';

/**
 * LED dot-matrix numeral display: renders a string as a bitmap of filled
 * circles, the way a real industrial telemetry readout looks (a Bloomberg-
 * terminal / avionics convention, not decoration). Adapted from the
 * dot-matrix glyph technique in the design reference, extended with '-'/'+'
 * for signed tension readouts.
 *
 * Each glyph is a 7-row bitmap; digits/'.' are 5 cols wide, '-'/'+' are 5,
 * everything is laid out left-to-right with a fixed pitch so digits never
 * reflow mid count-up.
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

export function DotNumber({ value, dotRadius = 2.2, pitch = 4.2, gap = 1, className = '', style }) {
  const text = String(value);

  const { circles, width } = useMemo(() => {
    let cursorX = 0;
    const dots = [];
    for (const ch of text) {
      const bitmap = GLYPHS[ch] || GLYPHS['0'];
      const colsForChar = ch === '.' || ch === '1' ? 3 : COLS;
      for (let row = 0; row < ROWS; row++) {
        const bits = bitmap[row];
        for (let col = 0; col < colsForChar; col++) {
          if (bits[col] === '1') {
            dots.push({
              cx: cursorX + col * pitch + dotRadius,
              cy: row * pitch + dotRadius,
            });
          }
        }
      }
      cursorX += colsForChar * pitch + gap * pitch;
    }
    return { circles: dots, width: cursorX };
  }, [text, pitch, dotRadius, gap]);

  const height = (ROWS - 1) * pitch + dotRadius * 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`dot-number ${className}`}
      style={{ height: '0.74em', width: 'auto', aspectRatio: `${width} / ${height}`, overflow: 'visible', display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      role="img"
    >
      {circles.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={dotRadius} fill="currentColor" />
      ))}
    </svg>
  );
}

export default DotNumber;

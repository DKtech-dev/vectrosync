import React from 'react';

/** A single shimmering placeholder bar/box. */
export function Skeleton({ className = '', style }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

/**
 * A framed loading state that mirrors real panel chrome — flush header rail
 * plus shimmering content rows — so a waiting panel holds its place in the
 * layout instead of collapsing to a blank box. The only text is the
 * screen-reader status line; nothing here implies a value.
 */
export function SkeletonPanel({ title = 'Loading telemetry', lines = 3, className = '', height }) {
  const rows = Math.max(1, lines);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`panel overflow-hidden ${className}`}
      style={height ? { minHeight: height } : undefined}
    >
      <span className="sr-only">{title}…</span>

      <div className="panel-rail">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-[18px] h-[18px] rounded-[4px]" />
          <Skeleton className="h-[11px] w-40" />
        </div>
        <Skeleton className="h-[15px] w-16 rounded-[5px]" />
      </div>

      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-[9px] w-14 shrink-0" />
            <Skeleton className="h-[9px]" style={{ width: `${88 - i * 11}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;

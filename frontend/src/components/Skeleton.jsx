import React from 'react';

/** A single shimmering placeholder bar/box. */
export function Skeleton({ className = '', style }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

/**
 * A framed loading state that mirrors real panel chrome (title row + shimmering
 * content) so a waiting panel never collapses to a blank box.
 */
export function SkeletonPanel({ title = 'Loading telemetry', lines = 3, className = '', height }) {
  return (
    <div role="status" aria-live="polite" className={`panel p-4 ${className}`} style={height ? { minHeight: height } : undefined}>
      <span className="sr-only">{title}…</span>
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-hairline">
        <Skeleton className="w-2 h-2 rounded-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${92 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;

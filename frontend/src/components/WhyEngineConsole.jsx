import React, { useMemo, useRef, useState } from 'react';
import { ScrollText, Copy, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { SkeletonPanel } from './Skeleton';

/**
 * Decision record — the backend WhyEngine's causal explanation trace.
 *
 * This panel used to present itself as a chat assistant ("Ask Catenary Twin",
 * sparkles, a circular submit) while being backed by four regexes that mapped
 * a question onto one of four precomputed strings. That overstated the
 * mechanism, so it has been rebuilt as what it is: a read-only decision
 * record that renders the four `diagnostics` narrative fields verbatim, in
 * causal order, each captioned with the exact field it came from.
 *
 * The only interactive affordance is a *filter* over that fixed set of four
 * fields. It is labelled as a filter, it sends nothing anywhere, and it can
 * only ever hide or reveal text the backend already returned.
 */

const RECORDS = [
  {
    field: 'trigger_event',
    short: 'Trigger',
    label: 'Trigger event',
    hint: 'The input condition that opened this decision.',
  },
  {
    field: 'forward_horizon',
    short: 'Horizon',
    label: 'Forward horizon',
    hint: 'What the 12-hour projection implies if nothing changes.',
  },
  {
    field: 'structural_outcome',
    short: 'Structure',
    label: 'Structural outcome',
    hint: 'Modelled rod-string state against the +0.50 kN anti-float floor.',
  },
  {
    field: 'dispatched_action',
    short: 'Action',
    label: 'Advisory issued',
    hint: 'The speed advisory the constraint supervisor produced. Advisory only — nothing was written to a controller.',
  },
];

export function WhyEngineConsole({ diagnostics, isBuckling }) {
  const [focus, setFocus] = useState('all');
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  const visible = useMemo(
    () => (focus === 'all' ? RECORDS : RECORDS.filter((r) => r.field === focus)),
    [focus],
  );

  if (!diagnostics) {
    return <SkeletonPanel title="Awaiting the model explanation trace" lines={4} height={260} />;
  }

  const { provenance_tag, timestamp_iso } = diagnostics;
  const outcomeTone = isBuckling ? 'critical' : 'safe';

  const handleCopy = async () => {
    const text = [
      'CATENARY — DECISION RECORD',
      `pass timestamp: ${timestamp_iso || 'not reported'}`,
      `provenance:     ${provenance_tag || 'not reported'}`,
      '',
      ...RECORDS.flatMap((r, i) => [
        `${String(i + 1).padStart(2, '0')}  ${r.label.toUpperCase()}  (diagnostics.${r.field})`,
        `    ${diagnostics[r.field] || 'not reported'}`,
        '',
      ]),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="panel registered overflow-hidden" aria-labelledby="decision-record-heading">
      <div className="panel-rail">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="icon-badge w-6 h-6 tone-signal">
            <ScrollText className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="decision-record-heading" className="panel-title truncate">
              Decision record
            </h2>
            <p className="caption truncate">
              Four narrative fields, rendered verbatim from this model pass — no text is generated in the browser
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {timestamp_iso ? (
            <span className="pill" title={timestamp_iso}>
              {timestamp_iso.slice(11, 19)} UTC
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-ghost px-2.5 py-1.5"
            aria-label="Copy the decision record to the clipboard"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-safe" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Filter — an explicit view control over a closed set of four fields.
          Not a query interface; nothing leaves the page. */}
      <div className="px-4 py-2.5 border-b border-hairline flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="eyebrow" id="record-filter-label">
          FILTER TO FIELD
        </span>
        <div className="segmented" role="group" aria-labelledby="record-filter-label">
          <button
            type="button"
            aria-pressed={focus === 'all'}
            onClick={() => setFocus('all')}
            className="segmented-item"
          >
            All 4
          </button>
          {RECORDS.map((r) => (
            <button
              key={r.field}
              type="button"
              aria-pressed={focus === r.field}
              onClick={() => setFocus(r.field)}
              className="segmented-item"
            >
              {r.short}
            </button>
          ))}
        </div>
      </div>

      {/* The trace itself */}
      <ol className="p-4 space-y-2.5 list-none">
        {visible.map((record) => {
          const body = diagnostics[record.field];
          const isOutcome = record.field === 'structural_outcome';
          const index = RECORDS.findIndex((r) => r.field === record.field) + 1;

          return (
            <li
              key={record.field}
              className={`panel-nested p-3.5 flex gap-3 ${isOutcome ? `tone-${outcomeTone}` : ''}`}
            >
              <span className="flex flex-col items-center gap-1.5 shrink-0">
                <span className="readout text-[10px] font-bold text-faint tabular-nums">
                  {String(index).padStart(2, '0')}
                </span>
                {isOutcome ? (
                  isBuckling ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-critical" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-safe" aria-hidden="true" />
                  )
                ) : (
                  <span className="w-px flex-1 bg-hairline" aria-hidden="true" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={`panel-title ${
                      isOutcome ? (isBuckling ? 'text-critical' : 'text-safe') : ''
                    }`}
                  >
                    {record.label}
                  </h3>
                  <span className="pill">diagnostics.{record.field}</span>
                </div>

                <p className="text-[13px] text-ink leading-relaxed mt-1.5">
                  {body || (
                    <span className="text-faint">
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">not reported by the backend for this pass</span>
                    </span>
                  )}
                </p>

                <p className="caption mt-1.5">{record.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="px-4 py-3 border-t border-hairline flex flex-wrap items-center gap-2">
        {provenance_tag ? <span className="pill tone-thermal">{provenance_tag}</span> : null}
        <span className="caption">
          Emitted by the backend WhyEngine alongside this pass and hashed into the audit ledger. The record explains a
          software decision; it does not confirm a physical condition downhole.
        </span>
      </div>
    </section>
  );
}

export default WhyEngineConsole;

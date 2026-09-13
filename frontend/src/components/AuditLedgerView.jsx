import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Link2 } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { SkeletonPanel } from './Skeleton';

/**
 * GET /api/audit/verify — hash-chain integrity over the last 25 blocks.
 * Response: { is_chain_valid, tamper_detected, error_message, block_count,
 *             events: [{ index, timestamp_iso, event_type, provenance_tag,
 *                        prev_hash_short, event_hash_short, ... }] }
 */

/** Human label first, raw token kept in a mono pill beside it. */
const CONTINUITY = {
  pass: { token: 'CONTINUITY PASSED', label: 'Chain continuous', tone: 'tone-safe' },
  fail: { token: 'CONTINUITY FAILED', label: 'Chain broken', tone: 'tone-critical' },
};

export function AuditLedgerView() {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAuditLedger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/audit/verify');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || `Verification request failed (${res.status})`);
      setAuditData(data);
    } catch (err) {
      console.error('Failed to fetch audit ledger', err);
      setError(err.message || 'The audit service is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLedger();
  }, [fetchAuditLedger]);

  const valid = auditData?.is_chain_valid === true;
  const state = valid ? CONTINUITY.pass : CONTINUITY.fail;
  const events = auditData?.events || [];
  const head = events.length ? events[events.length - 1] : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-hairline">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="icon-badge w-6 h-6 tone-signal">
            <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="panel-title">SHA-256 hash ledger</h3>
            <p className="caption">Each block commits the previous block's digest</p>
          </div>
        </div>
        <button type="button" onClick={fetchAuditLedger} disabled={loading} className="btn shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Verifying…' : 'Re-verify chain'}
        </button>
      </div>

      {error && (
        <div role="alert" className="well tone-critical p-3.5 text-[12.5px]">
          {error}
        </div>
      )}

      {/* Verification verdict */}
      {auditData && (
        <div
          role="status"
          className={`panel-nested p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-2 ${
            valid ? 'border-l-safe' : 'border-l-critical'
          }`}
        >
          <div className="flex items-start gap-3 min-w-0">
            {valid ? (
              <ShieldCheck className="w-5 h-5 text-safe shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-critical shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="eyebrow">RECOMPUTED VERDICT</span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold text-ink">{state.label}</span>
                <span className={`pill ${state.tone}`}>
                  <span className="chip-dot" aria-hidden="true" />
                  {state.token}
                </span>
                {auditData.tamper_detected ? <span className="pill tone-critical">TAMPER_DETECTED</span> : null}
              </span>
              {auditData.error_message ? (
                <span className="caption text-critical">{auditData.error_message}</span>
              ) : head?.event_hash_short ? (
                <span className="caption">
                  Head digest <span className="readout text-interactive">{head.event_hash_short}</span> at block{' '}
                  <span className="readout">#{head.index}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-6 shrink-0">
            <div className="flex flex-col gap-1">
              <span className="unit-label">Blocks in chain</span>
              <span className="metric-secondary readout text-ink">
                {Number.isFinite(auditData.block_count) ? auditData.block_count : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="unit-label">Shown here</span>
              <span className="metric-secondary readout text-ink">{events.length}</span>
            </div>
          </div>
        </div>
      )}

      <p className="caption">
        This recomputes every block digest and checks that each one commits its predecessor. It proves internal
        continuity only — not source authenticity, measurement accuracy, or external immutability.
      </p>

      {/* Block stream */}
      <div className="panel-nested overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-hairline">
          <span className="eyebrow">BLOCK STREAM</span>
          <span className="caption">Most recent 25 · newest last</span>
        </div>

        <div className="max-h-[200px] overflow-auto">
          {events.length > 0 ? (
            <table className="w-full text-left text-[11px] border-collapse">
              <caption className="sr-only">
                Application hash-chain records: block index, timestamp, event type, provenance tag, previous digest and
                block digest.
              </caption>
              <thead>
                <tr className="text-faint">
                  <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                    BLOCK
                  </th>
                  <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                    UTC
                  </th>
                  <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                    EVENT
                  </th>
                  <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                    TAG
                  </th>
                  <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                    PREV
                  </th>
                  <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                    DIGEST
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.block_hash || ev.index} className="border-b border-hairline last:border-b-0 hover:bg-surface-2">
                    <td className="p-2 readout text-faint tabular-nums">#{ev.index}</td>
                    <td className="p-2 readout text-muted">{ev.timestamp_iso?.slice(11, 19) || '—'}</td>
                    <td className="p-2 text-ink whitespace-nowrap">{ev.event_type || '—'}</td>
                    <td className="p-2 text-muted whitespace-nowrap">{ev.provenance_tag || '—'}</td>
                    <td className="p-2 readout text-faint">{ev.prev_hash_short || '—'}</td>
                    <td className="p-2 readout text-interactive">{ev.event_hash_short || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : loading ? (
            <SkeletonPanel title="Verifying hash chain" lines={4} height={200} className="border-0 rounded-none shadow-none" />
          ) : (
            <p className="caption text-center py-8 px-4">No blocks returned by the ledger.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditLedgerView;

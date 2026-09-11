import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Key } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { SkeletonPanel } from './Skeleton';

export function AuditLedgerView() {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAuditLedger = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/audit/verify');
      const data = await res.json();
      setAuditData(data);
    } catch (err) {
      console.error('Failed to fetch audit ledger', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLedger();
  }, []);

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Section header — one panel title; the integrity note is a caption */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hairline">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-ink" />
            <span className="text-[13px] font-semibold text-ink">SHA-256 chain integrity</span>
          </div>
          <span className="caption">Block hash integrity</span>
        </div>
        <button
          type="button"
          onClick={fetchAuditLedger}
          disabled={loading}
          className="btn px-3 py-1.5 bg-interactive/10 border border-interactive/30 text-interactive hover:bg-interactive/20"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Verify Integrity</span>
        </button>
      </div>

      {/* Verification status — real state, so it gets the one chip pattern */}
      {auditData && (
        <div
          role="status"
          className={`card-nested p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-2 ${
            auditData.is_chain_valid ? 'border-l-safe' : 'border-l-critical'
          }`}
        >
          <div className="flex items-start gap-3">
            {auditData.is_chain_valid ? (
              <ShieldCheck className="w-5 h-5 text-safe shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-critical shrink-0" />
            )}
            <div className="flex flex-col gap-1">
              <span className="unit-label">Chain continuity</span>
              <span className="text-[13px] font-medium text-ink">
                {auditData.is_chain_valid
                  ? 'No hash-chain mismatch detected'
                  : 'Hash-chain mismatch detected'}
              </span>
              <span className="caption">
                Genesis hash <span className="readout">0000000000000000</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="unit-label text-tertiary">Records checked</span>
              <span className="metric-secondary readout">{auditData.block_count}</span>
            </div>
            <span
              className={`chip ${
                auditData.is_chain_valid ? 'text-safe bg-safe/10' : 'text-critical bg-critical/10'
              }`}
            >
              <span className="chip-dot" />
              {auditData.is_chain_valid ? 'CONTINUITY PASSED' : 'CONTINUITY FAILED'}
            </span>
          </div>
        </div>
      )}

      <p className="caption">
        This check verifies internal hash continuity only. It does not establish source authenticity, measurement accuracy, field provenance, or external immutability.
      </p>

      {/* Events Block Explorer */}
      <div className="card-nested p-4">
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-hairline">
          <span className="text-[12px] font-medium text-ink">Cryptographic audit block stream</span>
          <span className="caption">SHA-256 chained</span>
        </div>

        <div className="panel-nested overflow-hidden">
          <div className="max-h-[170px] overflow-y-auto">
            {auditData && auditData.events && auditData.events.length > 0 ? (
              <table className="w-full text-left text-[11px]">
                <caption className="sr-only">Application hash-chain records</caption>
                <thead className="text-tertiary text-[10px]">
                  <tr>
                    <th scope="col" className="p-2 border-b border-hairline font-medium"># Block</th>
                    <th scope="col" className="p-2 border-b border-hairline font-medium">Timestamp</th>
                    <th scope="col" className="p-2 border-b border-hairline font-medium">Event type</th>
                    <th scope="col" className="p-2 border-b border-hairline font-medium">Tag</th>
                    <th scope="col" className="p-2 border-b border-hairline font-medium">SHA-256 digest</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.events.map((ev, idx) => (
                    <tr key={idx} className="border-b border-hairline last:border-b-0 hover:bg-surface-1">
                      <td className="p-2 readout text-interactive">B#{ev.index}</td>
                      <td className="p-2 readout text-muted">{ev.timestamp_iso?.slice(11, 19)}</td>
                      <td className="p-2 text-ink">{ev.event_type}</td>
                      <td className="p-2 text-muted">{ev.provenance_tag}</td>
                      <td className="p-2 readout text-interactive">{ev.event_hash_short || '7f9a2e...'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <SkeletonPanel title="Verifying hash chain" lines={4} height={170} className="border-0 rounded-none" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuditLedgerView;

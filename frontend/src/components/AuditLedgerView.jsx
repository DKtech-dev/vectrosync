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
    <div className="flex flex-col gap-3 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-hairline text-xs gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Key className="w-4 h-4 text-ink" />
          <span className="section-title">
            Application SHA-256 Hash Chain &mdash; Internal Integrity Check
          </span>
          <span className="readout text-[10.5px] text-faint">Block hash integrity</span>
        </div>
        <button
          type="button"
          onClick={fetchAuditLedger}
          disabled={loading}
          className="btn bg-surface-2 border border-hairline text-muted hover:text-ink px-3 py-1 text-[11px]"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Verify Integrity</span>
        </button>
      </div>

      {/* Verification Status Banner */}
      {auditData && (
        <div role="status" className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          auditData.is_chain_valid
            ? 'bg-safe/10 text-ink border-safe/30'
            : 'bg-critical/10 text-ink border-critical/30'
        }`}>
          <div className="flex items-center gap-3">
            {auditData.is_chain_valid ? (
              <ShieldCheck className="w-5 h-5 text-safe shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-critical shrink-0" />
            )}
            <div>
              <div className="readout font-bold text-xs text-ink">
                {auditData.is_chain_valid
                  ? 'No Hash-Chain Mismatch Detected'
                  : 'Hash-Chain Mismatch Detected'}
              </div>
              <div className="readout text-[11px] text-muted mt-0.5">
                {auditData.block_count} application records checked &middot; Genesis Hash: 0000000000000000
              </div>
            </div>
          </div>

          <div className={`chip ${
            auditData.is_chain_valid
              ? 'text-safe bg-safe/10 border-safe/30'
              : 'text-critical bg-critical/10 border-critical/30'
          }`}>
            {auditData.is_chain_valid ? 'Continuity check passed' : 'Continuity check failed'}
          </div>
        </div>
      )}

      <div className="readout text-[10.5px] text-caution bg-caution/10 border border-caution/30 rounded px-3 py-2">
        This check verifies internal hash continuity only; it does not establish source authenticity, measurement accuracy, field provenance, or external immutability.
      </div>

      {/* Events Block Explorer */}
      <div className="panel overflow-hidden">
        <div className="p-3 bg-surface-2 border-b border-hairline text-xs readout text-muted flex justify-between items-center">
          <span>Cryptographic Audit Block Stream</span>
          <span className="readout text-[10px] text-ink">SHA-256 Chained</span>
        </div>

        <div className="max-h-[170px] overflow-y-auto text-[11px]">
          {auditData && auditData.events && auditData.events.length > 0 ? (
            <table className="w-full text-left readout tabular-nums">
              <caption className="sr-only">Application hash-chain records</caption>
              <thead className="text-faint text-[10px]">
                <tr>
                  <th scope="col" className="p-2 border-b border-hairline"># Block</th>
                  <th scope="col" className="p-2 border-b border-hairline">Timestamp</th>
                  <th scope="col" className="p-2 border-b border-hairline">Event Type</th>
                  <th scope="col" className="p-2 border-b border-hairline">Tag</th>
                  <th scope="col" className="p-2 border-b border-hairline">SHA-256 Digest</th>
                </tr>
              </thead>
              <tbody>
                {auditData.events.map((ev, idx) => (
                  <tr key={idx} className="border-b border-hairline last:border-b-0 hover:bg-surface-2">
                    <td className="p-2 readout font-bold text-interactive">B#{ev.index}</td>
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
  );
}

export default AuditLedgerView;

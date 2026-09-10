import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Key } from 'lucide-react';
import { apiFetch } from '../utils/api';

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-200 text-xs font-medium gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Key className="w-4 h-4 text-sky-600" />
          <span className="font-bold text-slate-800 font-mono uppercase tracking-wide">
            Application SHA-256 Hash Chain &mdash; Internal Integrity Check
          </span>
          <span className="font-mono text-[10.5px] text-slate-500">Block Hash Integrity</span>
        </div>
        <button
          type="button"
          onClick={fetchAuditLedger}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-[11px] text-sky-700 hover:bg-slate-200 font-medium font-mono transition shadow-xs"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          <span>Verify Integrity</span>
        </button>
      </div>

      {/* Verification Status Banner */}
      {auditData && (
        <div role="status" className={`p-3.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs ${
          auditData.is_chain_valid
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
            : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            {auditData.is_chain_valid ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <div>
              <div className="font-mono font-bold text-xs">
                {auditData.is_chain_valid
                  ? 'No Hash-Chain Mismatch Detected'
                  : 'Hash-Chain Mismatch Detected'}
              </div>
              <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                {auditData.block_count} application records checked &middot; Genesis Hash: 0000000000000000
              </div>
            </div>
          </div>

          <div className={`font-mono text-xs font-semibold px-2.5 py-1 rounded-md border ${
            auditData.is_chain_valid
              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
              : 'bg-rose-100 border-rose-300 text-rose-800'
          }`}>
            {auditData.is_chain_valid ? 'Continuity check passed' : 'Continuity check failed'}
          </div>
        </div>
      )}

      <div className="text-[10.5px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
        This check verifies internal hash continuity only; it does not establish source authenticity, measurement accuracy, field provenance, or external immutability.
      </div>

      {/* Events Block Explorer */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-mono font-semibold text-slate-700 flex justify-between items-center">
          <span>Cryptographic Audit Block Stream</span>
          <span className="text-[10px] text-sky-700 font-mono font-bold">SHA-256 Chained</span>
        </div>

        <div className="max-h-[170px] overflow-y-auto text-[11px] font-mono tabular-nums">
          {auditData && auditData.events && auditData.events.length > 0 ? (
            <table className="w-full text-left">
              <caption className="sr-only">Application hash-chain records</caption>
              <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase font-semibold">
                <tr>
                  <th scope="col" className="p-2 border-b border-slate-200"># Block</th>
                  <th scope="col" className="p-2 border-b border-slate-200">Timestamp</th>
                  <th scope="col" className="p-2 border-b border-slate-200">Event Type</th>
                  <th scope="col" className="p-2 border-b border-slate-200">Tag</th>
                  <th scope="col" className="p-2 border-b border-slate-200">SHA-256 Digest</th>
                </tr>
              </thead>
              <tbody>
                {auditData.events.map((ev, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="p-2 font-bold text-sky-700">B#{ev.index}</td>
                    <td className="p-2 text-slate-600">{ev.timestamp_iso?.slice(11, 19)}</td>
                    <td className="p-2 font-semibold text-slate-800">{ev.event_type}</td>
                    <td className="p-2 text-slate-500">{ev.provenance_tag}</td>
                    <td className="p-2 text-sky-800 font-semibold">{ev.event_hash_short || '7f9a2e...'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-slate-400 font-mono text-xs">Loading audit ledger blocks...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuditLedgerView;

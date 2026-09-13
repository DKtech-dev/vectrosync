import React, { useMemo, useState } from 'react';
import { Upload, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { Skeleton } from './Skeleton';

/**
 * POST /api/csv/ingest — multipart `file` or form field `csv_text`.
 * Response: { status, row_count, control_valid, warnings[],
 *             mapping_report: { rawHeader: { target_channel, detected_unit,
 *                               confidence, confirmed } },
 *             column_data: { channel: [float|null] } }
 * 400 if neither input · 413 over 2 MiB · 422 on parse error. NaN -> null.
 */

const MAX_BYTES = 2 * 1024 * 1024;

/** Human label first; the raw backend token stays visible in a mono pill. */
const SCHEMA_STATE = {
  pass: { token: 'SCHEMA CHECKS PASSED', label: 'Channel mapping resolved', tone: 'tone-safe' },
  fail: { token: 'SCHEMA CHECKS FAILED', label: 'Mapping incomplete for control use', tone: 'tone-caution' },
};

const SAMPLE_CSV = `Time_Stamp,POLISHED_ROD_LOAD_KLBS,Stroke_Disp_in,Speed_SPM,BHT_degF
2026-09-01 10:00:00,12.5,0.0,4.2,176.0
2026-09-01 10:00:01,18.4,15.2,4.2,176.0
2026-09-01 10:00:02,24.8,38.5,4.2,176.0
2026-09-01 10:00:03,NaN,65.0,4.2,176.0
2026-09-01 10:00:04,28.9,88.2,4.2,176.0
2026-09-01 10:00:05,29.4,100.0,4.2,176.0`;

const formatCell = (v) => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(2) : '—';
  return String(v);
};

const confidenceTone = (c) => (c >= 0.9 ? 'tone-safe' : c >= 0.6 ? 'tone-caution' : 'tone-critical');

export function CsvIngestor() {
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const mappingRows = useMemo(() => {
    const report = result?.mapping_report;
    if (!report) return [];
    return Object.entries(report).map(([rawHeader, meta]) => ({ rawHeader, ...meta }));
  }, [result]);

  const columns = useMemo(() => Object.keys(result?.column_data || {}), [result]);
  const rowCount = useMemo(() => {
    if (!columns.length) return 0;
    return Math.min(6, result.column_data[columns[0]]?.length || 0);
  }, [result, columns]);

  const handleIngest = async () => {
    if (!csvText.trim()) {
      setStatus({ ok: false, message: 'Nothing to ingest: paste CSV text or upload a file first.' });
      return;
    }
    if (new Blob([csvText]).size > MAX_BYTES) {
      setStatus({ ok: false, message: 'Payload exceeds the 2 MiB limit the API accepts (HTTP 413).' });
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const formData = new FormData();
      formData.append('csv_text', csvText);

      const res = await apiFetch('/api/csv/ingest', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        const detail =
          data?.detail ||
          (res.status === 413
            ? 'File exceeds the 2 MiB limit.'
            : res.status === 422
              ? 'The parser could not read this file.'
              : `Ingest failed (${res.status}).`);
        setStatus({ ok: false, message: String(detail) });
        setResult(null);
        return;
      }

      setResult(data);
      setStatus({
        ok: data.control_valid === true,
        message: `Parsed ${data.row_count} rows into ${Object.keys(data.column_data || {}).length} standardized SI channels.`,
        warnings: data.warnings || [],
      });
    } catch (err) {
      setStatus({ ok: false, message: err.message || 'The ingest service is unavailable.' });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setStatus({ ok: false, message: `"${file.name}" is ${(file.size / 1048576).toFixed(1)} MiB — over the 2 MiB API limit.` });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(String(event.target.result || ''));
      setStatus(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const schemaState = status?.ok ? SCHEMA_STATE.pass : SCHEMA_STATE.fail;

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-hairline">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="icon-badge w-6 h-6 tone-signal">
            <FileSpreadsheet className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="panel-title">Channel mapper &amp; unit normalizer</h3>
            <p className="caption">Resolves vendor headers to canonical channels and converts to SI</p>
          </div>
        </div>
        <span className="caption shrink-0">Accepts klbs · in · °F · kN · m · K</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        {/* Input */}
        <div className="panel-nested p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="eyebrow">SOURCE CSV</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCsvText(SAMPLE_CSV);
                  setStatus(null);
                }}
                className="btn btn-ghost px-2.5 py-1"
              >
                Restore sample
              </button>
              <label className="btn px-2.5 py-1 cursor-pointer">
                <Upload className="w-3 h-3 text-interactive" aria-hidden="true" />
                Upload
                <input
                  aria-label="Upload a CSV or text data file (2 MiB maximum)"
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label htmlFor="csv-input" className="sr-only">
            CSV engineering data
          </label>
          <textarea
            id="csv-input"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={9}
            spellCheck={false}
            className="w-full readout text-[11px] well p-3 text-ink focus:border-interactive resize-y"
            placeholder="Paste CSV engineering data here…"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="caption">
              {new Blob([csvText]).size.toLocaleString()} B of 2 MiB · header row required
            </span>
            <button type="button" onClick={handleIngest} disabled={loading} className="btn btn-primary shrink-0">
              {loading ? 'Parsing…' : 'Map & normalize'}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="panel-nested p-4 flex flex-col gap-3">
          <span className="eyebrow">MAPPING REPORT</span>

          {status && (
            <div
              role="status"
              className={`well p-3 flex flex-col gap-2 border-l-2 ${status.ok ? 'border-l-safe' : 'border-l-caution'}`}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-semibold text-ink">{schemaState.label}</span>
                <span className={`pill ${schemaState.tone}`}>
                  <span className="chip-dot" aria-hidden="true" />
                  {schemaState.token}
                </span>
              </span>
              <span className="caption">{status.message}</span>
              {status.ok === false && (
                <span className="caption">
                  A false <span className="readout">control_valid</span> flag means the file is still fine to preview,
                  but the mapper would not hand it to a control path.
                </span>
              )}
              {status.warnings?.length ? (
                <ul className="caption list-disc pl-4 space-y-0.5">
                  {status.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {loading ? (
            <div className="well p-3 space-y-3">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : mappingRows.length ? (
            <div className="well overflow-hidden">
              <div className="overflow-auto max-h-[180px]">
                <table className="w-full text-left text-[11px]">
                  <caption className="sr-only">
                    Header resolution: each raw CSV header, the canonical channel it mapped to, the unit detected, and
                    the resolver's confidence.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                        RAW HEADER
                      </th>
                      <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                        CHANNEL
                      </th>
                      <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                        UNIT
                      </th>
                      <th scope="col" className="p-2 eyebrow border-b border-hairline bg-surface-2 sticky top-0">
                        CONF.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingRows.map((row) => (
                      <tr key={row.rawHeader} className="border-b border-hairline last:border-b-0">
                        <td className="p-2 readout text-muted whitespace-nowrap">{row.rawHeader}</td>
                        <td className="p-2 whitespace-nowrap">
                          <span className={`pill ${row.target_channel === 'unknown' ? 'tone-caution' : 'tone-signal'}`}>
                            {row.target_channel || 'unknown'}
                          </span>
                        </td>
                        <td className="p-2 readout text-ink whitespace-nowrap">{row.detected_unit || '—'}</td>
                        <td className="p-2 whitespace-nowrap">
                          {typeof row.confidence === 'number' ? (
                            <span className={`pill ${confidenceTone(row.confidence)}`}>
                              {(row.confidence * 100).toFixed(0)}%{row.confirmed ? ' ·CONF' : ''}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="well caption text-center py-8 px-4">
              Run “Map &amp; normalize” to see how each vendor header resolves to a canonical channel.
            </p>
          )}

          {/* SI preview */}
          {columns.length > 0 && !loading && (
            <>
              <span className="eyebrow">SI PREVIEW · FIRST {rowCount} ROWS</span>
              <div className="well overflow-hidden">
                <div className="overflow-auto max-h-[160px]">
                  <table className="w-full text-left text-[11px]">
                    <caption className="sr-only">Standardized SI preview of the parsed CSV channels</caption>
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col}
                            scope="col"
                            className="p-2 eyebrow border-b border-hairline whitespace-nowrap bg-surface-2 sticky top-0"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: rowCount }).map((_, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-hairline last:border-b-0">
                          {columns.map((col) => (
                            <td key={`${col}-${rowIdx}`} className="p-2 readout whitespace-nowrap text-ink">
                              {formatCell(result.column_data[col][rowIdx])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="caption">
                An em-dash is a gap the parser could not read (NaN in the source), never a substituted value.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CsvIngestor;

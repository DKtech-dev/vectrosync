import React, { useState } from 'react';
import { Upload, ArrowRight, FileText } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { Skeleton } from './Skeleton';

export function CsvIngestor() {
  const [csvText, setCsvText] = useState(`Time_Stamp,POLISHED_ROD_LOAD_KLBS,Stroke_Disp_in,Speed_SPM,BHT_degF
2026-09-01 10:00:00,12.5,0.0,4.2,176.0
2026-09-01 10:00:01,18.4,15.2,4.2,176.0
2026-09-01 10:00:02,24.8,38.5,4.2,176.0
2026-09-01 10:00:03,NaN,65.0,4.2,176.0
2026-09-01 10:00:04,28.9,88.2,4.2,176.0
2026-09-01 10:00:05,29.4,100.0,4.2,176.0`);

  const [ingestStatus, setIngestStatus] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleIngest = async () => {
    setLoading(true);
    setIngestStatus(null);
    try {
      const formData = new FormData();
      formData.append('csv_text', csvText);

      const res = await apiFetch('/api/csv/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        const schemaChecksPassed = data.control_valid === true;
        const warningText = data.warnings?.length ? ` ${data.warnings.join(' ')}` : '';
        setIngestStatus({
          success: schemaChecksPassed,
          message: schemaChecksPassed
            ? `Parsed ${data.row_count} rows; backend schema checks passed. Preview remains analysis-only.${warningText}`
            : `Parsed ${data.row_count} rows for analysis preview; backend control-valid flag is false.${warningText}`,
        });
        setParsedData(data.column_data);
      } else {
        setIngestStatus({ success: false, message: data.detail || 'Failed to ingest CSV.' });
      }
    } catch (err) {
      setIngestStatus({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText(event.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Section header — one panel title; resolver/mapper names are captions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hairline">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-faint" />
            <span className="text-[13px] font-semibold text-ink">Engineering data preview &amp; unit conversion</span>
          </div>
          <span className="caption">Imperial / SI auto-mapper</span>
        </div>
        <span className="caption">Regex column resolver</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Raw SCADA Input */}
        <div className="card-nested p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-[12px] font-medium text-ink">CSV input (synthetic sample shown)</span>
              <label className="btn px-3 py-1.5 panel-nested text-muted hover:text-ink cursor-pointer">
                <Upload className="w-3 h-3 text-interactive" />
                Upload .csv
                <input aria-label="Upload CSV or text data file" type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <textarea
              aria-label="CSV engineering data input"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={7}
              className="w-full readout text-[11px] panel-nested p-3 text-ink focus:border-interactive"
              placeholder="Paste CSV engineering data here..."
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="caption">Accepts: klbs, in, °F, kN, m, K</span>
            <button
              type="button"
              onClick={handleIngest}
              disabled={loading}
              className="btn px-3 py-1.5 bg-interactive/10 border border-interactive/30 text-interactive hover:bg-interactive/20"
            >
              {loading ? 'Processing...' : 'Ingest & Standardize'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Normalized Output Preview */}
        <div className="card-nested p-4 flex flex-col justify-between">
          <div>
            <div className="text-[12px] font-medium text-ink mb-3">Standardized SI normalized dataset</div>

            {ingestStatus && (
              <div
                role="status"
                className={`panel-nested p-3 mb-3 flex flex-col gap-2 border-l-2 ${
                  ingestStatus.success ? 'border-l-safe' : 'border-l-critical'
                }`}
              >
                <span className={`chip self-start ${ingestStatus.success ? 'text-safe bg-safe/10' : 'text-critical bg-critical/10'}`}>
                  <span className="chip-dot" />
                  {ingestStatus.success ? 'SCHEMA CHECKS PASSED' : 'SCHEMA CHECKS FAILED'}
                </span>
                <span className="caption">{ingestStatus.message}</span>
              </div>
            )}

            {loading ? (
              <div className="panel-nested p-3 space-y-3">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ) : parsedData ? (
              <div className="panel-nested overflow-hidden">
                <div className="overflow-x-auto max-h-[145px]">
                  <table className="w-full text-left text-[11px]">
                    <caption className="sr-only">Standardized SI preview of the parsed CSV columns</caption>
                    <thead className="text-tertiary text-[10px]">
                      <tr>
                        {Object.keys(parsedData).map((col) => (
                          <th key={col} scope="col" className="p-2 border-b border-hairline whitespace-nowrap font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData[Object.keys(parsedData)[0]]?.slice(0, 5).map((_, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-hairline last:border-b-0 hover:bg-surface-1">
                          {Object.keys(parsedData).map((col) => (
                            <td key={`${col}-${rowIdx}`} className="p-2 readout whitespace-nowrap text-ink">
                              {typeof parsedData[col][rowIdx] === 'number'
                                ? parsedData[col][rowIdx].toFixed(2)
                                : String(parsedData[col][rowIdx])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="panel-nested flex items-center justify-center text-center py-8 px-4 caption">
                Click "Ingest &amp; Standardize" to preview mapped engineering data
              </div>
            )}
          </div>

          <p className="caption mt-4 pt-4 border-t border-hairline">
            <span className="text-muted">Analysis only:</span>{' '}
            <span>Parsing and schema flags do not validate sensor provenance or authorize control; this console has no actuator connection.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default CsvIngestor;

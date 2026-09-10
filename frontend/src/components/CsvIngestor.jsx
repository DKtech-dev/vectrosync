import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, ArrowRight, FileText } from 'lucide-react';
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
    <div className="flex flex-col gap-3 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-hairline text-xs gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="w-4 h-4 text-faint" />
          <span className="section-title">
            CSV Engineering Data Preview &amp; Unit Conversion
          </span>
          <span className="readout text-[10.5px] text-muted">Imperial / SI Auto-Mapper</span>
        </div>
        <span className="readout text-[11px] text-muted">Regex Column Resolver</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Raw SCADA Input */}
        <div className="panel p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink">CSV Input (Synthetic Sample Shown)</span>
              <label className="btn bg-surface-2 border border-hairline text-muted hover:text-ink cursor-pointer px-3 py-1 text-[11px]">
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
              className="w-full text-xs readout bg-surface-2 border border-hairline rounded-lg p-3 text-ink focus:border-interactive"
              placeholder="Paste CSV engineering data here..."
            />
          </div>

          <div className="mt-4 flex justify-between items-center">
            <span className="readout text-[10.5px] text-muted">Accepts: klbs, in, °F, kN, m, K</span>
            <button
              type="button"
              onClick={handleIngest}
              disabled={loading}
              className="btn bg-interactive text-white hover:bg-interactive/90 px-4 py-2 text-xs"
            >
              {loading ? 'Processing...' : 'Ingest & Standardize'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Normalized Output Preview */}
        <div className="panel p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-ink mb-2">Standardized SI Normalized Dataset</div>

            {ingestStatus && (
              <div role="status" className={`p-2 rounded-md mb-2 text-xs readout flex items-center gap-1.5 border ${
                ingestStatus.success ? 'bg-safe/10 border-safe/30 text-ink' : 'bg-critical/10 border-critical/30 text-ink'
              }`}>
                {ingestStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-safe" /> : <AlertCircle className="w-4 h-4 shrink-0 text-critical" />}
                <span>{ingestStatus.message}</span>
              </div>
            )}

            {loading ? (
              <div className="panel-inset p-3 space-y-3">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ) : parsedData ? (
              <div className="overflow-x-auto max-h-[145px] text-[11px] readout panel-inset">
                <table className="w-full text-left">
                  <thead className="bg-surface-2 text-faint text-[10px] font-semibold">
                    <tr>
                      {Object.keys(parsedData).map((col) => (
                        <th key={col} className="p-2 border-b border-hairline whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData[Object.keys(parsedData)[0]]?.slice(0, 5).map((_, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-hairline last:border-b-0 hover:bg-surface-2">
                        {Object.keys(parsedData).map((col) => (
                          <td key={`${col}-${rowIdx}`} className="p-2 whitespace-nowrap text-ink">
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
            ) : (
              <div className="panel-inset flex items-center justify-center text-center py-10 px-4 text-faint readout text-xs">
                Click "Ingest & Standardize" to preview mapped engineering data
              </div>
            )}
          </div>

          <div className="text-[10.5px] text-muted flex items-start gap-2 mt-4 pt-2 border-t border-hairline readout">
            <span className="font-semibold text-interactive shrink-0">Analysis only:</span>
            <span>Parsing and schema flags do not validate sensor provenance or authorize control; this console has no actuator connection.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CsvIngestor;

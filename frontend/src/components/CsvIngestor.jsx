import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, ArrowRight, FileText } from 'lucide-react';

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

      const res = await fetch('/api/csv/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        const safeForControl = data.control_valid === true;
        const warningText = data.warnings?.length ? ` ${data.warnings.join(' ')}` : '';
        setIngestStatus({
          success: safeForControl,
          message: safeForControl
            ? `Parsed ${data.row_count} rows; safety gate passed.${warningText}`
            : `Parsed for analysis only; control gate inhibited.${warningText}`,
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
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-medium">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-600" />
          <span className="font-bold text-slate-800 font-mono uppercase tracking-wide">
            Adaptive SCADA Telemetry Ingestion &amp; Unit Conversion
          </span>
          <span className="font-mono text-[10.5px] text-slate-500">Imperial / SI Auto-Mapper</span>
        </div>
        <span className="font-mono text-[11px] text-sky-700 font-medium">Regex Column Resolver</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Raw SCADA Input */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-semibold text-slate-800">Raw SCADA Telemetry Data Stream</span>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono bg-slate-100 border border-slate-300 rounded hover:bg-slate-200 text-slate-700 transition">
                <Upload className="w-3 h-3 text-sky-600" />
                Upload .csv
                <input type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={7}
              className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-sky-500 tabular-nums"
              placeholder="Paste raw SCADA CSV content here..."
            />
          </div>

          <div className="mt-3 flex justify-between items-center font-mono">
            <span className="text-[10.5px] text-slate-500">Accepts: klbs, in, °F, kN, m, K</span>
            <button
              onClick={handleIngest}
              disabled={loading}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              {loading ? 'Processing...' : 'Ingest & Standardize'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Normalized Output Preview */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="text-xs font-mono font-semibold text-slate-800 mb-2">Standardized SI Normalized Dataset</div>
            
            {ingestStatus && (
              <div className={`p-2 rounded-md mb-2 text-xs font-mono flex items-center gap-1.5 ${
                ingestStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
              }`}>
                {ingestStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                <span>{ingestStatus.message}</span>
              </div>
            )}

            {parsedData ? (
              <div className="overflow-x-auto max-h-[145px] text-[11px] font-mono border border-slate-200 rounded-lg bg-slate-50 tabular-nums">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-semibold">
                    <tr>
                      {Object.keys(parsedData).map((col) => (
                        <th key={col} className="p-2 border-b border-slate-200 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData[Object.keys(parsedData)[0]]?.slice(0, 5).map((_, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-100">
                        {Object.keys(parsedData).map((col) => (
                          <td key={`${col}-${rowIdx}`} className="p-2 whitespace-nowrap text-slate-800">
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
              <div className="text-center py-10 text-slate-400 font-mono text-xs">
                Click "Ingest & Standardize" to preview mapped engineering telemetry
              </div>
            )}
          </div>

          <div className="text-[10.5px] text-slate-600 flex items-center gap-2 mt-3 pt-2 border-t border-slate-200 font-mono">
            <span className="font-semibold text-emerald-700">✓ Gap-Discipline:</span>
            <span>Linear interpolation is flagged; only validated schemas may pass the control gate</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CsvIngestor;

import React, { useState } from 'react';
import { Sparkles, ArrowUp, ShieldCheck, AlertTriangle, Quote } from 'lucide-react';
import { SkeletonPanel } from './Skeleton';

const INTENTS = [
  {
    match: (q) => /reduc|throttl|why.*speed|slow/i.test(q),
    field: 'dispatched_action',
    prompt: 'Why was the speed advisory reduced?',
  },
  {
    match: (q) => /trigger|what.*(state|happen)|cause/i.test(q),
    field: 'trigger_event',
    prompt: 'What triggered the current state?',
  },
  {
    match: (q) => /tension|floor|satisf|safe/i.test(q),
    field: 'structural_outcome',
    prompt: 'Is the tension floor satisfied?',
  },
  {
    match: (q) => /horizon|forecast|12.?h/i.test(q),
    field: 'forward_horizon',
    prompt: 'What does the 12-hour horizon show?',
  },
];

/**
 * A grounded query surface over the model explanation trace: every answer is
 * one of the four diagnostics fields already computed by the backend
 * WhyEngine for this exact model pass, never free-form generation. The
 * source field is always cited beneath the answer so the mechanism stays
 * auditable rather than opaque.
 */
export function WhyEngineConsole({ diagnostics, isBuckling }) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState(null);

  if (!diagnostics) {
    return <SkeletonPanel title="Awaiting model explanation trace" lines={3} />;
  }

  const {
    trigger_event,
    forward_horizon,
    dispatched_action,
    structural_outcome,
    provenance_tag,
    timestamp_iso,
  } = diagnostics;

  const fieldText = {
    trigger_event,
    forward_horizon,
    dispatched_action,
    structural_outcome,
  };

  const steps = [
    { key: 'trigger_event', label: 'Input trigger', body: trigger_event },
    { key: 'forward_horizon', label: 'Horizon assessment', body: forward_horizon },
    { key: 'dispatched_action', label: 'Recommendation', body: dispatched_action, tone: 'caution' },
  ];

  const handleAsk = (q) => {
    const text = q.trim();
    if (!text) return;
    const intent = INTENTS.find((i) => i.match(text));
    if (intent) {
      setAnswer({ text: fieldText[intent.field], field: intent.field, question: text });
    } else {
      setAnswer({ text: null, field: null, question: text });
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="icon-badge w-9 h-9 bg-interactive/10 text-interactive">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <h2 className="card-title">Ask Catenary Twin</h2>
            <p className="caption">Grounded in this pass's diagnostics -- every answer cites its source field</p>
          </div>
        </div>
        <span className="caption hidden sm:block readout">{timestamp_iso?.slice(11, 19)} UTC</span>
      </div>

      {/* Query bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(query);
        }}
        className="flex items-center gap-2 rounded-full border border-hairline bg-surface-2 pl-4 pr-1.5 py-1.5 focus-within:border-interactive/50 mb-3"
      >
        <Sparkles className="w-4 h-4 text-faint shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Ask the Catenary twin about this model output"
          placeholder="Ask about this model pass..."
          className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-faint outline-none min-w-0"
        />
        <button type="submit" aria-label="Submit question" className="btn btn-primary w-8 h-8 rounded-full p-0 shrink-0">
          <ArrowUp className="w-4 h-4" />
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mb-4">
        {INTENTS.map((i) => (
          <button
            key={i.prompt}
            type="button"
            onClick={() => {
              setQuery(i.prompt);
              handleAsk(i.prompt);
            }}
            className="pill bg-surface-2 text-muted hover:text-ink"
          >
            {i.prompt}
          </button>
        ))}
      </div>

      {/* Grounded answer, if a question was asked */}
      {answer && (
        <div className="card-nested p-4 mb-4 border-l-2 border-l-interactive">
          <div className="flex items-start gap-2.5">
            <Quote className="w-4 h-4 text-interactive shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[13px] text-ink leading-relaxed">
                {answer.text || "I can only answer from this model pass's diagnostics -- try one of the prompts above."}
              </p>
              {answer.field && (
                <span className="chip text-interactive bg-interactive/10 mt-2 inline-flex">
                  computed from diagnostics.{answer.field}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full explanation trace */}
      <div className="card-nested p-4 mb-4">
        <div className="flex flex-col gap-3">
          {steps.map((step) => (
            <div key={step.label} className="flex gap-3">
              <span
                className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  step.tone === 'caution' ? 'bg-caution' : 'bg-faint'
                }`}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink">{step.label}</div>
                <p className="text-[13px] text-muted leading-relaxed mt-0.5">{step.body}</p>
              </div>
            </div>
          ))}

          {/* Outcome */}
          <div
            className={`flex gap-3 rounded-xl p-3 mt-1 ${
              isBuckling ? 'bg-critical/10' : 'bg-safe/10'
            }`}
          >
            {isBuckling ? (
              <AlertTriangle className="w-4 h-4 text-critical shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-safe shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <div className={`text-[13px] font-semibold ${isBuckling ? 'text-critical' : 'text-safe'}`}>
                Modeled constraint result
              </div>
              <p className="text-[13px] text-ink/80 leading-relaxed mt-0.5">{structural_outcome}</p>
            </div>
          </div>
        </div>
      </div>

      <p className="caption pt-3 border-t border-hairline">
        {provenance_tag} · explanation of software outputs only; no action was dispatched and no structural condition is confirmed.
      </p>
    </div>
  );
}

export default WhyEngineConsole;

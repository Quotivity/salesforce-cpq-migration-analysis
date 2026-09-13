import type { ProgressEvent } from '@quotivity/cpq-inventory-core';

export const SCAN_STEPS: { id: string; label: string }[] = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'discovery', label: 'Discovery & capture' },
  { id: 'price', label: 'Price determination' },
  { id: 'discounting', label: 'Discounting' },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'output', label: 'Quote output' },
  { id: 'lifecycle', label: 'Contract lifecycle' },
  { id: 'code', label: 'Custom code & UI' },
  { id: 'seed', label: 'Package-owned records' },
  { id: 'classify', label: 'Classifying records by function' },
];

export function Scanning({
  progress,
  offline,
  error,
}: {
  progress: ProgressEvent[];
  offline: boolean;
  error?: string;
}) {
  const done = new Set<string>(progress.filter((p) => p.status === 'done').map((p) => p.step));
  const started = new Set<string>(progress.filter((p) => p.status === 'start').map((p) => p.step));
  const current = SCAN_STEPS.find((s) => started.has(s.id) && !done.has(s.id));
  const doneCount = SCAN_STEPS.filter((s) => done.has(s.id)).length;
  const pct = Math.round((doneCount / SCAN_STEPS.length) * 100);
  const currentLabel = error
    ? 'Stopped'
    : current
      ? current.id === 'classify'
        ? 'Classifying records by function…'
        : current.id === 'seed'
          ? 'Resolving package-owned records…'
          : `SOQL · ${current.label.toLowerCase()}`
      : doneCount === SCAN_STEPS.length
        ? 'Assembling the report…'
        : 'Connecting…';

  return (
    <div className="wrap scanning">
      {offline && (
        <div className="box-warn" style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#8A4A17', marginBottom: 5 }}>
            We could not register your email
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: '#5C4A38' }}>
            This machine could not reach Quotivity — a proxy, a VPN, or an egress rule, most likely.
            The analysis is running locally anyway. When it finishes you can print the report to PDF
            and send it to us directly.
          </div>
        </div>
      )}
      <h1 style={{ marginBottom: 8, fontSize: 28, letterSpacing: 0 }}>Reading your org</h1>
      <div className="mono" style={{ fontSize: 13, color: '#6E7C73', marginBottom: 26 }}>
        {currentLabel}
      </div>
      <div className="progress-track">
        <div className="progress-bar" style={{ width: `${pct}%` }} />
      </div>
      <div className="scan-log">
        {SCAN_STEPS.map((s) => {
          const state = done.has(s.id) ? 'done' : started.has(s.id) ? 'now' : 'queued';
          return (
            <div key={s.id} className={`scan-row ${state}`}>
              <span className="mark">{state === 'done' ? '✓' : state === 'now' ? '▸' : '·'}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              <span className="detail">
                {state === 'done' ? 'done' : state === 'now' ? 'querying' : 'queued'}
              </span>
            </div>
          );
        })}
      </div>
      {error && (
        <div className="box-error" style={{ marginTop: 26 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#B23A2E', marginBottom: 5 }}>
            The run stopped
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: '#3C4A42' }}>{error}</div>
          <div className="muted-13" style={{ marginTop: 8 }}>
            Nothing was transmitted. Press Enter in the terminal, then run the command again once
            the cause is addressed.
          </div>
        </div>
      )}
      <div className="muted-13" style={{ marginTop: 26 }}>
        Classifier inputs — product rules, product actions, error conditions, price rules and price
        actions — are retrieved in full. A partial set would produce wrong bucket assignments, so
        the run stops rather than classifying one.
      </div>
    </div>
  );
}

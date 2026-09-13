import type { ReportBucket, ReportData, ReportRow } from '@quotivity/cpq-inventory-core';
import { useState } from 'react';
import { fmt, verdictClass } from '../components/verdict';

interface Metric {
  k: string;
  v: string;
  cls: string;
}

export function bucketMetrics(b: ReportBucket, windowMonths: number): Metric[] {
  const aliveLabel = `Alive · ${windowMonths} mo`;
  const alive: Metric =
    b.alive == null
      ? { k: aliveLabel, v: '—', cls: 'zero' }
      : b.aliveUnreliable.length
        ? {
            k: `${aliveLabel} · bulk touch`,
            v: b.aliveUnreliable.map((u) => u.date).join(', '),
            cls: 'unreliable',
          }
        : { k: aliveLabel, v: fmt(b.alive), cls: '' };
  const attention: Metric =
    b.id === 'code'
      ? { k: 'Needs attention', v: '—', cls: 'zero' }
      : {
          k: 'Needs attention',
          v: fmt(b.needsAttention),
          cls: b.needsAttention === 0 ? 'zero' : 'attention',
        };
  const metrics: Metric[] = [
    { k: b.countsMechanisms ? 'Mechanisms' : 'Exists', v: fmt(b.exists), cls: '' },
    alive,
    attention,
  ];
  if (b.review != null) metrics.push({ k: 'Requires review', v: fmt(b.review), cls: 'review' });
  return metrics;
}

export const rowCount = (r: ReportRow): string =>
  r.unit ? `${fmt(r.count)} ${r.unit}` : fmt(r.count);

function BreakdownRow({ r }: { r: ReportRow }) {
  return (
    <div className="brow">
      <div style={{ flex: 1 }}>
        <div className="brow-label">{r.label}</div>
        <div className="brow-lands">→ {r.lands}</div>
        {r.crossListed && (
          <div className="brow-cross">Counted under {r.crossListed.countedInName}</div>
        )}
      </div>
      <div className="brow-right">
        <div className={`brow-count${r.count === 0 ? ' zero' : ''}`}>{rowCount(r)}</div>
        <div className="brow-tags">
          {r.shape && <span className="shape">{r.shape}</span>}
          <span className={`verdict ${verdictClass(r.verdict)}`}>{r.verdict}</span>
        </div>
      </div>
    </div>
  );
}

function BucketCard({
  b,
  open,
  onToggle,
  windowMonths,
}: {
  b: ReportBucket;
  open: boolean;
  onToggle: () => void;
  windowMonths: number;
}) {
  return (
    <div className="card">
      <div>
        <div className="card-name">{b.name}</div>
        <div className="card-q">{b.question}</div>
      </div>
      <div className="metrics">
        {bucketMetrics(b, windowMonths).map((m) => (
          <div key={m.k}>
            <div className={`metric-v ${m.cls}`}>{m.v}</div>
            <div className="metric-k">{m.k}</div>
          </div>
        ))}
      </div>
      <div className="summary">
        {b.summary.map((line) => (
          <div key={line}>{line}</div>
        ))}
        {b.partial && (
          <div className="partial-flag">
            Breakdown partial — more than 10,000 records in one object; the totals are exact.
          </div>
        )}
        {b.unread.length > 0 && (
          <div className="partial-flag">Not read after three attempts: {b.unread.join(', ')}</div>
        )}
      </div>
      <div style={{ paddingTop: 2 }}>
        <button type="button" className="btn-text" onClick={onToggle}>
          {open ? 'Hide the breakdown' : 'Show the breakdown'}
        </button>
      </div>
      {open && (
        <div className="breakdown">
          {b.rows.map((r) => (
            <BreakdownRow key={r.rowId} r={r} />
          ))}
          <div className="bnote">{b.note}</div>
        </div>
      )}
    </div>
  );
}

export function DenseBucket({
  b,
  open,
  onToggle,
  windowMonths,
}: {
  b: ReportBucket;
  open: boolean;
  onToggle?: () => void;
  windowMonths: number;
}) {
  return (
    <div className="dense-row">
      <div className="dense-head">
        <div className="dense-name">
          <b>{b.name}</b>
          <span>{b.question}</span>
        </div>
        <div className="dense-summary">
          {b.summary.map((line) => (
            <div key={line}>{line}</div>
          ))}
          {b.partial && <div className="partial-flag">Breakdown partial — totals are exact.</div>}
          {b.unread.length > 0 && (
            <div className="partial-flag">Not read: {b.unread.join(', ')}</div>
          )}
        </div>
        <div className="dense-metrics">
          {bucketMetrics(b, windowMonths).map((m) => (
            <div key={m.k}>
              <div className={`metric-v ${m.cls}`}>{m.v}</div>
              <div className="metric-k">{m.k}</div>
            </div>
          ))}
        </div>
        {onToggle && (
          <button type="button" className="btn-text" onClick={onToggle}>
            {open ? 'Hide the breakdown' : 'Show the breakdown'}
          </button>
        )}
      </div>
      {open && (
        <div className="dense-rows">
          {b.rows.map((r) => (
            <div key={r.rowId} className="drow">
              <div className="drow-label">
                {r.label} <span>→ {r.lands}</span>
                {r.crossListed && <span> · counted under {r.crossListed.countedInName}</span>}
              </div>
              <div className="drow-count">{rowCount(r)}</div>
              <div className="drow-shape shape">{r.shape ?? ''}</div>
              <div className={`drow-verdict ${verdictClass(r.verdict)}`}>{r.verdict}</div>
            </div>
          ))}
          <div className="bnote">{b.note}</div>
        </div>
      )}
    </div>
  );
}

export function InventoryBody({
  report,
  layout,
  open,
  onToggle,
}: {
  report: ReportData;
  layout: 'cards' | 'rows';
  open: Record<string, boolean>;
  onToggle?: (id: string) => void;
}) {
  const byId = new Map(report.buckets.map((b) => [b.id, b]));
  return (
    <div className="phases">
      {report.phases.map((ph) => (
        <div key={ph.id} className="phase">
          <div className="phase-head">
            <div className="phase-name">{ph.name}</div>
            <div className="phase-note">{ph.note}</div>
          </div>
          {layout === 'cards' ? (
            <div className="cards">
              {ph.buckets.map((id) => {
                const b = byId.get(id);
                return b ? (
                  <BucketCard
                    key={id}
                    b={b}
                    open={!!open[id]}
                    onToggle={() => onToggle?.(id)}
                    windowMonths={report.window.months}
                  />
                ) : null;
              })}
            </div>
          ) : (
            <div>
              {ph.buckets.map((id) => {
                const b = byId.get(id);
                return b ? (
                  <DenseBucket
                    key={id}
                    b={b}
                    open={!!open[id]}
                    onToggle={onToggle ? () => onToggle(id) : undefined}
                    windowMonths={report.window.months}
                  />
                ) : null;
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Inventory({ report, onNext }: { report: ReportData; onNext: () => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const allOpen = report.buckets.every((b) => open[b.id]);
  const toggleAll = () =>
    setOpen(allOpen ? {} : Object.fromEntries(report.buckets.map((b) => [b.id, true])));
  return (
    <div className="wrap stage">
      <div className="eyebrow tight">Stage 1 · Inventory</div>
      <h1 className="h32-14">What is in your org</h1>
      <div className="lede">
        Ten functional areas, ordered the way a quote happens. Each one answers a question about
        your business rather than naming an object.
      </div>

      <div className="chips">
        <div className="chip">
          <b>{report.org.name}</b> · {report.org.username}
        </div>
        <div className="chip">
          Alive measured over the trailing <b>{report.window.label}</b>
        </div>
        <div className="chip">
          Quote dates read from <b>{report.quoteDateField}</b>
        </div>
        <button type="button" className="btn-chip no-print" onClick={toggleAll}>
          {allOpen ? 'Collapse every breakdown' : 'Expand every breakdown'}
        </button>
      </div>

      <InventoryBody
        report={report}
        layout="cards"
        open={open}
        onToggle={(id) => setOpen((s) => ({ ...s, [id]: !s[id] }))}
      />

      <div className="box-brand lg" style={{ marginTop: 40 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0F2E22', marginBottom: 7 }}>
          Does this match what you expected? Most teams find something here they'd forgotten about.
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.65, color: '#3C4A42' }}>{report.highlights}</div>
      </div>

      {report.seeded.length > 0 && (
        <div className="muted-13" style={{ marginTop: 20 }}>
          Shipped with CPQ and not counted:{' '}
          {report.seeded.map((s) => `${fmt(s.count)} ${s.object}`).join(', ')}.
        </div>
      )}
      <div className="muted-13" style={{ marginTop: 12 }}>
        {report.unscanned}
      </div>
      <div className="muted-13" style={{ marginTop: 8 }}>
        Unclassifiable residue: {fmt(report.residue.count)} records ({report.residue.pct}%). Above
        about 5% the model needs another bucket.
      </div>

      <div style={{ marginTop: 32 }} className="no-print">
        <button type="button" className="btn" onClick={onNext}>
          See Where It Lands
        </button>
      </div>
    </div>
  );
}

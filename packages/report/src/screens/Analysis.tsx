import type { ReportData } from '@quotivity/cpq-inventory-core';
import { fmt, verdictAccent, verdictClass, verdictFg } from '../components/verdict';

export function AnalysisBody({ report }: { report: ReportData }) {
  return (
    <>
      <div className="tiles">
        {report.verdictScale.map((v) => (
          <div key={v.label} className="tile" style={{ borderLeftColor: verdictAccent(v.label) }}>
            <div className="tile-top">
              <div className="tile-count">{v.count}</div>
              <div className="tile-pct">{v.pct}% of verdicts</div>
            </div>
            <div className="tile-label" style={{ color: verdictAccent(v.label) }}>
              {v.label}
            </div>
            <div className="tile-meaning">{v.meaning}</div>
          </div>
        ))}
      </div>

      <div className="legend">
        <div className="legend-title">Shape · a separate fact, on clear-path rows only</div>
        {report.shapeLegend.map((s) => (
          <div key={s.label} className="legend-item">
            <span className="legend-count">{s.count}</span>
            <span className="legend-label">{s.label}</span>
            <span className="legend-meaning">{s.meaning}</span>
          </div>
        ))}
      </div>

      <div className="map">
        <div className="map-head">
          <div className="map-bucket">Bucket</div>
          <div className="map-from">Your Salesforce CPQ</div>
          <div className="map-to">Where it lands</div>
          <div className="map-shape">Shape</div>
          <div className="map-verdict">Verdict</div>
        </div>
        {report.mapping.map((m) => (
          <div key={m.id} className="map-row">
            <div className="map-bucket">{m.bucketName}</div>
            <div className="map-from">
              {m.from}
              {m.count > 0 && <span className="map-count">{fmt(m.count)}</span>}
            </div>
            <div className="map-to">{m.to}</div>
            <div className="map-shape shape">{m.shape ?? ''}</div>
            <div className={`map-verdict ${verdictClass(m.verdict)}`}>{m.verdict}</div>
          </div>
        ))}
      </div>

      <div className="panel review">
        <div className="panel-head">
          <div className="panel-title">
            <b>Requires further review</b>
            <span className="panel-count">{report.reviewCount} rows</span>
          </div>
          <div className="panel-sub">
            Not a verdict, and never folded into a bucket's needs-attention figure. A row lands here
            only because a short answer from you would change which verdict it gets.
          </div>
        </div>
        <div className="panel-body">
          {report.review.length === 0 && (
            <div className="muted-13" style={{ padding: '12px 0' }}>
              Nothing in this org needs a review call. Every row carries a verdict.
            </div>
          )}
          {report.review.map((r) => (
            <div key={r.subject} className="review-row">
              <div className="review-top">
                <span className="reason">{r.reason}</span>
                <span className="review-subject">{r.subject}</span>
              </div>
              <div className="review-q">{r.question}</div>
              <div className="outcomes">
                <div className="outcome a">
                  <span className="arrow">→</span>
                  <span>{r.outA}</span>
                </div>
                <div className="outcome b">
                  <span className="arrow">→</span>
                  <span>{r.outB}</span>
                </div>
              </div>
              {r.names.length > 0 && <div className="review-names">{r.names.join(' · ')}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="notes">
        {report.notes.map((n) => (
          <div key={n.head} className="box-plain note">
            <div className="note-head">{n.head}</div>
            <div className="note-body">{n.body}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginTop: 34 }}>
        <div className="panel-head">
          <div className="panel-title">
            <b>Prerequisites</b>
          </div>
          <div className="muted-13" style={{ marginTop: 4 }}>
            HubSpot properties every migrated rule or formula depends on. Nothing else can be built
            until these exist.
          </div>
        </div>
        <div className="panel-body" style={{ paddingTop: 6 }}>
          {report.prerequisites.length === 0 && (
            <div className="muted-13" style={{ padding: '10px 0' }}>
              No custom quote or line fields are referenced by a migrated rule or formula.
            </div>
          )}
          {report.prerequisites.map((p) => (
            <div key={`${p.object}.${p.field}`} className="prereq-row">
              <div className="prereq-field">{p.field}</div>
              <div className="prereq-need">{p.need}</div>
              {p.review && <div className="prereq-flag">Further review</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="box-brand lg" style={{ marginTop: 36 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0F2E22' }}>
          Every part of your configuration has either a destination or a decision — and this report
          names which.
        </div>
      </div>
      <div className="muted-13" style={{ marginTop: 14 }}>
        This report does not price the migration, estimate how long it takes, or compare licence
        costs. That is the conversation at the end.
      </div>
    </>
  );
}

export function Analysis({ report, onNext }: { report: ReportData; onNext: () => void }) {
  return (
    <div className="wrap stage">
      <div className="eyebrow tight">Stage 2 · Migration analysis</div>
      <h1 className="h32-14">Where each piece lands</h1>
      <div className="lede">
        The same ten buckets, one verdict per construct. One question decides every verdict: does
        the behaviour survive? Not whether the structure changes — it always does — and not how much
        work it is.
      </div>
      <AnalysisBody report={report} />
      <div style={{ marginTop: 32 }} className="no-print">
        <button type="button" className="btn" onClick={onNext}>
          Next: Share This Analysis
        </button>
      </div>
    </div>
  );
}

export { verdictFg };

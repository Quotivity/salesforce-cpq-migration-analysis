import type { ReportData } from '@quotivity/cpq-inventory-core';
import { useEffect } from 'react';
import wordmark from '../assets/q-wordmark-light.png?inline';
import { AnalysisBody } from '../screens/Analysis';
import { InventoryBody } from '../screens/Inventory';

function Ident({ report, stage }: { report: ReportData; stage: string }) {
  return (
    <div className="print-ident">
      <span>
        <b>{report.org.name}</b> · {report.org.username}
      </span>
      <span>
        Run {report.runId} · {report.generatedAt.slice(0, 10)}
      </span>
      <span>Alive measured over the trailing {report.window.label}</span>
      <span>Quote dates on {report.quoteDateField}</span>
      <span>{stage}</span>
    </div>
  );
}

/**
 * The single-file print document. Everything expanded, no controls, identification repeated at the
 * top of each stage. Prints itself once fonts have loaded and layout has settled; the tab stays open.
 */
export function PrintDocument({ report }: { report: ReportData }) {
  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* fonts API unavailable — print anyway */
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!cancelled) window.print();
    };
    void go();
    return () => {
      cancelled = true;
    };
  }, []);
  const allOpen = Object.fromEntries(report.buckets.map((b) => [b.id, true]));
  return (
    <div className="page print-doc">
      <div className="wrap stage">
        <Ident report={report} stage="Stage 1 · Inventory" />
        <div className="brand" style={{ marginBottom: 18 }}>
          <img src={wordmark} alt="Quotivity" />
          <span className="brand-sub">CPQ Inventory &amp; Migration Analysis</span>
        </div>
        <div className="eyebrow tight">Stage 1 · Inventory</div>
        <h1 className="h32-14">What is in your org</h1>
        <div className="lede">
          Ten functional areas, ordered the way a quote happens. Each one answers a question about
          your business rather than naming an object.
        </div>
        <InventoryBody report={report} layout="rows" open={allOpen} />
        <div className="box-brand lg" style={{ marginTop: 32 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0F2E22', marginBottom: 7 }}>
            Does this match what you expected? Most teams find something here they'd forgotten
            about.
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: '#3C4A42' }}>
            {report.highlights}
          </div>
        </div>
        {report.seeded.length > 0 && (
          <div className="muted-13" style={{ marginTop: 16 }}>
            Shipped with CPQ and not counted:{' '}
            {report.seeded.map((s) => `${s.count} ${s.object}`).join(', ')}.
          </div>
        )}
        <div className="muted-13" style={{ marginTop: 10 }}>
          {report.unscanned}
        </div>
        <div className="muted-13" style={{ marginTop: 8 }}>
          Unclassifiable residue: {report.residue.count} records ({report.residue.pct}%).
        </div>
      </div>
      <div className="wrap stage stage-break">
        <Ident report={report} stage="Stage 2 · Migration analysis" />
        <div className="eyebrow tight">Stage 2 · Migration analysis</div>
        <h1 className="h32-14">Where each piece lands</h1>
        <div className="lede">
          The same ten buckets, one verdict per construct. One question decides every verdict: does
          the behaviour survive? Not whether the structure changes — it always does — and not how
          much work it is.
        </div>
        <AnalysisBody report={report} />
        <div className="footer">
          @quotivity/cpq-inventory v{report.version} · run {report.runId} ·{' '}
          {report.generatedAt.slice(0, 10)} · source published at{' '}
          {report.sourceUrl.replace(/^https?:\/\//, '')}
        </div>
      </div>
    </div>
  );
}

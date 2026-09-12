import { HUBSPOT_MULTILINE_LIMIT } from '../config/outbound.js';
import type { ReportData } from './types.js';

/**
 * The compact summary that travels with the meeting-request form: the ten buckets, the mapping,
 * the verdicts and the names of the custom scripts flagged for review. Never the query results
 * underneath — no product names, prices, customers, code or org access.
 */
export function buildShareSummary(report: ReportData): string {
  const lines: string[] = [];
  lines.push(
    `Quotivity CPQ Inventory ${report.version} · run ${report.runId} · ${report.generatedAt.slice(0, 10)}`,
  );
  lines.push(
    `Org: ${report.org.name} · window ${report.window.label} · quote dates on ${report.quoteDateField}`,
  );
  lines.push('');
  lines.push('STAGE 1 · INVENTORY');
  for (const b of report.buckets) {
    const alive = b.alive == null ? '—' : String(b.alive);
    const review = b.review != null ? ` · review ${b.review}` : '';
    lines.push(
      `${b.name}: exists ${b.exists} · alive ${alive} · needs attention ${b.needsAttention}${review}${b.partial ? ' · partial' : ''}`,
    );
    for (const s of b.summary) lines.push(`  ${s}`);
    for (const r of b.rows) {
      if (r.count === 0) continue;
      lines.push(
        `  - ${r.label}: ${r.count}${r.unit ? ` ${r.unit}` : ''} → ${r.lands} [${r.verdict}${r.shape ? ` · ${r.shape}` : ''}]`,
      );
    }
  }
  lines.push('');
  lines.push('STAGE 2 · MIGRATION ANALYSIS');
  for (const t of report.verdictScale) lines.push(`${t.label}: ${t.count} (${t.pct}%)`);
  lines.push(`Requires further review: ${report.reviewCount}`);
  for (const m of report.mapping)
    lines.push(
      `- ${m.bucketName} · ${m.from} → ${m.to} [${m.verdict}${m.shape ? ` · ${m.shape}` : ''}]${m.count ? ` (${m.count})` : ''}`,
    );
  lines.push('');
  lines.push('REQUIRES FURTHER REVIEW');
  for (const r of report.review) {
    lines.push(`- ${r.reason} · ${r.subject}: ${r.question}`);
    if (/Quote Calculator|triggers/i.test(r.subject) && r.names.length)
      lines.push(`  scripts: ${r.names.join(', ')}`);
  }
  lines.push('');
  lines.push('PREREQUISITES');
  for (const p of report.prerequisites)
    lines.push(`- ${p.field} (${p.object}) — ${p.need}${p.review ? ' [review]' : ''}`);
  lines.push('');
  lines.push(`Residue: ${report.residue.count} records (${report.residue.pct}%)`);
  if (report.unread.length)
    lines.push(`Unread objects: ${report.unread.map((u) => u.object).join(', ')}`);

  let text = lines.join('\n');
  if (text.length > HUBSPOT_MULTILINE_LIMIT) {
    const marker = '\n… truncated to fit the form field limit';
    text = text.slice(0, HUBSPOT_MULTILINE_LIMIT - marker.length) + marker;
  }
  return text;
}

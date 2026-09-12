import { randomBytes } from 'node:crypto';
import { classifyAll } from './classify/index.js';
import type { OrgConnection } from './connection.js';
import { type ExtractOptions, extractAll, type ProgressEvent } from './extract/index.js';
import { assembleReport } from './report/assemble.js';
import type { ReportData } from './report/types.js';

export * from './banner.js';
export * from './classify/advancedCondition.js';
export * from './classify/formula.js';
export {
  type Classification,
  type ClassifiedRecord,
  classifyAll,
  type Tally,
} from './classify/index.js';
export {
  MECHANISM_BUCKETS,
  type RowId,
  RULE_ROWS,
  type RuleRow,
  ruleRow,
} from './classify/rules.js';
export * from './config/outbound.js';
export * from './connection.js';
export {
  type Extraction,
  type ExtractOptions,
  extractAll,
  type ProgressEvent,
  type ProgressStep,
} from './extract/index.js';
export * as records from './extract/records.js';
export * from './liveness.js';
export { MAPPING_ROWS, type MappingDef, SHAPE_MEANINGS, VERDICT_MEANINGS } from './mapping.js';
export { type AssembleOptions, assembleReport } from './report/assemble.js';
export { ASSETS_DIR, assetsAvailable, buildPrintDocument } from './report/printDoc.js';
export { buildShareSummary } from './report/shareSummary.js';
export * from './report/types.js';
export { type RunningServer, type RunStatus, type ServerOptions, startServer } from './server.js';
export * from './soql.js';
export * from './types.js';

export interface RunOptions extends Omit<ExtractOptions, 'onProgress'> {
  version: string;
  runId?: string;
  onProgress?: (e: ProgressEvent) => void;
}

export function newRunId(): string {
  return randomBytes(2).toString('hex');
}

/** The whole pipeline: extract → classify → assemble. Takes a connection, returns the data set. */
export async function runInventory(conn: OrgConnection, opts: RunOptions): Promise<ReportData> {
  const runId = opts.runId ?? newRunId();
  const progress = opts.onProgress ?? (() => {});
  const ex = await extractAll(conn, {
    windowMonths: opts.windowMonths,
    now: opts.now,
    onProgress: progress,
  });
  progress({ step: 'classify', status: 'start' });
  const cl = classifyAll(ex);
  const report = assembleReport(ex, cl, {
    version: opts.version,
    runId,
    org: {
      name: conn.orgName,
      username: conn.username,
      instanceUrl: conn.instanceUrl,
      orgId: conn.orgId,
    },
    now: opts.now,
  });
  progress({ step: 'classify', status: 'done' });
  return report;
}

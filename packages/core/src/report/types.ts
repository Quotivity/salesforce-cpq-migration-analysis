import type { OutboundConfig } from '../config/outbound.js';
import type { BucketId, PhaseId, ReviewReason, Shape, Verdict } from '../types.js';

export interface ReportRow {
  rowId: string;
  label: string;
  count: number;
  /** Unit printed after the count when it is not the row's own record ("14 products"). */
  unit?: string;
  alive: number;
  lands: string;
  verdict: Verdict;
  shape?: Shape;
  review?: ReviewReason;
  /** Present when the row is shown here as a cross-reference; the record is counted in `countedIn`. */
  crossListed?: { countedIn: BucketId; countedInName: string };
  /** Names of the records, in the admin's vocabulary, for the print document and the share summary. */
  names: string[];
  details: string[];
}

export interface ReportBucket {
  id: BucketId;
  name: string;
  question: string;
  phase: PhaseId;
  exists: number;
  /** null for buckets where liveness has no meaning (Custom code & UI). */
  alive: number | null;
  /** Objects whose Alive value is unreliable because of a bulk touch, with the date to print instead. */
  aliveUnreliable: { object: string; date: string }[];
  needsAttention: number;
  /** Absent (undefined) when the bucket has no review rows — never printed as zero. */
  review?: number;
  /** Exists counts mechanisms (non-empty rows) rather than records. */
  countsMechanisms: boolean;
  summary: string[];
  rows: ReportRow[];
  note: string;
  partial: boolean;
  unread: string[];
}

export interface MappingRow {
  id: string;
  bucket: BucketId;
  bucketName: string;
  from: string;
  to: string;
  verdict: Verdict;
  shape?: Shape;
  /** Records in this org that roll up to the row. */
  count: number;
}

export interface ReviewRow {
  reason: ReviewReason;
  subject: string;
  count: number;
  question: string;
  outA: string;
  outB: string;
  names: string[];
}

export interface Prerequisite {
  field: string;
  object: 'SBQQ__Quote__c' | 'SBQQ__QuoteLine__c';
  need: string;
  review: boolean;
}

export interface NoteCard {
  head: string;
  body: string;
}

export interface VerdictTile {
  label: Verdict;
  meaning: string;
  count: number;
  /** Share of verdicted mapping rows, as a percentage. */
  pct: number;
}

export interface ShapeLegendEntry {
  label: Shape;
  meaning: string;
  count: number;
}

export interface ReportData {
  version: string;
  runId: string;
  generatedAt: string;
  org: { name: string; username: string; instanceUrl: string; orgId: string };
  window: { months: number; since: string; label: string };
  quoteDateField: string;
  phases: { id: PhaseId; name: string; note: string; buckets: BucketId[] }[];
  buckets: ReportBucket[];
  verdictScale: VerdictTile[];
  shapeLegend: ShapeLegendEntry[];
  reviewCount: number;
  mapping: MappingRow[];
  review: ReviewRow[];
  notes: NoteCard[];
  prerequisites: Prerequisite[];
  seeded: { object: string; count: number }[];
  unread: { object: string; reason: string }[];
  unscanned: string;
  residue: { count: number; pct: number };
  highlights: string;
  volume: {
    quotesByYear: { year: number; total: number; amendRenew: number }[];
    quotesInWindow: number;
    distinctProductsQuoted: number;
  };
  outbound: OutboundConfig;
  fileName: string;
  sourceUrl: string;
}

import { errorText, isMissingObjectError, type OrgConnection, withRetry } from './connection.js';

/** Detail retrieval cap per object. Headline counts are never constrained by it. */
export const RETRIEVE_CAP = 10_000;

export type ReadStatus = 'ok' | 'absent' | 'unread';

export interface ObjectRead<T extends object = Record<string, unknown>> {
  object: string;
  status: ReadStatus;
  /** Exact count from the aggregate query (0 when absent or unread). */
  count: number;
  records: T[];
  /** True when the object holds more records than were retrieved. */
  partial: boolean;
  /** Why the object is absent or unread. */
  reason?: string;
}

export interface ReadOptions {
  where?: string;
  orderBy?: string;
  cap?: number;
  tooling?: boolean;
  /**
   * Classifier inputs cannot be truncated — a partial set produces wrong bucket assignments.
   * When set, exceeding the cap throws instead of returning a partial read.
   */
  classifierInput?: boolean;
  /** Objects known to be optional (namespace may be absent). */
  optional?: boolean;
}

export class ClassifierInputTooLargeError extends Error {
  constructor(
    public readonly object: string,
    public readonly count: number,
  ) {
    super(
      `${object} holds ${count} records, more than the ${RETRIEVE_CAP} the classifier can read in full. The run stops rather than classifying a partial set.`,
    );
    this.name = 'ClassifierInputTooLargeError';
  }
}

export function soqlDate(d: Date): string {
  return d.toISOString();
}

export function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function inList(ids: Iterable<string>): string {
  return `(${[...ids].map(quote).join(',')})`;
}

export async function count(
  conn: OrgConnection,
  object: string,
  where?: string,
  tooling = false,
): Promise<number> {
  const soql = `SELECT COUNT() FROM ${object}${where ? ` WHERE ${where}` : ''}`;
  const res = await withRetry(() => conn.query(soql, { tooling }));
  return res.totalSize;
}

function empty<T extends object>(
  object: string,
  status: ReadStatus,
  reason: string,
): ObjectRead<T> {
  return { object, status, count: 0, records: [], partial: false, reason };
}

/**
 * Reads one object: an aggregate COUNT() for the headline figure, then the records up to the cap.
 * Missing objects (a namespace that is not installed) come back `absent`; transport failures after
 * retries come back `unread`. Neither is ever reported as zero.
 */
export async function readObject<T extends object = Record<string, unknown>>(
  conn: OrgConnection,
  object: string,
  fields: readonly string[],
  opts: ReadOptions = {},
): Promise<ObjectRead<T>> {
  const cap = opts.cap ?? RETRIEVE_CAP;
  const where = opts.where ? ` WHERE ${opts.where}` : '';
  const orderBy = opts.orderBy ? ` ORDER BY ${opts.orderBy}` : '';
  try {
    const total = await count(conn, object, opts.where, opts.tooling);
    if (opts.classifierInput && total > cap) throw new ClassifierInputTooLargeError(object, total);
    if (total === 0) return { object, status: 'ok', count: 0, records: [], partial: false };
    const soql = `SELECT ${fields.join(', ')} FROM ${object}${where}${orderBy} LIMIT ${cap}`;
    const res = await withRetry(() => conn.query<T>(soql, { tooling: opts.tooling }));
    return {
      object,
      status: 'ok',
      count: total,
      records: res.records,
      partial: total > res.records.length,
    };
  } catch (err) {
    if (err instanceof ClassifierInputTooLargeError) throw err;
    if (isMissingObjectError(err)) return empty<T>(object, 'absent', errorText(err));
    return empty<T>(object, 'unread', errorText(err));
  }
}

/** Aggregate query returning grouped rows; absent/unread collapse to an empty list. */
export async function aggregate<T extends object>(
  conn: OrgConnection,
  soql: string,
  tooling = false,
): Promise<{ rows: T[]; status: ReadStatus; reason?: string }> {
  try {
    const res = await withRetry(() => conn.query<T>(soql, { tooling }));
    return { rows: res.records, status: 'ok' };
  } catch (err) {
    if (isMissingObjectError(err)) return { rows: [], status: 'absent', reason: errorText(err) };
    return { rows: [], status: 'unread', reason: errorText(err) };
  }
}

import type { Audited } from './extract/records.js';

/** Share of an object's records sharing one LastModifiedDate above which Alive is unreliable. */
export const BULK_TOUCH_SHARE = 0.6;
/** Below this many records a shared date is not evidence of a bulk touch. */
export const BULK_TOUCH_MIN_RECORDS = 10;

export interface BulkTouch {
  object: string;
  date: string;
  share: number;
}

/** Configuration liveness reads LastModifiedDate. Never CreatedDate. */
export function isAlive(rec: Pick<Audited, 'LastModifiedDate'>, since: string): boolean {
  const d = rec.LastModifiedDate;
  return !!d && d >= since;
}

/**
 * Package upgrades and mass updates rewrite LastModifiedDate across whole objects. When more than
 * 60% of an object's records share one LastModifiedDate, its Alive value is unreliable and the report
 * prints the date rather than the count.
 */
export function detectBulkTouch(
  object: string,
  records: readonly Pick<Audited, 'LastModifiedDate'>[],
): BulkTouch | null {
  if (records.length < BULK_TOUCH_MIN_RECORDS) return null;
  const tally = new Map<string, number>();
  for (const r of records) {
    if (!r.LastModifiedDate) continue;
    const key = r.LastModifiedDate;
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const entry of tally) if (!best || entry[1] > best[1]) best = entry;
  if (!best) return null;
  const share = best[1] / records.length;
  return share > BULK_TOUCH_SHARE ? { object, date: best[0].slice(0, 10), share } : null;
}

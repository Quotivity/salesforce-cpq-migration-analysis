import { describe, expect, it } from 'vitest';
import {
  parseAdvancedCondition,
  toDnf,
  validateAgainstIndexes,
} from '../src/classify/advancedCondition.js';
import { checkFormula } from '../src/classify/formula.js';
import { withRetry } from '../src/connection.js';
import { detectBulkTouch, isAlive } from '../src/liveness.js';
import { ClassifierInputTooLargeError, readObject } from '../src/soql.js';
import { EmulatedConnection } from './fixtures/soqlEmulator.js';

describe('advanced condition parser', () => {
  it('parses AND / OR with parentheses and flattens to DNF', () => {
    const p = parseAdvancedCondition('(1 AND 2) OR 3');
    expect(p.indexes).toEqual([1, 2, 3]);
    expect(p.dnf).toEqual([[1, 2], [3]]);
    expect(toDnf(parseAdvancedCondition('1 AND (2 OR 3)').expr)).toEqual([
      [1, 2],
      [1, 3],
    ]);
    expect(parseAdvancedCondition('((1 OR 2) AND (3 OR 1))').dnf).toEqual([
      [1, 3],
      [1],
      [2, 3],
      [1, 2],
    ]);
  });
  it('rejects NOT the way CPQ does', () => {
    expect(() => parseAdvancedCondition('NOT 1')).toThrow(
      /Only the following logical operators are accepted: AND, OR/,
    );
  });
  it('flags references to conditions that do not exist', () => {
    expect(validateAgainstIndexes('1 AND 4', [1, 2])).toMatchObject({ ok: false, missing: [4] });
    expect(validateAgainstIndexes('(1 AND', [1])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/unexpected end/),
    });
  });
});

describe('formula limits', () => {
  it('accepts the supported grammar', () => {
    expect(checkFormula('IF(AND(a > 1, b > 2), MIN(x, y), BLANKVALUE(z, 0))')).toMatchObject({
      ok: true,
      breaches: [],
    });
    expect(checkFormula('')).toMatchObject({ ok: true });
  });
  it('names the specific limit breached', () => {
    expect(checkFormula('AND(a, b, c, d, e, f)').breaches).toEqual([
      'AND() takes 2 to 5 arguments; this one has 6',
    ]);
    expect(checkFormula('OR(a)').breaches).toEqual(['OR() takes 2 to 5 arguments; this one has 1']);
    expect(checkFormula('ROUND(x, 2)').breaches).toEqual([
      'ROUND() is not in the calculated pricing grammar',
    ]);
    expect(checkFormula('IF(a, "text, with comma", b)').ok).toBe(true);
    const deep = `${'IF(a,'.repeat(11)}1${',0)'.repeat(11)}`;
    expect(checkFormula(deep).breaches.join(' ')).toMatch(/nested 11 levels deep/);
    expect(checkFormula(`IF(a, ${'x'.repeat(4000)}, b)`).breaches.join(' ')).toMatch(
      /over the 3900-character limit/,
    );
  });
});

describe('liveness', () => {
  it('reads LastModifiedDate only', () => {
    expect(
      isAlive({ LastModifiedDate: '2026-01-01T00:00:00.000Z' }, '2024-09-12T00:00:00.000Z'),
    ).toBe(true);
    expect(
      isAlive({ LastModifiedDate: '2023-01-01T00:00:00.000Z' }, '2024-09-12T00:00:00.000Z'),
    ).toBe(false);
    expect(isAlive({}, '2024-09-12T00:00:00.000Z')).toBe(false);
  });
  it('marks an object unreliable when >60% share one LastModifiedDate', () => {
    const shared = Array.from({ length: 8 }, () => ({
      LastModifiedDate: '2026-05-05T03:00:00.000Z',
    }));
    const others = [
      { LastModifiedDate: '2025-01-01T00:00:00.000Z' },
      { LastModifiedDate: '2024-01-01T00:00:00.000Z' },
    ];
    expect(detectBulkTouch('X', [...shared, ...others])).toEqual({
      object: 'X',
      date: '2026-05-05',
      share: 0.8,
    });
    expect(
      detectBulkTouch('X', [...shared.slice(0, 5), ...others, ...others, ...others]),
    ).toBeNull();
    expect(detectBulkTouch('X', shared.slice(0, 5))).toBeNull(); // too few records
  });
});

describe('reads', () => {
  it('retries transient failures three times then gives up', async () => {
    let calls = 0;
    const sleeps: number[] = [];
    await expect(
      withRetry(
        async () => {
          calls += 1;
          throw new Error('UNKNOWN_EXCEPTION: 503');
        },
        { sleep: async (ms) => void sleeps.push(ms) },
      ),
    ).rejects.toThrow(/503/);
    expect(calls).toBe(3);
    expect(sleeps).toEqual([500, 1000]);
  });
  it('does not retry an invalid object', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error("INVALID_TYPE: sObject type 'X' is not supported.");
      }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
  it('caps detail retrieval and reports the exact aggregate count', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ Id: `R${i}`, Name: `r${i}` }));
    const conn = new EmulatedConnection({ Big__c: rows });
    const read = await readObject(conn, 'Big__c', ['Id', 'Name'], { cap: 10 });
    expect(read).toMatchObject({ status: 'ok', count: 30, partial: true });
    expect(read.records).toHaveLength(10);
    await expect(
      readObject(conn, 'Big__c', ['Id'], { cap: 10, classifierInput: true }),
    ).rejects.toBeInstanceOf(ClassifierInputTooLargeError);
  });
  it('reports a missing object as absent', async () => {
    const conn = new EmulatedConnection({});
    const read = await readObject(conn, 'sbaa__ApprovalRule__c', ['Id']);
    expect(read.status).toBe('absent');
    expect(read.count).toBe(0);
  });
});

describe('waitForExit', () => {
  it('resolves on Enter from the input', async () => {
    const { PassThrough } = await import('node:stream');
    const { waitForExit } = await import('../src/waitForExit.js');
    const input = new PassThrough();
    const p = waitForExit({ input, interactive: true });
    input.write('\n');
    await expect(p).resolves.toBe('enter');
  });
  it('resolves on SIGINT and removes its listeners', async () => {
    const { waitForExit } = await import('../src/waitForExit.js');
    const before = process.listenerCount('SIGINT');
    const p = waitForExit({ interactive: false });
    process.emit('SIGINT');
    await expect(p).resolves.toBe('signal');
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
});

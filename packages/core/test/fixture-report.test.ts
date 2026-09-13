import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyAll } from '../src/classify/index.js';
import { extractAll } from '../src/extract/index.js';
import { assembleReport } from '../src/report/assemble.js';
import { acmeStore, NOW } from './fixtures/acme.js';
import { EmulatedConnection } from './fixtures/soqlEmulator.js';

/**
 * Produces the report fixture the React app and the e2e suite run on, from the same pipeline the
 * plugin runs. Regenerate with `npm run fixture:report` whenever the report shape changes.
 */
describe('report fixture', () => {
  it('matches the committed fixture (run `npm run fixture:report` to refresh)', async () => {
    const conn = new EmulatedConnection(acmeStore());
    const ex = await extractAll(conn, { now: NOW });
    const report = assembleReport(ex, classifyAll(ex), {
      version: '0.1.0',
      runId: '8f2c',
      org: {
        name: 'acme-prod',
        username: 'admin@acme.com',
        instanceUrl: conn.instanceUrl,
        orgId: conn.orgId,
      },
      now: NOW,
    });
    const target = resolve(__dirname, '../../report/src/fixture/acme-prod.json');
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (process.env.CPQ_WRITE_FIXTURE) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, json);
    }
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(target, 'utf8')).toBe(json);
  });
});

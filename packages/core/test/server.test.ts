import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { classifyAll } from '../src/classify/index.js';
import { HUBSPOT_MULTILINE_LIMIT } from '../src/config/outbound.js';
import { extractAll } from '../src/extract/index.js';
import { assembleReport } from '../src/report/assemble.js';
import { buildPrintDocument, inlineCssUrls } from '../src/report/printDoc.js';
import { buildShareSummary } from '../src/report/shareSummary.js';
import type { ReportData } from '../src/report/types.js';
import { type RunningServer, startServer } from '../src/server.js';
import { acmeStore, NOW } from './fixtures/acme.js';
import { EmulatedConnection } from './fixtures/soqlEmulator.js';

let report: ReportData;
let assetsDir: string;
let running: RunningServer;

beforeAll(async () => {
  const conn = new EmulatedConnection(acmeStore());
  const ex = await extractAll(conn, { now: NOW });
  report = assembleReport(ex, classifyAll(ex), {
    version: '0.1.0-test',
    runId: 'abcd',
    org: {
      name: 'acme-prod',
      username: 'admin@acme.com',
      instanceUrl: conn.instanceUrl,
      orgId: conn.orgId,
    },
    now: NOW,
  });
  assetsDir = mkdtempSync(join(tmpdir(), 'cpq-assets-'));
  writeFileSync(
    join(assetsDir, 'index.html'),
    '<!doctype html><html><head><title>x</title><link rel="stylesheet" href="./app.css"><script type="module" crossorigin src="./app.js"></script></head><body><div id="root"></div><img src="./mark.png"></body></html>',
  );
  writeFileSync(
    join(assetsDir, 'app.css'),
    '@font-face{font-family:F;src:url(\'./f.ttf\')}body{background:url("./mark.png")}',
  );
  writeFileSync(join(assetsDir, 'app.js'), 'console.log("</script>");');
  writeFileSync(join(assetsDir, 'f.ttf'), Buffer.from([1, 2, 3]));
  writeFileSync(join(assetsDir, 'mark.png'), Buffer.from([4, 5, 6]));
});

afterAll(async () => {
  await running?.close();
});

describe('print document', () => {
  it('inlines scripts, styles, fonts and images, embeds the data and sets the title', () => {
    const html = buildPrintDocument(report, assetsDir);
    expect(html).toContain('<title>quotivity-cpq-inventory-acme-prod-2026-09-12</title>');
    expect(html).toContain('window.__CPQ_REPORT__=');
    expect(html).toContain('window.__CPQ_PRINT__=true');
    expect(html).not.toMatch(/src="\.\/app\.js"/);
    expect(html).not.toMatch(/href="\.\/app\.css"/);
    expect(html).toContain('data:font/ttf;base64,AQID');
    expect(html).toContain('data:image/png;base64,BAUG');
    expect(html).toContain('console.log("<\\/script>")');
    expect(html).not.toContain('crossorigin');
  });
  it('leaves remote and data urls alone', () => {
    expect(
      inlineCssUrls('a{b:url(https://x/y.png)} c{d:url(data:image/png;base64,AA)}', assetsDir),
    ).toBe('a{b:url(https://x/y.png)} c{d:url(data:image/png;base64,AA)}');
  });
});

describe('share summary', () => {
  it('carries the buckets, verdicts and script names, never query results, under the field limit', () => {
    const text = buildShareSummary(report);
    expect(text).toContain('STAGE 1 · INVENTORY');
    expect(text).toContain('Catalog: exists 15');
    expect(text).toContain('Clear path: 21');
    expect(text).toContain('scripts: QCP_MarginFloorAcrossQuote');
    expect(text).not.toContain('Platform Bundle'); // a product name
    expect(text).not.toContain('Globex'); // a customer
    expect(text.length).toBeLessThan(HUBSPOT_MULTILINE_LIMIT);
  });
  it('truncates at the limit', () => {
    const huge = {
      ...report,
      prerequisites: Array.from({ length: 3000 }, (_, i) => ({
        field: `F${i}__c`,
        object: 'SBQQ__Quote__c' as const,
        need: 'x'.repeat(40),
        review: false,
      })),
    };
    const text = buildShareSummary(huge);
    expect(text.length).toBe(HUBSPOT_MULTILINE_LIMIT);
    expect(text.endsWith('… truncated to fit the form field limit')).toBe(true);
  });
});

describe('local server', () => {
  it('binds 127.0.0.1, runs only after POST /api/run, streams progress and serves the print doc', async () => {
    const conn = new EmulatedConnection(acmeStore());
    let ran = 0;
    running = await startServer({
      version: '0.1.0-test',
      runId: 'abcd',
      org: { name: 'acme-prod', username: 'admin@acme.com' },
      assetsDir,
      port: 43579,
      run: async (onProgress) => {
        ran += 1;
        const ex = await extractAll(conn, { now: NOW, onProgress });
        return assembleReport(ex, classifyAll(ex), {
          version: '0.1.0-test',
          runId: 'abcd',
          org: {
            name: 'acme-prod',
            username: 'admin@acme.com',
            instanceUrl: conn.instanceUrl,
            orgId: conn.orgId,
          },
          now: NOW,
        });
      },
    });
    expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    const state = await (await fetch(`${running.url}api/state`)).json();
    expect(state).toMatchObject({ status: 'idle', org: { name: 'acme-prod' }, assets: true });
    expect(ran).toBe(0);
    expect(conn.queries).toHaveLength(0); // nothing queried before the gate
    expect((await fetch(`${running.url}api/report.json`)).status).toBe(409);

    const index = await fetch(running.url);
    expect(index.headers.get('content-type')).toMatch(/text\/html/);
    expect((await fetch(`${running.url}some/spa/route`)).status).toBe(200);

    const res = await fetch(`${running.url}api/run`, { method: 'POST' });
    expect(res.status).toBe(202);
    const sse = await fetch(`${running.url}api/progress`);
    const body = await sse.text();
    expect(body).toContain('"step":"catalog","status":"start"');
    expect(body).toContain('event: done');
    expect(ran).toBe(1);
    await fetch(`${running.url}api/run`, { method: 'POST' });
    expect(ran).toBe(1); // idempotent

    const data = (await (await fetch(`${running.url}api/report.json`)).json()) as ReportData;
    expect(data.buckets).toHaveLength(10);
    const summary = await (await fetch(`${running.url}api/share-summary`)).json();
    expect(summary.summary).toContain('STAGE 2');
    const print = await fetch(`${running.url}report?print=1`);
    expect(print.headers.get('content-type')).toMatch(/text\/html/);
    expect(await print.text()).toContain('window.__CPQ_PRINT__=true');
    expect((await fetch(`${running.url}../etc/passwd`)).status).not.toBe(500);
  }, 20_000);

  it('increments when the port is taken', async () => {
    const second = await startServer({
      version: 'x',
      runId: 'r',
      org: { name: 'a', username: 'b' },
      assetsDir,
      port: running.port,
      run: async () => report,
    });
    expect(second.port).toBe(running.port + 1);
    await second.close();
  });
});

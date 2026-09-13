// Serves the built report app over the real core server with the fixture report, for Playwright.
// The run handler replays progress events and returns the fixture — no org involved.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '@quotivity/cpq-inventory-core';

const here = dirname(fileURLToPath(import.meta.url));
const report = JSON.parse(readFileSync(resolve(here, '../src/fixture/acme-prod.json'), 'utf8'));
const steps = [
  'catalog',
  'configuration',
  'discovery',
  'price',
  'discounting',
  'guardrails',
  'approvals',
  'output',
  'lifecycle',
  'code',
  'seed',
  'classify',
];
const port = Number(process.env.CPQ_E2E_PORT ?? 3590);

import { createServer } from 'node:http';

const options = {
  version: report.version,
  runId: report.runId,
  org: { name: report.org.name, username: report.org.username },
  port,
  run: async (onProgress) => {
    for (const step of steps) {
      onProgress({ step, status: 'start' });
      await new Promise((r) => setTimeout(r, 40));
      onProgress({ step, status: 'done' });
    }
    return report;
  },
  log: (line) => console.log(line),
};

let running = await startServer(options);
console.log(`e2e server on ${running.url}`);

// Control endpoint on the next port: POST /reset restarts the core server with fresh state so each
// test starts before the gate. Test harness only — the shipped server has no such route.
createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/reset') {
    await running.close();
    running = await startServer(options);
    res.writeHead(200);
    return res.end('reset');
  }
  res.writeHead(404);
  res.end();
}).listen(port + 1, '127.0.0.1');

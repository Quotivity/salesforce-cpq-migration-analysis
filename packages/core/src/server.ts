import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, resolve } from 'node:path';
import { outboundConfig } from './config/outbound.js';
import type { ProgressEvent } from './extract/index.js';
import { ASSETS_DIR, assetsAvailable, buildPrintDocument, MIME } from './report/printDoc.js';
import { buildShareSummary } from './report/shareSummary.js';
import type { ReportData } from './report/types.js';

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export interface ServerOptions {
  /** Runs the analysis. Called at most once, from POST /api/run — never before the gate. */
  run: (onProgress: (e: ProgressEvent) => void) => Promise<ReportData>;
  org: { name: string; username: string };
  version: string;
  runId: string;
  port?: number;
  host?: string;
  assetsDir?: string;
  /** Pre-computed report, for tests and for re-serving a saved run. Skips the gate. */
  report?: ReportData;
  log?: (line: string) => void;
}

export interface RunningServer {
  server: Server;
  /** The URL to open: http://localhost:<port>/. */
  url: string;
  port: number;
  close: () => Promise<void>;
  state: () => { status: RunStatus; error?: string };
}

const HOST = '127.0.0.1';
const DEFAULT_PORT = 3579;

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const host = opts.host ?? HOST;
  const assetsDir = resolve(opts.assetsDir ?? ASSETS_DIR);
  const log = opts.log ?? (() => {});
  let status: RunStatus = opts.report ? 'done' : 'idle';
  let report: ReportData | undefined = opts.report;
  let error: string | undefined;
  const progress: ProgressEvent[] = [];
  const subscribers = new Set<ServerResponse>();

  const emit = (e: ProgressEvent) => {
    progress.push(e);
    const payload = `data: ${JSON.stringify(e)}\n\n`;
    for (const res of subscribers) res.write(payload);
  };
  const finish = (kind: 'done' | 'error', detail?: string) => {
    const payload = `event: ${kind}\ndata: ${JSON.stringify({ detail })}\n\n`;
    for (const res of subscribers) {
      res.write(payload);
      res.end();
    }
    subscribers.clear();
  };

  const startRun = () => {
    if (status !== 'idle') return;
    status = 'running';
    log('Gate submitted. Reading the org…');
    opts
      .run(emit)
      .then((r) => {
        report = r;
        status = 'done';
        log('Analysis complete.');
        finish('done');
      })
      .catch((err: unknown) => {
        status = 'error';
        error = err instanceof Error ? err.message : String(err);
        log(`Analysis failed: ${error}`);
        finish('error', error);
      });
  };

  const json = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify(body));
  };

  const handler = (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${host}`);
    const path = url.pathname;
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');

    if (path === '/api/state') {
      return json(res, 200, {
        status,
        error,
        progress,
        org: opts.org,
        version: opts.version,
        runId: opts.runId,
        outbound: outboundConfig(),
        assets: assetsAvailable(assetsDir),
      });
    }
    if (path === '/api/run' && req.method === 'POST') {
      startRun();
      return json(res, 202, { status });
    }
    if (path === '/api/progress') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      for (const e of progress) res.write(`data: ${JSON.stringify(e)}\n\n`);
      if (status === 'done') {
        res.write('event: done\ndata: {}\n\n');
        return res.end();
      }
      if (status === 'error') {
        res.write(`event: error\ndata: ${JSON.stringify({ detail: error })}\n\n`);
        return res.end();
      }
      subscribers.add(res);
      req.on('close', () => subscribers.delete(res));
      return;
    }
    if (path === '/api/report.json') {
      if (!report)
        return json(res, 409, { error: status === 'error' ? error : 'analysis has not run' });
      return json(res, 200, report);
    }
    if (path === '/api/share-summary') {
      if (!report) return json(res, 409, { error: 'analysis has not run' });
      return json(res, 200, { summary: buildShareSummary(report) });
    }
    if (path === '/report' && url.searchParams.get('print') === '1') {
      if (!report) return json(res, 409, { error: 'analysis has not run' });
      if (!assetsAvailable(assetsDir))
        return json(res, 500, { error: 'report assets are missing from this install' });
      const html = buildPrintDocument(report, assetsDir);
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      return res.end(html);
    }
    if (path.startsWith('/api/')) return json(res, 404, { error: 'not found' });

    // Static assets, with SPA fallback to index.html.
    if (!assetsAvailable(assetsDir)) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('Report assets are missing from this install. Reinstall the package.');
    }
    const clean = decodeURIComponent(path).replace(/^\/+/, '');
    let file = resolve(assetsDir, clean || 'index.html');
    if (!file.startsWith(assetsDir)) {
      res.writeHead(403);
      return res.end();
    }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(assetsDir, 'index.html');
    const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'content-type': type,
      'cache-control': file.endsWith('index.html') ? 'no-store' : 'public, max-age=3600',
    });
    res.end(readFileSync(file));
  };

  const server = createServer(handler);
  const port = await listen(server, host, opts.port ?? DEFAULT_PORT);
  const address = server.address() as AddressInfo;
  // Browsers resolve "localhost" to ::1 or 127.0.0.1 depending on the machine. Bind the IPv6
  // loopback as well, best effort, so http://localhost works either way. Still loopback only.
  const v6 = host === HOST ? await listenLoopbackV6(handler, address.port) : null;
  const url =
    host === HOST ? `http://localhost:${address.port}/` : `http://${host}:${address.port}/`;
  return {
    server,
    url,
    port,
    close: () =>
      new Promise<void>((resolveClose) => {
        for (const s of subscribers) s.end();
        subscribers.clear();
        v6?.close();
        server.close(() => resolveClose());
      }),
    state: () => ({ status, error }),
  };
}

/** Best-effort second listener on ::1 for the same port; null when IPv6 loopback is unavailable. */
function listenLoopbackV6(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
  port: number,
): Promise<Server | null> {
  return new Promise((resolveV6) => {
    const s = createServer(handler);
    s.once('error', () => resolveV6(null));
    s.once('listening', () => resolveV6(s));
    s.listen(port, '::1');
  });
}

/** Binds 127.0.0.1 only. Detects a taken port and increments, up to 20 tries. */
async function listen(server: Server, host: string, start: number): Promise<number> {
  for (let port = start; port < start + 20; port++) {
    const ok = await new Promise<boolean>((resolveTry) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.removeListener('listening', onListening);
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') resolveTry(false);
        else throw err;
      };
      const onListening = () => {
        server.removeListener('error', onError);
        resolveTry(true);
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(port, host);
    });
    if (ok) return port;
  }
  throw new Error(`no free port between ${start} and ${start + 19} on ${host}`);
}

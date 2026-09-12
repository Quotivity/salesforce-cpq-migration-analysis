import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReportData } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
/** Compiled report app, produced by `packages/report` at publish time. */
export const ASSETS_DIR = resolve(here, '..', '..', 'assets', 'report');

export const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function assetsAvailable(dir = ASSETS_DIR): boolean {
  return existsSync(join(dir, 'index.html'));
}

function dataUri(path: string): string {
  const mime = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime.split(';')[0]};base64,${readFileSync(path).toString('base64')}`;
}

function resolveAsset(dir: string, ref: string, root = dir): string | null {
  const bare = ref.split(/[?#]/)[0] ?? '';
  // Root-absolute references (Vite's public assets) resolve against the assets root; relative ones
  // against the referencing file's folder.
  const path = bare.startsWith('/')
    ? resolve(root, bare.slice(1))
    : resolve(dir, bare.replace(/^\.\//, ''));
  if (!path.startsWith(root) || !existsSync(path)) return null;
  return path;
}

/** Inlines url(...) references inside CSS as data URIs so fonts and images travel with the page. */
export function inlineCssUrls(css: string, dir: string, root = dir): string {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (m, q: string, ref: string) => {
    if (/^(data:|https?:|\/\/)/.test(ref)) return m;
    const path = resolveAsset(dir, ref, root);
    return path ? `url(${q}${dataUri(path)}${q})` : m;
  });
}

const escapeForScript = (json: string): string =>
  json.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

/**
 * Assembles the single self-contained print document: the compiled app with every script, style,
 * font and image inlined, the report data embedded, and the title set so the saved PDF names itself.
 */
export function buildPrintDocument(report: ReportData, dir = ASSETS_DIR): string {
  let html = readFileSync(join(dir, 'index.html'), 'utf8');
  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag: string) => {
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    const path = href ? resolveAsset(dir, href) : null;
    if (!path) return tag;
    return `<style>${inlineCssUrls(readFileSync(path, 'utf8'), dirname(path), dir)}</style>`;
  });
  html = html.replace(/<link\b[^>]*rel=["'](?:icon|modulepreload)["'][^>]*>/gi, '');
  html = html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi,
    (tag: string, pre: string, src: string, post: string) => {
      const path = resolveAsset(dir, src);
      if (!path) return tag;
      const attrs = `${pre} ${post}`.replace(/\s*crossorigin\s*/i, ' ').trim();
      return `<script ${attrs}>${escapeForScript(readFileSync(path, 'utf8'))}</script>`;
    },
  );
  html = html.replace(
    /<img\b([^>]*)\bsrc=["']([^"']+)["']/gi,
    (tag: string, pre: string, src: string) => {
      const path = resolveAsset(dir, src);
      return path ? `<img${pre} src="${dataUri(path)}"` : tag;
    },
  );
  const data = `<script>window.__CPQ_REPORT__=${escapeForScript(JSON.stringify(report))};window.__CPQ_PRINT__=true;</script>`;
  const title = `<title>${report.fileName}</title>`;
  html = html.replace(/<title>[^<]*<\/title>/i, title);
  if (!/<title>/i.test(html)) html = html.replace(/<head>/i, `<head>${title}`);
  html = html.replace(/<head>/i, `<head>${data}`);
  return html;
}

import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import {
  ASSETS_DIR,
  assetsAvailable,
  EXIT_HINT,
  launchBanner,
  newRunId,
  readyLine,
  runInventory,
  STOPPED_LINE,
  startServer,
  waitForExit,
} from '@quotivity/cpq-inventory-core';
import open from 'open';
import { FetchConnection } from './fetchConnection.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

export const USAGE = `Quotivity CPQ Inventory ${version} — standalone

Usage:
  cpq-inventory --instance-url https://acme.my.salesforce.com --access-token <token> [options]

The access token can also be supplied as SF_ACCESS_TOKEN; the instance URL as SF_INSTANCE_URL.
Get both from \`sf org display --target-org <alias>\` or from any authenticated session.

Options:
  --instance-url <url>   Salesforce instance URL (required)
  --access-token <tok>   Session access token (required)
  --org-name <name>      Name printed on the report and in the PDF filename (default: instance host)
  --window <months>      Dead-configuration window in months (default: 24)
  --port <port>          Port to serve the report on, loopback only (default: 3579)
  --no-open              Do not open a browser; print the URL instead
  --help                 Show this help

Nothing about the configuration leaves this machine. Every request to Salesforce is a read.
`;

export interface CliOptions {
  instanceUrl: string;
  accessToken: string;
  orgName?: string;
  window: number;
  port: number;
  open: boolean;
}

export function parseCli(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): CliOptions | 'help' {
  const { values } = parseArgs({
    args: argv,
    options: {
      'instance-url': { type: 'string' },
      'access-token': { type: 'string' },
      'org-name': { type: 'string' },
      window: { type: 'string' },
      port: { type: 'string' },
      'no-open': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.help) return 'help';
  const instanceUrl = values['instance-url'] ?? env.SF_INSTANCE_URL;
  const accessToken = values['access-token'] ?? env.SF_ACCESS_TOKEN;
  if (!instanceUrl || !accessToken)
    throw new Error(
      'both --instance-url and --access-token are required (or SF_INSTANCE_URL / SF_ACCESS_TOKEN).',
    );
  if (!/^https:\/\//.test(instanceUrl)) throw new Error('--instance-url must start with https://');
  const window = values.window ? Number(values.window) : 24;
  const port = values.port ? Number(values.port) : 3579;
  if (!Number.isInteger(window) || window < 1 || window > 120)
    throw new Error('--window must be a whole number of months between 1 and 120.');
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error('--port must be between 1024 and 65535.');
  return {
    instanceUrl,
    accessToken,
    orgName: values['org-name'],
    window,
    port,
    open: !values['no-open'],
  };
}

export async function main(argv: string[]): Promise<void> {
  const opts = parseCli(argv);
  if (opts === 'help') {
    console.log(USAGE);
    return;
  }
  if (!assetsAvailable())
    throw new Error(
      `The compiled report is missing from this install (expected ${ASSETS_DIR}). Reinstall the package.`,
    );
  const conn = new FetchConnection({
    instanceUrl: opts.instanceUrl,
    accessToken: opts.accessToken,
    orgName: opts.orgName,
  });
  await conn.identify();
  const org = { name: conn.orgName, username: conn.username };
  const runId = newRunId();
  console.log(launchBanner(org));
  const server = await startServer({
    version,
    runId,
    org,
    port: opts.port,
    log: (line) => console.log(line),
    run: (onProgress) =>
      runInventory(conn, { version, runId, windowMonths: opts.window, onProgress }),
  });
  console.log(readyLine(server.url));
  if (opts.open) await open(server.url);
  console.log(EXIT_HINT);
  await waitForExit();
  await server.close();
  console.log(STOPPED_LINE);
}

import { createRequire } from 'node:module';
import {
  ASSETS_DIR,
  assetsAvailable,
  EXIT_HINT,
  launchBanner,
  newRunId,
  runInventory,
  STOPPED_LINE,
  startServer,
  waitForExit,
} from '@quotivity/cpq-inventory-core';
import { Messages, StateAggregator } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import open from 'open';
import { adaptConnection } from '../../adapter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@quotivity/cpq-inventory', 'cpq.inventory');
const { version } = createRequire(import.meta.url)('../../../package.json') as { version: string };

export type CpqInventoryResult = {
  url: string;
  port: number;
  org: string;
  runId: string;
  windowMonths: number;
};

export default class CpqInventory extends SfCommand<CpqInventoryResult> {
  public static override readonly summary = messages.getMessage('summary');
  public static override readonly description = messages.getMessage('description');
  public static override readonly examples = messages.getMessages('examples');

  public static override readonly flags = {
    'target-org': Flags.requiredOrg(),
    'api-version': Flags.orgApiVersion(),
    window: Flags.integer({
      char: 'w',
      summary: messages.getMessage('flags.window.summary'),
      description: messages.getMessage('flags.window.description'),
      default: 24,
      min: 1,
      max: 120,
    }),
    port: Flags.integer({
      char: 'p',
      summary: messages.getMessage('flags.port.summary'),
      default: 3579,
      min: 1024,
      max: 65535,
    }),
    'no-open': Flags.boolean({
      summary: messages.getMessage('flags.no-open.summary'),
      default: false,
    }),
  };

  public async run(): Promise<CpqInventoryResult> {
    const { flags } = await this.parse(CpqInventory);
    const org = flags['target-org'];
    const username = org.getUsername() ?? 'unknown user';
    const aliases = (await StateAggregator.getInstance()).aliases;
    const name = aliases.get(username) ?? username;
    const conn = adaptConnection(org.getConnection(flags['api-version']), {
      name,
      username,
      orgId: org.getOrgId(),
    });

    if (!assetsAvailable()) throw messages.createError('error.assets', [ASSETS_DIR]);

    const runId = newRunId();
    this.log(launchBanner({ name, username }));

    const server = await startServer({
      version,
      runId,
      org: { name, username },
      port: flags.port,
      log: (line) => this.log(line),
      run: (onProgress) =>
        runInventory(conn, { version, runId, windowMonths: flags.window, onProgress }),
    });
    this.log(messages.getMessage('info.ready', [server.url]));
    if (!flags['no-open']) await open(server.url);

    this.log(EXIT_HINT);
    // sf-plugins-core installs a SIGINT handler that throws an ExitError with a stack trace. The
    // command owns the process while the server runs, so replace it: Enter or Ctrl-C both close the
    // server and let run() return, and the CLI exits cleanly.
    process.removeAllListeners('SIGINT');
    await waitForExit();
    await server.close();
    this.log(STOPPED_LINE);

    return { url: server.url, port: server.port, org: name, runId, windowMonths: flags.window };
  }
}

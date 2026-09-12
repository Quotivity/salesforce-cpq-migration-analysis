import { describe, expect, it } from 'vitest';
import { parseCli } from '../src/cli.js';
import { FetchConnection } from '../src/fetchConnection.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('parseCli', () => {
  it('reads flags with the spec defaults', () => {
    expect(
      parseCli(['--instance-url', 'https://acme.my.salesforce.com', '--access-token', 'tok']),
    ).toEqual({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'tok',
      orgName: undefined,
      window: 24,
      port: 3579,
      open: true,
    });
    expect(
      parseCli(['--window', '12', '--port', '4000', '--no-open', '--org-name', 'Acme'], {
        SF_INSTANCE_URL: 'https://x.my.salesforce.com',
        SF_ACCESS_TOKEN: 't',
      }),
    ).toMatchObject({ window: 12, port: 4000, open: false, orgName: 'Acme' });
    expect(parseCli(['--help'])).toBe('help');
  });
  it('refuses to start without a token or with an insecure URL', () => {
    expect(() => parseCli([], {})).toThrow(/--instance-url and --access-token are required/);
    expect(() => parseCli(['--instance-url', 'http://x', '--access-token', 't'])).toThrow(/https/);
    expect(() =>
      parseCli(['--instance-url', 'https://x', '--access-token', 't', '--window', '0']),
    ).toThrow(/--window/);
  });
});

describe('FetchConnection', () => {
  it('pages through nextRecordsUrl, routes tooling queries, and never sends the token anywhere else', async () => {
    const calls: { url: string; auth: string | null }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, auth: (init?.headers as Record<string, string>)?.authorization ?? null });
      if (url.endsWith('/services/oauth2/userinfo'))
        return json({ preferred_username: 'admin@acme.com', organization_id: '00D' });
      if (url.includes('/tooling/query'))
        return json({ totalSize: 1, done: true, records: [{ Id: 'T1' }] });
      if (url.includes('/query/01g-2'))
        return json({ totalSize: 3, done: true, records: [{ Id: 'C' }] });
      return json({
        totalSize: 3,
        done: false,
        nextRecordsUrl: '/services/data/v62.0/query/01g-2',
        records: [{ Id: 'A' }, { Id: 'B' }],
      });
    };
    const conn = new FetchConnection({
      instanceUrl: 'https://acme.my.salesforce.com/',
      accessToken: 'secret',
      fetchImpl,
    });
    await conn.identify();
    expect(conn.username).toBe('admin@acme.com');
    expect(conn.orgName).toBe('acme');
    const res = await conn.query('SELECT Id FROM Product2');
    expect(res.totalSize).toBe(3);
    expect(res.records.map((r) => (r as { Id: string }).Id)).toEqual(['A', 'B', 'C']);
    const tooling = await conn.query('SELECT Id FROM ApexTrigger', { tooling: true });
    expect(tooling.records).toEqual([{ Id: 'T1' }]);
    expect(
      calls.every(
        (c) => c.url.startsWith('https://acme.my.salesforce.com/') && c.auth === 'Bearer secret',
      ),
    ).toBe(true);
  });
  it('maps API errors to retryable or not', async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('INVALID'))
        return json(
          [{ errorCode: 'INVALID_TYPE', message: "sObject type 'X' is not supported." }],
          400,
        );
      return new Response('Service Unavailable', { status: 503 });
    };
    const conn = new FetchConnection({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 't',
      fetchImpl,
    });
    await expect(conn.query('SELECT Id FROM INVALID')).rejects.toMatchObject({
      code: 'INVALID_TYPE',
      retryable: false,
    });
    await expect(conn.query('SELECT Id FROM Product2')).rejects.toMatchObject({
      code: 'HTTP_503',
      retryable: true,
    });
  });
});

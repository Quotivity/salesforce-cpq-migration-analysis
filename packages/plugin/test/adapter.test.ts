import { describe, expect, it } from 'vitest';
import { adaptConnection } from '../src/adapter.js';

interface Call {
  soql: string;
  tooling: boolean;
  opts: unknown;
}

function fakeConnection() {
  const calls: Call[] = [];
  const mk = (tooling: boolean) => ({
    query: async (soql: string, opts: unknown) => {
      calls.push({ soql, tooling, opts });
      return { totalSize: 2, done: true, records: [{ Id: 'a' }, { Id: 'b' }] };
    },
  });
  const data = mk(false) as unknown as { query: unknown; tooling: unknown; instanceUrl: string };
  data.tooling = mk(true);
  data.instanceUrl = 'https://acme.my.salesforce.com';
  return { conn: data, calls };
}

describe('adaptConnection', () => {
  it('routes data and tooling queries, auto-fetching every page up to the cap', async () => {
    const { conn, calls } = fakeConnection();
    const adapted = adaptConnection(conn as never, {
      name: 'acme',
      username: 'admin@acme.com',
      orgId: '00D',
    });
    const res = await adapted.query('SELECT Id FROM Product2');
    expect(res).toEqual({ totalSize: 2, records: [{ Id: 'a' }, { Id: 'b' }] });
    await adapted.query('SELECT Id FROM ApexTrigger', { tooling: true });
    expect(calls.map((c) => c.tooling)).toEqual([false, true]);
    expect(calls[0]?.opts).toEqual({ autoFetch: true, maxFetch: 10_001 });
    expect(adapted.instanceUrl).toBe('https://acme.my.salesforce.com');
    expect(adapted.orgName).toBe('acme');
  });
});

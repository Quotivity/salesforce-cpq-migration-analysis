import {
  type OrgConnection,
  type QueryOptions,
  type QueryResult,
  RETRIEVE_CAP,
} from '@quotivity/cpq-inventory-core';
import type { Connection } from '@salesforce/core';

/** Wraps the CLI's authenticated connection. The credential never leaves the CLI's object. */
export function adaptConnection(
  conn: Connection,
  org: { name: string; username: string; orgId: string },
): OrgConnection {
  return {
    instanceUrl: conn.instanceUrl,
    username: org.username,
    orgId: org.orgId,
    orgName: org.name,
    async query<T extends object = Record<string, unknown>>(
      soql: string,
      opts?: QueryOptions,
    ): Promise<QueryResult<T>> {
      const target = opts?.tooling ? conn.tooling : conn;
      const res = await target.query<T>(soql, { autoFetch: true, maxFetch: RETRIEVE_CAP + 1 });
      return { totalSize: res.totalSize, records: res.records };
    },
  };
}

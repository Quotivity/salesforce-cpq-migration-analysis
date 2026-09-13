import {
  ConnectionError,
  type OrgConnection,
  type QueryOptions,
  type QueryResult,
} from '@quotivity/cpq-inventory-core';

export const API_VERSION = 'v62.0';

export interface FetchConnectionOptions {
  instanceUrl: string;
  accessToken: string;
  orgName?: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

interface RawQueryResult {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: Record<string, unknown>[];
}

/**
 * OrgConnection over the REST API with a supplied access token. The token lives in this object for
 * the run only: never logged, never written. Every request is a read (GET).
 */
export class FetchConnection implements OrgConnection {
  readonly instanceUrl: string;
  username = 'unknown user';
  orgId = '';
  readonly orgName: string;
  private readonly token: string;
  private readonly api: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: FetchConnectionOptions) {
    this.instanceUrl = opts.instanceUrl.replace(/\/+$/, '');
    this.token = opts.accessToken;
    this.api = opts.apiVersion ?? API_VERSION;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.orgName = opts.orgName ?? new URL(this.instanceUrl).hostname.split('.')[0] ?? 'org';
  }

  /** Resolves the user and org behind the token. Fails fast on a bad token. */
  async identify(): Promise<void> {
    const res = await this.fetchImpl(`${this.instanceUrl}/services/oauth2/userinfo`, {
      headers: this.headers(),
    });
    if (!res.ok)
      throw new ConnectionError(
        `could not verify the access token (HTTP ${res.status})`,
        'INVALID_LOGIN',
        false,
      );
    const info = (await res.json()) as { preferred_username?: string; organization_id?: string };
    this.username = info.preferred_username ?? this.username;
    this.orgId = info.organization_id ?? this.orgId;
  }

  async query<T extends object = Record<string, unknown>>(
    soql: string,
    opts?: QueryOptions,
  ): Promise<QueryResult<T>> {
    const base = `${this.instanceUrl}/services/data/${this.api}${opts?.tooling ? '/tooling' : ''}`;
    let url = `${base}/query?q=${encodeURIComponent(soql)}`;
    const records: Record<string, unknown>[] = [];
    let totalSize = 0;
    for (;;) {
      const page = await this.get<RawQueryResult>(url);
      totalSize = page.totalSize;
      records.push(...page.records);
      if (page.done || !page.nextRecordsUrl) break;
      url = `${this.instanceUrl}${page.nextRecordsUrl}`;
    }
    return { totalSize, records: records as T[] };
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.token}`, accept: 'application/json' };
  }

  private async get<T>(url: string): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers: this.headers() });
    } catch (err) {
      throw new ConnectionError(
        `network error: ${err instanceof Error ? err.message : String(err)}`,
        'NETWORK',
        true,
      );
    }
    if (res.ok) return (await res.json()) as T;
    const text = await res.text();
    let code: string | undefined;
    let message = text;
    try {
      const body = JSON.parse(text) as { errorCode?: string; message?: string }[];
      code = body[0]?.errorCode;
      message = body[0]?.message ?? text;
    } catch {
      /* not JSON */
    }
    const retryable = res.status >= 500 || res.status === 429 || res.status === 408;
    throw new ConnectionError(
      `${code ?? `HTTP ${res.status}`}: ${message}`,
      code ?? `HTTP_${res.status}`,
      retryable,
    );
  }
}

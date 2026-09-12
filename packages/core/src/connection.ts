/**
 * The connection contract both distributions implement. The plugin adapts the Salesforce CLI's
 * connection; the standalone script implements it over fetch. Core never sees a credential.
 */
export interface QueryResult<T> {
  /** Total matching records as reported by the API (exact, independent of what was retrieved). */
  totalSize: number;
  /** Every page of records, unless the SOQL carried a LIMIT. */
  records: T[];
}

export interface QueryOptions {
  /** Run against the Tooling API instead of the data API. */
  tooling?: boolean;
}

export interface OrgConnection {
  readonly instanceUrl: string;
  readonly username: string;
  readonly orgId: string;
  /** Alias or display name for the org, used in the report header and the PDF filename. */
  readonly orgName: string;
  query<T extends object = Record<string, unknown>>(
    soql: string,
    opts?: QueryOptions,
  ): Promise<QueryResult<T>>;
}

export class ConnectionError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

const NON_RETRYABLE =
  /INVALID_TYPE|INVALID_FIELD|MALFORMED_QUERY|INVALID_QUERY_FILTER_OPERATOR|NO_SUCH_COLUMN|INVALID_LOGIN|INSUFFICIENT_ACCESS|FIELD_NOT_FOUND|sObject type .* is not supported|No such column/i;

export function isMissingObjectError(err: unknown): boolean {
  const text = errorText(err);
  return /INVALID_TYPE|sObject type .* is not supported|Object type .* is not supported/i.test(
    text,
  );
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof ConnectionError) return err.retryable;
  return !NON_RETRYABLE.test(errorText(err));
}

export function errorText(err: unknown): string {
  if (err instanceof Error) {
    const withCode = err as Error & { errorCode?: string; code?: string };
    return [withCode.errorCode, withCode.code, err.message].filter(Boolean).join(' ');
  }
  return String(err);
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Every request is a read, so every request is retryable. Three attempts with backoff; a
 * non-retryable API error (bad object, bad field) fails immediately so the caller can mark the
 * object absent rather than looping.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 500;
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === attempts - 1) throw err;
      await sleep(base * 2 ** i);
    }
  }
  throw lastErr;
}

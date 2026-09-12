import type { OrgConnection, QueryOptions, QueryResult } from '../../src/connection.js';

export type Row = Record<string, unknown> & { Id?: string };
export type Store = Record<string, Row[]>;

/**
 * A small SOQL emulator sufficient for the extractor's queries: COUNT(), field projection with
 * relationship paths, WHERE with AND-ed simple predicates, GROUP BY aggregates, COUNT_DISTINCT,
 * ORDER BY and LIMIT. Unknown objects raise the INVALID_TYPE error a real org would.
 */
export class EmulatedConnection implements OrgConnection {
  readonly instanceUrl = 'https://acme.my.salesforce.com';
  readonly username = 'admin@acme.com';
  readonly orgId = '00D000000000001AAA';
  readonly orgName = 'acme-prod';
  readonly queries: string[] = [];
  private readonly byId = new Map<string, Row>();
  /** Objects that throw a transport error on every call, to exercise the unread path. */
  failing = new Set<string>();

  constructor(private readonly store: Store) {
    for (const rows of Object.values(store))
      for (const r of rows) if (r.Id) this.byId.set(String(r.Id), r);
  }

  async query<T extends object = Record<string, unknown>>(
    soql: string,
    _opts?: QueryOptions,
  ): Promise<QueryResult<T>> {
    this.queries.push(soql);
    const m =
      /^\s*SELECT\s+(.+?)\s+FROM\s+([A-Za-z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+GROUP\s+BY\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?\s*$/is.exec(
        soql,
      );
    if (!m) throw new Error(`MALFORMED_QUERY: ${soql}`);
    const [, select, object, where, groupBy, orderBy, limit] = m as unknown as [
      string,
      string,
      string,
      string?,
      string?,
      string?,
      string?,
    ];
    if (this.failing.has(object))
      throw new Error(`UNKNOWN_EXCEPTION: transport failure reading ${object}`);
    const rows = this.store[object];
    if (!rows) throw new Error(`INVALID_TYPE: sObject type '${object}' is not supported.`);
    let matched = where ? rows.filter((r) => this.evalWhere(r, where)) : [...rows];
    if (orderBy) {
      const keys = orderBy.split(',').map((k) => k.trim().split(/\s+/)[0] as string);
      matched.sort((a, b) => {
        for (const k of keys) {
          const av = this.resolve(a, k);
          const bv = this.resolve(b, k);
          if (av === bv) continue;
          if (av == null) return -1;
          if (bv == null) return 1;
          return av < bv ? -1 : 1;
        }
        return 0;
      });
    }
    const sel = select.trim();
    if (/^COUNT\(\)$/i.test(sel)) return { totalSize: matched.length, records: [] };
    if (groupBy) {
      const cols = sel.split(',').map((c) => c.trim());
      const groups = new Map<string, Row[]>();
      const groupExprs = groupBy.split(',').map((g) => g.trim());
      for (const r of matched) {
        const key = JSON.stringify(groupExprs.map((g) => this.evalExpr(r, g)));
        const list = groups.get(key) ?? [];
        list.push(r);
        groups.set(key, list);
      }
      const out: Row[] = [];
      for (const list of groups.values()) {
        const first = list[0] as Row;
        const row: Row = {};
        for (const c of cols) {
          const [expr, alias] = splitAlias(c);
          const cnt = /^COUNT\((\w+)\)$/i.exec(expr);
          row[alias] = cnt ? list.length : this.evalExpr(first, expr);
        }
        out.push(row);
      }
      return { totalSize: out.length, records: out as T[] };
    }
    const distinct = /^COUNT_DISTINCT\(([\w.]+)\)\s+(\w+)$/i.exec(sel);
    if (distinct) {
      const values = new Set(
        matched.map((r) => this.resolve(r, distinct[1] as string)).filter((v) => v != null),
      );
      return { totalSize: 1, records: [{ [distinct[2] as string]: values.size }] as T[] };
    }
    if (limit) matched = matched.slice(0, Number(limit));
    const fields = sel.split(',').map((f) => f.trim());
    const records = matched.map((r) => {
      const out: Row = {};
      for (const f of fields) {
        if (f.includes('.')) {
          const [head, ...rest] = f.split('.') as [string, ...string[]];
          const nested = (out[head] as Row | undefined) ?? {};
          nested[rest.join('.')] = this.resolve(r, f);
          out[head] = nested;
        } else out[f] = r[f] ?? null;
      }
      return out;
    });
    return { totalSize: where ? matched.length : rows.length, records: records as T[] };
  }

  private evalExpr(r: Row, expr: string): unknown {
    const year = /^CALENDAR_YEAR\(([\w.]+)\)$/i.exec(expr);
    if (year) {
      const v = this.resolve(r, year[1] as string);
      return v ? Number(String(v).slice(0, 4)) : null;
    }
    return this.resolve(r, expr);
  }

  private resolve(r: Row, path: string): unknown {
    const parts = path.split('.');
    let cur: unknown = r;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return null;
      const obj = cur as Row;
      if (p in obj) cur = obj[p];
      else if (p.endsWith('__r'))
        cur = this.byId.get(String(obj[`${p.slice(0, -3)}__c`] ?? '')) ?? null;
      else if (p === 'ProcessDefinition')
        cur = this.byId.get(String(obj.ProcessDefinitionId ?? '')) ?? null;
      else if (p === 'EntityDefinition') cur = { QualifiedApiName: obj.EntityDefinitionId ?? null };
      else return null;
    }
    return cur ?? null;
  }

  private evalWhere(r: Row, where: string): boolean {
    const parts = splitTopLevel(where, /\s+AND\s+/i);
    return parts.every((p) => this.evalPredicate(r, p.trim()));
  }

  private evalPredicate(r: Row, pred: string): boolean {
    const m = /^([\w.]+)\s*(!=|>=|<=|=|>|<|IN|LIKE)\s*(.+)$/is.exec(pred);
    if (!m) throw new Error(`MALFORMED_QUERY: predicate ${pred}`);
    const [, path, opRaw, rhs] = m as unknown as [string, string, string, string];
    const op = opRaw.toUpperCase();
    const left = this.resolve(r, path);
    if (op === 'IN') {
      const list = rhs
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((v) => literal(v.trim()));
      return list.includes(left as never);
    }
    const right = literal(rhs.trim());
    if (op === 'LIKE')
      return (
        typeof left === 'string' &&
        new RegExp(`^${String(right).replace(/%/g, '.*')}$`, 'i').test(left)
      );
    if (op === '=') return right === null ? left == null : left === right;
    if (op === '!=') return right === null ? left != null : left !== right;
    if (left == null) return false;
    const l = comparable(left);
    const rv = comparable(right);
    if (op === '>=') return l >= rv;
    if (op === '<=') return l <= rv;
    if (op === '>') return l > rv;
    return l < rv;
  }
}

function comparable(v: unknown): string | number {
  if (typeof v === 'number') return v;
  return String(v);
}

function literal(v: string): unknown {
  if (/^true$/i.test(v)) return true;
  if (/^false$/i.test(v)) return false;
  if (/^null$/i.test(v)) return null;
  if (/^'.*'$/s.test(v)) return v.slice(1, -1).replace(/\\'/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v; // date / datetime literal, compared as ISO strings
}

function splitAlias(col: string): [string, string] {
  const m = /^(.+?)\s+(\w+)$/.exec(col);
  if (m && !/^COUNT\(\)$/i.test(col)) return [m[1] as string, m[2] as string];
  return [col, col];
}

function splitTopLevel(text: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (ch === "'" && text[i - 1] !== '\\') inStr = !inStr;
    if (!inStr) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
    }
    cur += ch;
    if (!inStr && depth === 0) {
      const m = sep.exec(cur);
      if (m && m.index + m[0].length === cur.length) {
        out.push(cur.slice(0, m.index));
        cur = '';
      }
    }
  }
  out.push(cur);
  return out;
}

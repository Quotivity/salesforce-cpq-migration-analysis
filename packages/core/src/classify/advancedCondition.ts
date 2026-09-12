/**
 * Parser for `SBQQ__AdvancedCondition__c`: a boolean expression over condition indexes, e.g.
 * `(1 AND 2) OR 3`. Verified grammar: AND and OR with parentheses, nesting to any depth, an index
 * may appear more than once; NOT is rejected outright by CPQ.
 */
export type ConditionExpr =
  | { kind: 'index'; index: number }
  | { kind: 'and'; terms: ConditionExpr[] }
  | { kind: 'or'; terms: ConditionExpr[] };

export interface ParsedCondition {
  expr: ConditionExpr;
  indexes: number[];
  /** Disjunctive normal form: a list of AND-groups, any one of which satisfies the rule. */
  dnf: number[][];
}

export class AdvancedConditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvancedConditionError';
  }
}

type Token = { t: 'num'; v: number } | { t: 'and' } | { t: 'or' } | { t: '(' } | { t: ')' };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(\d+|AND|OR|NOT|\(|\))\s*/giy;
  let pos = 0;
  while (pos < src.length) {
    re.lastIndex = pos;
    const m = re.exec(src);
    if (!m || m.index !== pos)
      throw new AdvancedConditionError(
        `unexpected text at position ${pos}: "${src.slice(pos, pos + 12)}"`,
      );
    const raw = (m[1] as string).toUpperCase();
    if (raw === 'NOT')
      throw new AdvancedConditionError(
        'Only the following logical operators are accepted: AND, OR.',
      );
    if (raw === 'AND') tokens.push({ t: 'and' });
    else if (raw === 'OR') tokens.push({ t: 'or' });
    else if (raw === '(') tokens.push({ t: '(' });
    else if (raw === ')') tokens.push({ t: ')' });
    else tokens.push({ t: 'num', v: Number(raw) });
    pos = re.lastIndex;
  }
  return tokens;
}

export function parseAdvancedCondition(src: string | null | undefined): ParsedCondition {
  const text = (src ?? '').trim();
  if (!text) throw new AdvancedConditionError('empty expression');
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];

  function primary(): ConditionExpr {
    const tok = next();
    if (!tok) throw new AdvancedConditionError('unexpected end of expression');
    if (tok.t === 'num') return { kind: 'index', index: tok.v };
    if (tok.t === '(') {
      const inner = orExpr();
      const close = next();
      if (close?.t !== ')') throw new AdvancedConditionError('missing closing parenthesis');
      return inner;
    }
    throw new AdvancedConditionError(`unexpected token ${tok.t}`);
  }
  function andExpr(): ConditionExpr {
    const terms = [primary()];
    while (peek()?.t === 'and') {
      next();
      terms.push(primary());
    }
    return terms.length === 1 ? (terms[0] as ConditionExpr) : { kind: 'and', terms };
  }
  function orExpr(): ConditionExpr {
    const terms = [andExpr()];
    while (peek()?.t === 'or') {
      next();
      terms.push(andExpr());
    }
    return terms.length === 1 ? (terms[0] as ConditionExpr) : { kind: 'or', terms };
  }

  const expr = orExpr();
  if (i < tokens.length) throw new AdvancedConditionError('unexpected trailing tokens');
  const indexes = [...new Set(collect(expr))].sort((a, b) => a - b);
  return { expr, indexes, dnf: toDnf(expr) };
}

function collect(e: ConditionExpr): number[] {
  if (e.kind === 'index') return [e.index];
  return e.terms.flatMap(collect);
}

export function toDnf(e: ConditionExpr): number[][] {
  if (e.kind === 'index') return [[e.index]];
  if (e.kind === 'or') return e.terms.flatMap(toDnf);
  // AND: cartesian product of the children's DNF groups
  let groups: number[][] = [[]];
  for (const term of e.terms) {
    const sub = toDnf(term);
    const nextGroups: number[][] = [];
    for (const g of groups)
      for (const s of sub) nextGroups.push([...new Set([...g, ...s])].sort((a, b) => a - b));
    groups = nextGroups;
  }
  return groups;
}

/** Validates the expression against the indexes actually present on the rule's conditions. */
export function validateAgainstIndexes(
  src: string | null | undefined,
  present: number[],
): { ok: boolean; missing: number[]; error?: string; parsed?: ParsedCondition } {
  try {
    const parsed = parseAdvancedCondition(src);
    const have = new Set(present);
    const missing = parsed.indexes.filter((n) => !have.has(n));
    return { ok: missing.length === 0, missing, parsed };
  } catch (err) {
    return { ok: false, missing: [], error: err instanceof Error ? err.message : String(err) };
  }
}

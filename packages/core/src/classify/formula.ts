/**
 * Calculated-pricing formula grammar check. The report names the specific limit a formula breaches
 * rather than saying "outside the grammar".
 */
export const SUPPORTED_FUNCTIONS = [
  'IF',
  'CASE',
  'AND',
  'OR',
  'NOT',
  'ISBLANK',
  'BLANKVALUE',
  'MIN',
  'MAX',
] as const;
export const AND_OR_MIN_ARGS = 2;
export const AND_OR_MAX_ARGS = 5;
export const MAX_NESTING = 10;
export const MAX_LENGTH = 3_900;
export const MAX_IF_COUNT = 20;

export interface FormulaCheck {
  ok: boolean;
  breaches: string[];
  functions: string[];
}

interface Call {
  name: string;
  args: number;
  depth: number;
}

/** Parses function calls, counting arguments at the top level of each call. */
export function parseCalls(formula: string): {
  calls: Call[];
  maxDepth: number;
  balanced: boolean;
} {
  const calls: Call[] = [];
  const stack: { name: string; args: number; hasContent: boolean }[] = [];
  let depth = 0;
  let maxDepth = 0;
  let i = 0;
  let inString: string | null = null;
  while (i < formula.length) {
    const ch = formula[i] as string;
    if (inString) {
      if (ch === '\\') i += 1;
      else if (ch === inString) inString = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      const top = stack[stack.length - 1];
      if (top) top.hasContent = true;
      i += 1;
      continue;
    }
    const ident = /^[A-Za-z_][A-Za-z0-9_]*/.exec(formula.slice(i));
    if (ident && /^\s*\(/.test(formula.slice(i + ident[0].length))) {
      const name = ident[0].toUpperCase();
      const parenAt = formula.indexOf('(', i + ident[0].length);
      const top = stack[stack.length - 1];
      if (top) top.hasContent = true;
      stack.push({ name, args: 0, hasContent: false });
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
      i = parenAt + 1;
      continue;
    }
    if (ident) {
      const top = stack[stack.length - 1];
      if (top) top.hasContent = true;
      i += ident[0].length;
      continue;
    }
    if (ch === '(') {
      stack.push({ name: '(', args: 0, hasContent: false });
      depth += 1;
      maxDepth = Math.max(maxDepth, depth);
    } else if (ch === ')') {
      const top = stack.pop();
      depth = Math.max(0, depth - 1);
      if (top && top.name !== '(') {
        calls.push({ name: top.name, args: top.hasContent ? top.args + 1 : 0, depth });
      }
      const parent = stack[stack.length - 1];
      if (parent) parent.hasContent = true;
    } else if (ch === ',') {
      const top = stack[stack.length - 1];
      if (top && top.name !== '(') top.args += 1;
    } else if (!/\s/.test(ch)) {
      const top = stack[stack.length - 1];
      if (top) top.hasContent = true;
    }
    i += 1;
  }
  return { calls, maxDepth, balanced: stack.length === 0 && !inString };
}

export function checkFormula(formula: string | null | undefined): FormulaCheck {
  const text = (formula ?? '').trim();
  const breaches: string[] = [];
  if (!text) return { ok: true, breaches, functions: [] };
  const { calls, maxDepth, balanced } = parseCalls(text);
  const functions = [...new Set(calls.map((c) => c.name))];
  if (!balanced) breaches.push('unbalanced parentheses or quotes');
  if (text.length > MAX_LENGTH)
    breaches.push(`${text.length} characters, over the ${MAX_LENGTH}-character limit`);
  if (maxDepth > MAX_NESTING)
    breaches.push(`nested ${maxDepth} levels deep, over the limit of ${MAX_NESTING}`);
  const ifs = calls.filter((c) => c.name === 'IF').length;
  if (ifs > MAX_IF_COUNT) breaches.push(`${ifs} IF calls, over the limit of ${MAX_IF_COUNT}`);
  const supported = new Set<string>(SUPPORTED_FUNCTIONS);
  for (const fn of functions) {
    if (!supported.has(fn)) breaches.push(`${fn}() is not in the calculated pricing grammar`);
  }
  for (const c of calls) {
    if (
      (c.name === 'AND' || c.name === 'OR') &&
      (c.args < AND_OR_MIN_ARGS || c.args > AND_OR_MAX_ARGS)
    ) {
      breaches.push(
        `${c.name}() takes ${AND_OR_MIN_ARGS} to ${AND_OR_MAX_ARGS} arguments; this one has ${c.args}`,
      );
    }
  }
  return { ok: breaches.length === 0, breaches: [...new Set(breaches)], functions };
}

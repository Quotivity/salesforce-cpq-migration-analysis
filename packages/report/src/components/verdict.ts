import type { Verdict } from '@quotivity/cpq-inventory-core';

export const verdictClass = (v: Verdict): string =>
  v === 'Clear path'
    ? 'v-clear'
    : v === 'Partial path'
      ? 'v-degraded'
      : v === 'No path'
        ? 'v-notarget'
        : 'v-review';

export const verdictAccent = (v: Verdict): string =>
  v === 'Clear path'
    ? '#07AE77'
    : v === 'Partial path'
      ? '#D97230'
      : v === 'No path'
        ? '#C0392B'
        : '#3E8DC4';

export const verdictFg = (v: Verdict): string =>
  v === 'Clear path'
    ? '#047251'
    : v === 'Partial path'
      ? '#A9611C'
      : v === 'No path'
        ? '#B23A2E'
        : '#1F6FA8';

export const fmt = (n: number): string => n.toLocaleString('en-US');

/** Verdict scale from the spec. "Further review" is not a verdict but travels in the same field. */
export type Verdict = 'Clear path' | 'Partial path' | 'No path' | 'Further review';
export type Shape = '1:1' | 'Fan-out' | 'Rebuild';
export type ReviewReason = 'Unread' | 'Intent';

export type BucketId =
  | 'catalog'
  | 'configuration'
  | 'discovery'
  | 'price'
  | 'discounting'
  | 'guardrails'
  | 'approvals'
  | 'output'
  | 'lifecycle'
  | 'code';

export interface BucketDef {
  id: BucketId;
  name: string;
  question: string;
  phase: PhaseId;
}

export type PhaseId = 'before' | 'quote' | 'after' | 'outside';

export interface PhaseDef {
  id: PhaseId;
  name: string;
  note: string;
  buckets: BucketId[];
}

export const BUCKETS: readonly BucketDef[] = [
  {
    id: 'catalog',
    name: 'Catalog',
    question: 'What do we sell, and in which currencies?',
    phase: 'before',
  },
  {
    id: 'configuration',
    name: 'Configuration',
    question: 'What can be sold together, and what does the rep choose?',
    phase: 'before',
  },
  {
    id: 'discovery',
    name: 'Discovery & capture',
    question: 'What do we ask before or while quoting?',
    phase: 'before',
  },
  {
    id: 'price',
    name: 'Price determination',
    question: 'How does a price get to the line?',
    phase: 'quote',
  },
  {
    id: 'discounting',
    name: 'Discounting',
    question: 'Who gets off list, and by how much?',
    phase: 'quote',
  },
  { id: 'guardrails', name: 'Guardrails', question: 'What can a rep not do?', phase: 'quote' },
  {
    id: 'approvals',
    name: 'Approvals',
    question: 'Who has to sign off, and in what order?',
    phase: 'quote',
  },
  {
    id: 'output',
    name: 'Quote output',
    question: 'What does the customer actually receive?',
    phase: 'quote',
  },
  {
    id: 'lifecycle',
    name: 'Contract lifecycle',
    question: 'What happens to the deal after it is won?',
    phase: 'after',
  },
  {
    id: 'code',
    name: 'Custom code & UI',
    question: 'What has been customised on top of the CPQ objects?',
    phase: 'outside',
  },
];

export const PHASES: readonly PhaseDef[] = [
  {
    id: 'before',
    name: 'Before the quote',
    note: 'What exists before a rep opens one',
    buckets: ['catalog', 'configuration', 'discovery'],
  },
  {
    id: 'quote',
    name: 'The quote',
    note: 'What happens while one is built',
    buckets: ['price', 'discounting', 'guardrails', 'approvals', 'output'],
  },
  { id: 'after', name: 'After signature', note: 'What the deal becomes', buckets: ['lifecycle'] },
  {
    id: 'outside',
    name: 'Outside the configuration',
    note: 'Built on top of the CPQ objects',
    buckets: ['code'],
  },
];

export function bucketDef(id: BucketId): BucketDef {
  const def = BUCKETS.find((b) => b.id === id);
  if (!def) throw new Error(`unknown bucket ${id}`);
  return def;
}

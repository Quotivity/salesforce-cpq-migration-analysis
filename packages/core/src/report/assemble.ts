import type { Classification, Listing } from '../classify/index.js';
import { MECHANISM_BUCKETS, type RowId, RULE_ROWS, ruleRow } from '../classify/rules.js';
import { outboundConfig, SOURCE_URL } from '../config/outbound.js';
import type { Extraction } from '../extract/index.js';
import { MAPPING_ROWS, SHAPE_MEANINGS, VERDICT_MEANINGS } from '../mapping.js';
import { bucketNote, summaryLines } from '../summary.js';
import { BUCKETS, type BucketId, bucketDef, PHASES, type Shape, type Verdict } from '../types.js';
import type {
  MappingRow,
  Prerequisite,
  ReportBucket,
  ReportData,
  ReportRow,
  ReviewRow,
  ShapeLegendEntry,
  VerdictTile,
} from './types.js';

export interface AssembleOptions {
  version: string;
  runId: string;
  org: { name: string; username: string; instanceUrl: string; orgId: string };
  now?: Date;
}

interface RowTally {
  count: number;
  alive: number;
  names: string[];
  details: string[];
  /** Primary buckets of the records shown here, for cross-reference markers. */
  primaryBuckets: Map<BucketId, number>;
  primary: boolean;
}

const ATTENTION: ReadonlySet<Verdict> = new Set(['Partial path', 'No path']);

/** Objects that feed each bucket, for unread and bulk-touch reporting. */
const OBJECT_BUCKETS: Record<string, BucketId[]> = {
  Product2: ['catalog', 'price', 'guardrails'],
  Pricebook2: ['catalog'],
  CurrencyType: ['catalog'],
  DatedConversionRate: ['catalog'],
  SBQQ__ProductFeature__c: ['configuration'],
  SBQQ__ProductOption__c: ['configuration'],
  SBQQ__OptionConstraint__c: ['configuration'],
  SBQQ__ConfigurationRule__c: ['configuration'],
  SBQQ__ConfigurationAttribute__c: ['discovery', 'configuration'],
  SBQQ__ProductRule__c: ['configuration', 'guardrails'],
  SBQQ__ErrorCondition__c: ['guardrails'],
  SBQQ__ProductAction__c: ['configuration'],
  SBQQ__QuoteProcess__c: ['discovery'],
  SBQQ__ProcessInput__c: ['discovery'],
  SBQQ__PriceRule__c: ['price', 'discounting', 'discovery', 'guardrails'],
  SBQQ__PriceCondition__c: ['price'],
  SBQQ__PriceAction__c: ['price'],
  SBQQ__SummaryVariable__c: ['price'],
  SBQQ__LookupQuery__c: ['configuration', 'price'],
  SBQQ__BlockPrice__c: ['price'],
  SBQQ__Dimension__c: ['price'],
  SBQQ__DiscountSchedule__c: ['discounting'],
  SBQQ__DiscountTier__c: ['discounting'],
  SBQQ__ContractedPrice__c: ['discounting'],
  ValidationRule: ['guardrails', 'code'],
  sbaa__ApprovalRule__c: ['approvals'],
  sbaa__ApprovalCondition__c: ['approvals'],
  sbaa__ApprovalChain__c: ['approvals'],
  sbaa__Approver__c: ['approvals'],
  sbaa__ApprovalVariable__c: ['approvals'],
  sbaa__TrackedField__c: ['approvals'],
  sbaa__Approval__c: ['approvals'],
  ProcessDefinition: ['approvals'],
  ProcessInstance: ['approvals'],
  SBQQ__QuoteTemplate__c: ['output'],
  SBQQ__TemplateSection__c: ['output'],
  SBQQ__TemplateContent__c: ['output'],
  SBQQ__LineColumn__c: ['output'],
  SBQQ__QuoteTerm__c: ['output'],
  SBQQ__TermCondition__c: ['output'],
  SBQQ__QuoteLineGroup__c: ['output'],
  Contract: ['lifecycle'],
  SBQQ__Subscription__c: ['lifecycle'],
  SBQQ__Quote__c: ['lifecycle'],
  SBQQ__CustomScript__c: ['code'],
  SBQQ__CustomAction__c: ['code'],
  ApexTrigger: ['code'],
  WebLink: ['code'],
  Layout: ['code'],
  FlexiPage: ['code'],
  FieldDefinition: ['code'],
};

export function assembleReport(
  ex: Extraction,
  cl: Classification,
  opts: AssembleOptions,
): ReportData {
  const now = opts.now ?? new Date();
  const key = (l: Listing) => `${l.bucket}|${l.rowId}`;
  const tallies = new Map<string, RowTally>();
  const get = (l: Listing): RowTally => {
    const k = key(l);
    let t = tallies.get(k);
    if (!t) {
      t = { count: 0, alive: 0, names: [], details: [], primaryBuckets: new Map(), primary: false };
      tallies.set(k, t);
    }
    return t;
  };
  const primaryCount = new Map<BucketId, number>();
  const primaryAlive = new Map<BucketId, number>();
  const primaryAttention = new Map<BucketId, number>();
  const primaryReview = new Map<BucketId, number>();
  const bump = (m: Map<BucketId, number>, b: BucketId, by = 1) => m.set(b, (m.get(b) ?? 0) + by);
  const objectBuckets = new Map<string, Set<BucketId>>();

  for (const rec of cl.records) {
    const p = get(rec.primary);
    p.count += 1;
    if (rec.alive) p.alive += 1;
    p.names.push(rec.name);
    p.details.push(...rec.details);
    p.primaryBuckets.set(rec.primary.bucket, (p.primaryBuckets.get(rec.primary.bucket) ?? 0) + 1);
    p.primary = true;
    bump(primaryCount, rec.primary.bucket);
    if (rec.alive) bump(primaryAlive, rec.primary.bucket);
    const verdict = ruleRow(rec.primary.rowId).verdict;
    if (ATTENTION.has(verdict)) bump(primaryAttention, rec.primary.bucket);
    if (verdict === 'Further review') bump(primaryReview, rec.primary.bucket);
    const set = objectBuckets.get(rec.object) ?? new Set<BucketId>();
    set.add(rec.primary.bucket);
    objectBuckets.set(rec.object, set);
    for (const s of rec.secondary) {
      const t = get(s);
      t.count += 1;
      if (rec.alive) t.alive += 1;
      t.names.push(rec.name);
      t.primaryBuckets.set(rec.primary.bucket, (t.primaryBuckets.get(rec.primary.bucket) ?? 0) + 1);
      set.add(s.bucket);
    }
  }
  for (const t of cl.tallies) {
    const r = get({ rowId: t.rowId, bucket: t.bucket });
    r.count += t.count;
    r.alive += t.alive;
    r.details.push(...(t.details ?? []));
    r.primary = true;
    r.primaryBuckets.set(t.bucket, (r.primaryBuckets.get(t.bucket) ?? 0) + t.count);
    bump(primaryCount, t.bucket, t.count);
    bump(primaryAlive, t.bucket, t.alive);
    const verdict = ruleRow(t.rowId).verdict;
    if (ATTENTION.has(verdict)) bump(primaryAttention, t.bucket, t.count);
    if (verdict === 'Further review') bump(primaryReview, t.bucket, t.count);
  }

  /** Records carrying the row, counted once each even when cross-listed, plus count-only tallies. */
  const rowCountAll = (rowId: string): number => {
    let total = 0;
    for (const rec of cl.records)
      if (rec.primary.rowId === rowId || rec.secondary.some((s) => s.rowId === rowId)) total += 1;
    for (const t of cl.tallies) if (t.rowId === rowId) total += t.count;
    return total;
  };

  const buckets: ReportBucket[] = [];
  for (const def of BUCKETS) {
    const rows: ReportRow[] = [];
    for (const rule of RULE_ROWS) {
      const t = tallies.get(`${def.id}|${rule.id}`);
      const staticHere = rule.bucket === def.id;
      if (!t && !staticHere) continue;
      const count = t?.count ?? 0;
      let crossListed: ReportRow['crossListed'];
      if (t && !t.primary) {
        let best: BucketId | null = null;
        let bestN = -1;
        for (const [b, n] of t.primaryBuckets) if (n > bestN) [best, bestN] = [b, n];
        if (best && best !== def.id)
          crossListed = { countedIn: best, countedInName: bucketDef(best).name };
        else if (best)
          crossListed = {
            countedIn: best,
            countedInName: `its own row in ${bucketDef(best).name}`,
          };
      } else if (t && rule.crossBucket === def.id && rule.bucket !== def.id) {
        crossListed = {
          countedIn: rule.bucket as BucketId,
          countedInName: bucketDef(rule.bucket as BucketId).name,
        };
      }
      rows.push({
        rowId: rule.id,
        label: rule.label,
        count,
        unit: rule.unit,
        alive: t?.alive ?? 0,
        lands: rule.lands,
        verdict: rule.verdict,
        shape: rule.shape,
        review: rule.review,
        crossListed,
        names: (t?.names ?? []).slice(0, 200),
        details: [...new Set(t?.details ?? [])].slice(0, 50),
      });
    }

    const mechanisms = MECHANISM_BUCKETS.has(def.id);
    const nonEmpty = rows.filter((r) => r.count > 0);
    const objects = [...objectBuckets].filter(([, b]) => b.has(def.id)).map(([o]) => o);
    const partial = cl.objects.some(
      (o) =>
        o.partial && (objects.includes(o.object) || OBJECT_BUCKETS[o.object]?.includes(def.id)),
    );
    const beyondCap = cl.objects
      .filter((o) => o.partial && objects.includes(o.object))
      .reduce((a, o) => a + Math.max(0, o.count - o.retrieved), 0);
    const aliveUnreliable = cl.objects
      .filter(
        (o) =>
          o.bulkTouch && (objects.includes(o.object) || OBJECT_BUCKETS[o.object]?.includes(def.id)),
      )
      .map((o) => ({ object: o.object, date: o.bulkTouch?.date ?? '' }));
    const unread = ex.unread
      .filter((u) => OBJECT_BUCKETS[u.object]?.includes(def.id))
      .map((u) => u.object);

    let exists: number;
    let alive: number | null;
    let needsAttention: number;
    let review: number | undefined;
    if (mechanisms) {
      exists = nonEmpty.length;
      alive = nonEmpty.filter((r) => r.alive > 0).length;
      needsAttention = nonEmpty.filter((r) => ATTENTION.has(r.verdict)).length;
      const rv = nonEmpty.filter((r) => r.verdict === 'Further review').length;
      review = rv > 0 ? rv : undefined;
    } else {
      exists = (primaryCount.get(def.id) ?? 0) + beyondCap;
      alive = def.id === 'code' ? null : (primaryAlive.get(def.id) ?? 0);
      needsAttention = primaryAttention.get(def.id) ?? 0;
      const rv = primaryReview.get(def.id) ?? 0;
      review = rv > 0 ? rv : undefined;
    }
    const input = {
      ex,
      cl,
      rowCount: rowCountAll,
      bucketAlive: (id: BucketId) => (id === 'code' ? null : (primaryAlive.get(id) ?? 0)),
      mechanisms: nonEmpty.length,
    };
    buckets.push({
      id: def.id,
      name: def.name,
      question: def.question,
      phase: def.phase,
      exists,
      alive,
      aliveUnreliable,
      needsAttention,
      review,
      countsMechanisms: mechanisms,
      summary: summaryLines(def.id, input),
      rows,
      note: bucketNote(def.id, input),
      partial,
      unread,
    });
  }

  // ── Stage 2 ─────────────────────────────────────────────────────────────
  const mappingCounts = new Map<string, number>();
  for (const rule of RULE_ROWS)
    mappingCounts.set(rule.mapping, (mappingCounts.get(rule.mapping) ?? 0) + rowCountAll(rule.id));
  const mapping: MappingRow[] = MAPPING_ROWS.map((m) => ({
    id: m.id,
    bucket: m.bucket,
    bucketName: bucketDef(m.bucket).name,
    from: m.from,
    to: m.to,
    verdict: m.verdict,
    shape: m.shape,
    count: mappingCounts.get(m.id) ?? 0,
  }));
  const verdicted = mapping.filter((m) => m.verdict !== 'Further review').length;
  const verdictScale: VerdictTile[] = (['Clear path', 'Partial path', 'No path'] as const).map(
    (label) => {
      const count = mapping.filter((m) => m.verdict === label).length;
      return {
        label,
        meaning: VERDICT_MEANINGS[label],
        count,
        pct: verdicted ? Math.round((count / verdicted) * 100) : 0,
      };
    },
  );
  const shapeLegend: ShapeLegendEntry[] = (['1:1', 'Fan-out', 'Rebuild'] as Shape[]).map(
    (label) => ({
      label,
      meaning: SHAPE_MEANINGS[label],
      count: mapping.filter((m) => m.shape === label).length,
    }),
  );
  const reviewCount = mapping.filter((m) => m.verdict === 'Further review').length;

  const namesFor = (rowId: RowId): string[] => {
    const out: string[] = [];
    for (const [k, t] of tallies) if (k.endsWith(`|${rowId}`) && t.primary) out.push(...t.names);
    return [...new Set(out)];
  };
  const review: ReviewRow[] = [];
  const lookupProduct = rowCountAll('cfg.lookupProductRule');
  if (lookupProduct)
    review.push({
      reason: 'Unread',
      subject: `Lookup queries on a product rule — ${lookupProduct}`,
      count: lookupProduct,
      question: 'How many product properties does your lookup table key on?',
      outA: 'Keys on one property: this is a pricing table and a direct port.',
      outB: 'Keys on three: it becomes product variants, or an expanded catalogue.',
      names: namesFor('cfg.lookupProductRule'),
    });
  const lookupPrice = rowCountAll('price.lookupPriceRule');
  if (lookupPrice)
    review.push({
      reason: 'Unread',
      subject: `Lookup queries on a price rule — ${lookupPrice}`,
      count: lookupPrice,
      question: 'Are the lookup inputs properties of the product, or values from another object?',
      outA: 'Product properties: a pricing table carries it.',
      outB: 'Another object: custom object values cannot feed a pricing formula, so the matrix is re-expressed as variants or products.',
      names: namesFor('price.lookupPriceRule'),
    });
  const codeCount =
    rowCountAll('code.qcp') +
    rowCountAll('code.triggers') +
    rowCountAll('code.customActions') +
    rowCountAll('code.ui');
  if (codeCount)
    review.push({
      reason: 'Unread',
      subject: `Quote Calculator Plugins, triggers and UI — ${codeCount}`,
      count: codeCount,
      question: 'What does each script actually do at its calculator hook?',
      outA: 'Pricing maths: calculated pricing absorbs it declaratively.',
      outB: 'An external call or a cross-system lookup: it needs a redesign, and the call decides which.',
      names: [
        ...namesFor('code.qcp'),
        ...namesFor('code.triggers'),
        ...namesFor('code.customActions'),
        ...namesFor('code.ui'),
      ],
    });

  const prerequisites = buildPrerequisites(ex);
  const seeded = Object.entries(ex.seeded).map(([object, count]) => ({ object, count }));
  const primaryTotal = cl.records.length + cl.residue.length;
  const residuePct = primaryTotal ? (cl.residue.length / primaryTotal) * 100 : 0;
  const dateStamp = now.toISOString().slice(0, 10);
  const orgSlug =
    opts.org.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'org';
  const facts = cl.facts;
  const dormantBundles = ex.productFeature.records.filter(
    (r) => !r.LastModifiedDate || r.LastModifiedDate < ex.since,
  ).length;
  const neverFired = Math.max(0, ex.approvalRule.count - facts.approvalRulesFired);
  const windowLabel = `${ex.windowMonths} months`;
  const highlights = `In this org: ${dormantBundles} bundle option${dormantBundles === 1 ? '' : 's'} not configured since ${ex.since.slice(0, 4)}, ${neverFired} approval rule${neverFired === 1 ? '' : 's'} that ${neverFired === 1 ? 'has' : 'have'} not fired in the last 12 months, ${facts.productsNeverQuoted} product${facts.productsNeverQuoted === 1 ? '' : 's'} never quoted inside the ${windowLabel} window, and ${ex.customScript.count} Quote Calculator Plugin${ex.customScript.count === 1 ? '' : 's'}.`;

  const years = new Map<number, { total: number; amendRenew: number }>();
  for (const q of ex.quotesByYear) {
    const y = years.get(q.year) ?? { total: 0, amendRenew: 0 };
    y.total += q.count;
    if (/amendment|renewal/i.test(q.type)) y.amendRenew += q.count;
    years.set(q.year, y);
  }

  return {
    version: opts.version,
    runId: opts.runId,
    generatedAt: now.toISOString(),
    org: opts.org,
    window: { months: ex.windowMonths, since: ex.since, label: windowLabel },
    quoteDateField: ex.quoteDateField,
    phases: PHASES.map((p) => ({ id: p.id, name: p.name, note: p.note, buckets: [...p.buckets] })),
    buckets,
    verdictScale,
    shapeLegend,
    reviewCount,
    mapping,
    review,
    notes: buildNotes(ex, cl, rowCountAll),
    prerequisites,
    seeded,
    unread: ex.unread,
    unscanned:
      'Apex classes and Flows were not scanned. Neither can be attributed to an object reliably, so logic may exist there that this report does not see.',
    residue: { count: cl.residue.length, pct: Math.round(residuePct * 10) / 10 },
    highlights,
    volume: {
      quotesByYear: [...years].sort((a, b) => a[0] - b[0]).map(([year, v]) => ({ year, ...v })),
      quotesInWindow: ex.quotesInWindow,
      distinctProductsQuoted: ex.distinctProductsQuoted,
    },
    outbound: outboundConfig(),
    fileName: `quotivity-cpq-inventory-${orgSlug}-${dateStamp}`,
    sourceUrl: SOURCE_URL,
  };
}

const bareName = (f: string | null | undefined): string => (f ?? '').split('.').pop() ?? '';

function buildPrerequisites(ex: Extraction): Prerequisite[] {
  const custom = new Map<string, Prerequisite['object']>();
  for (const f of ex.quoteFields.records)
    if (!f.NamespacePrefix && f.QualifiedApiName.endsWith('__c'))
      custom.set(f.QualifiedApiName, 'SBQQ__Quote__c');
  for (const f of ex.quoteLineFields.records)
    if (!f.NamespacePrefix && f.QualifiedApiName.endsWith('__c'))
      custom.set(f.QualifiedApiName, 'SBQQ__QuoteLine__c');
  if (!custom.size) return [];
  const refs = new Map<string, Set<string>>();
  const ref = (field: string | null | undefined, by: string) => {
    const name = bareName(field);
    if (!custom.has(name)) return;
    const s = refs.get(name) ?? new Set<string>();
    s.add(by);
    refs.set(name, s);
  };
  for (const c of ex.priceCondition.records) ref(c.SBQQ__Field__c, 'price rule conditions');
  for (const a of ex.priceAction.records) {
    ref(a.SBQQ__Field__c, 'price rule actions');
    for (const f of custom.keys()) if (a.SBQQ__Formula__c?.includes(f)) ref(f, 'price formulas');
  }
  for (const c of ex.errorCondition.records) ref(c.SBQQ__TestedField__c, 'validation rules');
  for (const s of ex.summaryVariable.records) {
    ref(s.SBQQ__AggregateField__c, 'summary variables');
    ref(s.SBQQ__FilterField__c, 'summary variables');
    ref(s.SBQQ__ConstraintField__c, 'summary variables');
  }
  for (const c of ex.approvalCondition.records) ref(c.sbaa__TestedField__c, 'approval rules');
  for (const t of ex.termCondition.records) ref(t.SBQQ__Field__c, 'term conditions');
  for (const l of ex.lineColumn.records) ref(l.SBQQ__FieldName__c, 'template line columns');
  for (const a of ex.configurationAttribute.records)
    ref(a.SBQQ__TargetField__c, 'configuration attributes');
  const code = new Map<string, Set<string>>();
  const codeRef = (body: string | null | undefined, by: string) => {
    if (!body) return;
    for (const f of custom.keys()) {
      if (body.includes(f)) {
        const s = code.get(f) ?? new Set<string>();
        s.add(by);
        code.set(f, s);
      }
    }
  };
  for (const s of ex.customScript.records) codeRef(s.SBQQ__Code__c, `QCP ${s.Name}`);
  for (const t of ex.apexTrigger.records) codeRef(t.Body, `trigger ${t.Name}`);
  const out: Prerequisite[] = [];
  for (const [field, object] of custom) {
    const by = refs.get(field);
    const byCode = code.get(field);
    if (!by && !byCode) continue;
    const kind = object === 'SBQQ__Quote__c' ? 'Quote property' : 'Line item property';
    const parts: string[] = [];
    if (by) parts.push(`read by ${[...by].join(', ')}`);
    if (byCode)
      parts.push(
        `written by ${[...byCode].join(', ')} — no declarative source until the code question is settled`,
      );
    out.push({ field, object, need: `${kind} — ${parts.join('; ')}`, review: !!byCode });
  }
  return out.sort((a, b) => Number(a.review) - Number(b.review) || a.field.localeCompare(b.field));
}

function buildNotes(
  ex: Extraction,
  cl: Classification,
  rowCount: (id: string) => number,
): ReportData['notes'] {
  const f = cl.facts;
  const notes: ReportData['notes'] = [
    {
      head: 'Clear path is not a claim that it is easy',
      body: 'It says the behaviour survives and the route is known. A quote template rebuilt from scratch is a clear path — the finished document is reproducible and every part of it has a destination. Shape is where the work shows: Fan-out means one construct becomes several records, Rebuild means it is authored fresh rather than imported.',
    },
    {
      head: 'Ramp pricing has hard edges, and a route around them',
      body: 'A ramp needs at least two periods, applies only to recurring lines, and cannot be applied to a bundle header or an option product. Stepped periods on a bundled product are still buildable with Update Bundle Members rules — what is lost is the native grouping, period badges and MRR handling. Quantity is also locked across ramp periods, which is the most common reason a segmented subscription lands on Partial path.',
    },
    {
      head: 'Dated conversion rates: quoting carries, authoring does not',
      body: `HubSpot holds one current rate per currency, set manually or updated on a schedule from Open Exchange Rates. A deal's rate is stamped at close and history stays viewable, so point-in-time quoting carries. What does not carry is authoring a rate against a named past or future period. ${
        rowCount('cat.dcrTable')
          ? `${rowCount('cat.dcrTable')} of your currencies maintain more than one rate period, which is the practice that does not reproduce.`
          : 'Every currency here holds one rate period, which a manual entry reproduces.'
      }`,
    },
    {
      head: 'The formula limits are specific',
      body: 'Calculated pricing supports IF, CASE, AND, OR, NOT, ISBLANK, BLANKVALUE, MIN and MAX — and AND / OR take two to five arguments each. A price action that ANDs six conditions is over the limit even though every function it uses is supported. The report prints the specific limit each formula breaches.',
    },
    {
      head: 'Contracted pricing states its cardinality',
      body: `It lands as a price book assigned to a company, which also locks the quote so reps cannot switch away from negotiated pricing. ${
        ex.contractedPrice.count
          ? `Your ${ex.contractedPrice.count} contracted prices across ${f.contractedPriceAccounts} accounts become ${f.contractedPriceAccounts} price books and ${ex.contractedPrice.count} entries, expressed as import file rows.`
          : 'This org holds no contracted prices.'
      }`,
    },
    {
      head: 'Discount tiers are half-open',
      body: 'CPQ validates that each tier lower bound equals the previous upper bound, so a schedule reads 1–5, 5–10, 10–25. Reading those as inclusive ranges shifts every boundary by one unit and misprices the tier edges, so the convention is preserved on import.',
    },
    {
      head: 'Package-owned records are excluded everywhere',
      body: `CPQ ships its own metadata and configuration records into every org. Counted naively they become your customisation. Namespaced components are filtered on namespace; seeded configuration records are identified by an install signature. ${
        Object.keys(ex.seeded).length
          ? `In this org: ${Object.entries(ex.seeded)
              .map(([o, c]) => `${c} ${o}`)
              .join(', ')} shipped with CPQ and were not counted.`
          : 'No seeded configuration records were detected in this org.'
      }`,
    },
    {
      head: 'Apex classes and Flows were not scanned',
      body: 'Neither can be attributed to a CPQ object reliably — matching strings in a class body over-matches on incidental references and under-matches on dynamic SOQL. Logic may exist there that this report does not see.',
    },
  ];
  if (f.ruleConditionProblems.length) {
    notes.push({
      head: 'Custom condition logic that does not parse',
      body: `${f.ruleConditionProblems.length} rule${f.ruleConditionProblems.length === 1 ? '' : 's'} carry a Custom conditions-met expression the tool could not resolve against the conditions on the rule: ${f.ruleConditionProblems
        .slice(0, 5)
        .map((p) => `${p.rule} (${p.problem})`)
        .join('; ')}. Those rules are counted under their type but their logic needs a look.`,
    });
  }
  return notes;
}

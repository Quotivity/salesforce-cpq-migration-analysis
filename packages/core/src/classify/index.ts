import type { Extraction } from '../extract/index.js';
import type * as R from '../extract/records.js';
import { type BulkTouch, detectBulkTouch, isAlive } from '../liveness.js';
import type { ObjectRead } from '../soql.js';
import type { BucketId } from '../types.js';
import { validateAgainstIndexes } from './advancedCondition.js';
import { checkFormula } from './formula.js';
import { type RowId, ruleRow } from './rules.js';

export interface Listing {
  rowId: RowId;
  bucket: BucketId;
}

export interface ClassifiedRecord {
  id: string;
  object: string;
  name: string;
  primary: Listing;
  secondary: Listing[];
  alive: boolean;
  /** Free-text facts the report can print (formula breach, hooks implemented, ...). */
  details: string[];
}

/** Count-only rows: the tool has the aggregate but not the records (contracts, quotes, currencies). */
export interface Tally {
  rowId: RowId;
  bucket: BucketId;
  count: number;
  alive: number;
  details?: string[];
}

export interface ObjectStat {
  object: string;
  status: ObjectRead['status'];
  count: number;
  retrieved: number;
  classified: number;
  residue: number;
  partial: boolean;
  bulkTouch: BulkTouch | null;
}

export interface Classification {
  records: ClassifiedRecord[];
  tallies: Tally[];
  residue: { object: string; id: string; name: string }[];
  objects: ObjectStat[];
  facts: ClassificationFacts;
}

export interface ClassificationFacts {
  bundles: number;
  nestingDepth: number;
  featureCount: number;
  optionCount: number;
  approverCount: number;
  medianApprovalCycleDays: number | null;
  approvalHistoryCount: number;
  approvalRulesFired: number;
  contractedPriceAccounts: number;
  discountTierCount: number;
  templateSectionCount: number;
  templateContentCount: number;
  deadSummaryVariables: number;
  qcpHooks: Record<string, string[]>;
  ruleConditionProblems: { rule: string; problem: string }[];
  attributeCount: number;
  currencies: string[];
  multiCurrency: boolean;
  advancedApprovalsInstalled: boolean;
  nativeApprovalProcesses: number;
  subscriptionCount: number;
  productsNeverQuoted: number;
  amendRenewShareLastYear: number | null;
  lastYear: number | null;
}

const PRICE_FIELDS = new Set(
  [
    'SBQQ__ListPrice__c',
    'SBQQ__SpecialPrice__c',
    'SBQQ__RegularPrice__c',
    'SBQQ__CustomerPrice__c',
    'SBQQ__NetPrice__c',
    'SBQQ__PartnerPrice__c',
    'SBQQ__UnitCost__c',
    'SBQQ__ProratedListPrice__c',
    'SBQQ__ProratedPrice__c',
    'SBQQ__OriginalPrice__c',
    'SBQQ__SpecialPriceType__c',
    'SBQQ__PricingMethod__c',
  ].map((f) => f.toLowerCase()),
);
const DISCOUNT_FIELDS = new Set(
  [
    'SBQQ__Discount__c',
    'SBQQ__AdditionalDiscount__c',
    'SBQQ__AdditionalDiscountAmount__c',
    'SBQQ__DistributorDiscount__c',
    'SBQQ__PartnerDiscount__c',
    'SBQQ__Markup__c',
    'SBQQ__MarkupRate__c',
    'SBQQ__MarkupAmount__c',
    'SBQQ__VolumeDiscount__c',
    'SBQQ__CompoundDiscountRate__c',
    'SBQQ__DiscountSchedule__c',
    'SBQQ__CustomerDiscount__c',
    'SBQQ__DiscountAmount__c',
    'SBQQ__AdditionalDiscountRate__c',
  ].map((f) => f.toLowerCase()),
);

const QCP_HOOKS = [
  'onInit',
  'onBeforeCalculate',
  'onBeforePriceRules',
  'onAfterPriceRules',
  'onAfterCalculate',
  'isFieldVisible',
  'isFieldEditable',
  'isFieldVisibleForObject',
  'isFieldEditableForObject',
];

const bare = (field: string | null | undefined): string =>
  (field ?? '').split('.').pop()?.toLowerCase() ?? '';

export function classifyAll(ex: Extraction): Classification {
  const since = ex.since;
  const records: ClassifiedRecord[] = [];
  const tallies: Tally[] = [];
  const residue: { object: string; id: string; name: string }[] = [];
  const objects: ObjectStat[] = [];
  const ruleConditionProblems: { rule: string; problem: string }[] = [];

  const add = (
    read: ObjectRead<R.Audited>,
    rec: R.Audited & { Name?: string },
    primary: Listing,
    secondary: Listing[] = [],
    details: string[] = [],
    aliveOverride?: boolean,
  ) => {
    records.push({
      id: rec.Id,
      object: read.object,
      name: rec.Name ?? rec.Id,
      primary,
      secondary,
      alive: aliveOverride ?? isAlive(rec, since),
      details,
    });
  };
  const stat = (read: ObjectRead<R.Audited>, classified: number, residueN: number) => {
    objects.push({
      object: read.object,
      status: read.status,
      count: read.count,
      retrieved: read.records.length,
      classified,
      residue: residueN,
      partial: read.partial,
      bulkTouch: read.status === 'ok' ? detectBulkTouch(read.object, read.records) : null,
    });
  };
  const L = (rowId: RowId, bucket?: BucketId): Listing => {
    const r = ruleRow(rowId);
    const b = bucket ?? (r.bucket === 'follows' ? 'price' : r.bucket);
    return { rowId, bucket: b };
  };
  const cross = (rowId: RowId): Listing[] => {
    const r = ruleRow(rowId);
    return r.crossBucket ? [{ rowId, bucket: r.crossBucket }] : [];
  };

  // ── Catalog ─────────────────────────────────────────────────────────────
  const bundleParents = new Set(ex.productFeature.records.map((f) => f.SBQQ__ConfiguredSKU__c));
  for (const o of ex.productOption.records) bundleParents.add(o.SBQQ__ConfiguredSKU__c);
  const optionProducts = new Set(ex.productOption.records.map((o) => o.SBQQ__OptionalSKU__c));
  const blockPriced = new Set(ex.blockPrice.records.map((b) => b.SBQQ__Product__c));

  for (const p of ex.product2.records) {
    const secondary: Listing[] = [];
    const method = (p.SBQQ__PricingMethod__c ?? '').toLowerCase();
    if (method === 'cost') secondary.push(L('price.costPlus'));
    else if (method === 'percent of total') secondary.push(L('price.percentOfTotal'));
    else if (method === 'block' || blockPriced.has(p.Id)) secondary.push(L('price.block'));
    if ((p.SBQQ__ChargeType__c ?? '').toLowerCase() === 'usage') secondary.push(L('price.usage'));
    if (p.SBQQ__SubscriptionPricing__c) {
      const isBundleHeader =
        bundleParents.has(p.Id) ||
        (p.SBQQ__ConfigurationType__c && p.SBQQ__ConfigurationType__c !== 'None');
      const rowId: RowId =
        isBundleHeader || optionProducts.has(p.Id)
          ? 'price.subscriptionBundled'
          : 'price.subscriptionUnbundled';
      secondary.push(L(rowId), ...cross(rowId));
    }
    if (p.SBQQ__NonDiscountable__c || p.SBQQ__PriceEditable__c === false)
      secondary.push(L('grd.productFlags'));
    add(ex.product2, p, L('cat.products'), secondary);
  }
  stat(ex.product2, ex.product2.records.length, 0);

  for (const pb of ex.pricebook2.records) add(ex.pricebook2, pb, L('cat.pricebooks'));
  stat(ex.pricebook2, ex.pricebook2.records.length, 0);

  const currencies = ex.currencyType.records.filter((c) => c.IsActive).map((c) => c.IsoCode);
  const multiCurrency = currencies.length > 1;
  if (multiCurrency)
    tallies.push({
      rowId: 'cat.currencies',
      bucket: 'catalog',
      count: currencies.length,
      alive: currencies.length,
      details: currencies,
    });
  const periods = new Map<string, number>();
  for (const r of ex.datedConversionRate.records)
    periods.set(r.IsoCode, (periods.get(r.IsoCode) ?? 0) + 1);
  const staticCur = [...periods].filter(([, n]) => n <= 1).map(([c]) => c);
  const tableCur = [...periods].filter(([, n]) => n > 1).map(([c]) => c);
  if (staticCur.length)
    tallies.push({
      rowId: 'cat.dcrStatic',
      bucket: 'catalog',
      count: staticCur.length,
      alive: staticCur.length,
      details: staticCur,
    });
  if (tableCur.length)
    tallies.push({
      rowId: 'cat.dcrTable',
      bucket: 'catalog',
      count: tableCur.length,
      alive: tableCur.length,
      details: tableCur.map((c) => `${c}: ${periods.get(c)} rate periods`),
    });

  // ── Configuration ───────────────────────────────────────────────────────
  const featureShape = new Map<string, RowId>();
  for (const f of ex.productFeature.records) {
    const min = f.SBQQ__MinOptionCount__c ?? null;
    const max = f.SBQQ__MaxOptionCount__c ?? null;
    let rowId: RowId = 'cfg.features';
    if (min === 1 && max === 1) rowId = 'cfg.featurePickOne';
    else if (min === 1 && max == null) rowId = 'cfg.featurePickMany';
    else if ((min != null && min > 1) || (max != null && max > 1)) rowId = 'cfg.featureCap';
    featureShape.set(f.Id, rowId);
    add(ex.productFeature, f, L(rowId));
  }
  stat(ex.productFeature, ex.productFeature.records.length, 0);

  const optionById = new Map(ex.productOption.records.map((o) => [o.Id, o]));
  for (const o of ex.productOption.records) {
    const rowId: RowId = bundleParents.has(o.SBQQ__OptionalSKU__c)
      ? 'cfg.optionsNested'
      : 'cfg.optionsPlain';
    add(ex.productOption, { ...o, Name: o.Id }, L(rowId));
  }
  stat(ex.productOption, ex.productOption.records.length, 0);

  // Nesting depth: follow option → bundle chains.
  const childrenOf = new Map<string, string[]>();
  for (const o of ex.productOption.records) {
    const list = childrenOf.get(o.SBQQ__ConfiguredSKU__c) ?? [];
    list.push(o.SBQQ__OptionalSKU__c);
    childrenOf.set(o.SBQQ__ConfiguredSKU__c, list);
  }
  const depthOf = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const kids = childrenOf.get(id) ?? [];
    let d = 0;
    for (const k of kids) d = Math.max(d, depthOf(k, seen));
    seen.delete(id);
    return kids.length ? 1 + d : 0;
  };
  let nestingDepth = 0;
  for (const parent of childrenOf.keys())
    nestingDepth = Math.max(nestingDepth, depthOf(parent, new Set()));

  let cfgRes = 0;
  for (const c of ex.optionConstraint.records) {
    const type = (c.SBQQ__Type__c ?? '').toLowerCase();
    if (type === 'exclusion') add(ex.optionConstraint, c, L('cfg.constraintExclusion'));
    else if (type === 'dependency') {
      const req = c.SBQQ__ConstrainingOption__c
        ? optionById.get(c.SBQQ__ConstrainingOption__c)
        : undefined;
      const satisfied =
        !!req &&
        !!req.SBQQ__Selected__c &&
        featureShape.get(req.SBQQ__Feature__c ?? '') === 'cfg.featurePickOne';
      add(
        ex.optionConstraint,
        c,
        L(satisfied ? 'cfg.constraintDepSatisfied' : 'cfg.constraintDepOther'),
      );
    } else {
      cfgRes += 1;
      residue.push({ object: ex.optionConstraint.object, id: c.Id, name: c.Name });
    }
  }
  stat(ex.optionConstraint, ex.optionConstraint.records.length - cfgRes, cfgRes);

  for (const r of ex.configurationRule.records)
    add(ex.configurationRule, { ...r, Name: r.Id }, L('cfg.configRules'));
  stat(ex.configurationRule, ex.configurationRule.records.length, 0);

  for (const a of ex.configurationAttribute.records) {
    const rowId: RowId = a.SBQQ__ApplyToProductOptions__c
      ? 'disc.attributesOnOptions'
      : 'disc.attributesGuided';
    add(ex.configurationAttribute, a, L(rowId), cross(rowId));
  }
  stat(ex.configurationAttribute, ex.configurationAttribute.records.length, 0);

  // ── Product rules (classifier input) ────────────────────────────────────
  const errorCondsByRule = groupBy(ex.errorCondition.records, (c) => c.SBQQ__Rule__c);
  const actionsByRule = groupBy(ex.productAction.records, (a) => a.SBQQ__Rule__c);
  const testedByValidation = new Set<string>();
  for (const c of ex.errorCondition.records)
    if (c.SBQQ__TestedField__c) testedByValidation.add(bare(c.SBQQ__TestedField__c));
  const productRuleBucket = new Map<string, BucketId>();
  let prRes = 0;
  for (const r of ex.productRule.records) {
    const type = (r.SBQQ__Type__c ?? '').toLowerCase();
    const scope = (r.SBQQ__Scope__c ?? '').toLowerCase();
    let rowId: RowId | null = null;
    if (type === 'selection') rowId = 'cfg.selectionRules';
    else if (type === 'filter') rowId = 'cfg.filterRules';
    else if ((type === 'validation' || type === 'alert') && scope === 'quote')
      rowId = 'grd.quoteScope';
    else if (type === 'validation') rowId = 'grd.validation';
    else if (type === 'alert') rowId = 'grd.alert';
    if (!rowId) {
      prRes += 1;
      residue.push({ object: ex.productRule.object, id: r.Id, name: r.Name });
      continue;
    }
    const secondary: Listing[] = [];
    const details: string[] = [];
    if ((r.SBQQ__ConditionsMet__c ?? '').toLowerCase() === 'custom') {
      secondary.push(L('grd.customLogic'));
      const present = (errorCondsByRule.get(r.Id) ?? []).map((c) => c.SBQQ__Index__c ?? -1);
      const v = validateAgainstIndexes(r.SBQQ__AdvancedCondition__c, present);
      if (v.parsed)
        details.push(
          `custom logic ${r.SBQQ__AdvancedCondition__c} → ${v.parsed.dnf.map((g) => g.join(' AND ')).join(' OR ')}`,
        );
      if (!v.ok)
        ruleConditionProblems.push({
          rule: r.Name,
          problem: v.error ?? `references conditions ${v.missing.join(', ')} that do not exist`,
        });
    }
    const listing = L(rowId);
    productRuleBucket.set(r.Id, listing.bucket);
    add(ex.productRule, r, listing, secondary, details);
  }
  stat(ex.productRule, ex.productRule.records.length - prRes, prRes);

  // Product actions: only Remove/Disable carry their own discriminator; the rest are children.
  let countedActions = 0;
  for (const [ruleId, actions] of actionsByRule) {
    const hasReplacement = actions.some(
      (a) =>
        /add|enable|default/i.test(a.SBQQ__Type__c ?? '') &&
        !/remove|disable/i.test(a.SBQQ__Type__c ?? ''),
    );
    for (const a of actions) {
      if (!/remove|disable/i.test(a.SBQQ__Type__c ?? '')) continue;
      countedActions += 1;
      add(
        ex.productAction,
        { ...a, Name: `${a.SBQQ__Type__c} on rule ${ruleId}` },
        L(hasReplacement ? 'cfg.actionSwap' : 'cfg.actionRemoveNoReplacement'),
      );
    }
  }
  objects.push({
    object: ex.productAction.object,
    status: ex.productAction.status,
    count: ex.productAction.count,
    retrieved: ex.productAction.records.length,
    classified: countedActions,
    residue: 0,
    partial: ex.productAction.partial,
    bulkTouch: null,
  });

  // ── Discovery ───────────────────────────────────────────────────────────
  for (const q of ex.quoteProcess.records) add(ex.quoteProcess, q, L('disc.quoteProcesses'));
  stat(ex.quoteProcess, ex.quoteProcess.records.length, 0);
  for (const p of ex.processInput.records) add(ex.processInput, p, L('disc.processInputs'));
  stat(ex.processInput, ex.processInput.records.length, 0);

  // ── Price rules (classifier input) ──────────────────────────────────────
  const priceActionsByRule = groupBy(ex.priceAction.records, (a) => a.SBQQ__Rule__c);
  const priceCondsByRule = groupBy(ex.priceCondition.records, (c) => c.SBQQ__Rule__c);
  const attributeTargets = new Set(
    ex.configurationAttribute.records.map((a) => bare(a.SBQQ__TargetField__c)).filter(Boolean),
  );
  const priceRuleBucket = new Map<string, BucketId>();
  let priceRes = 0;
  for (const r of ex.priceRule.records) {
    const actions = priceActionsByRule.get(r.Id) ?? [];
    const conds = priceCondsByRule.get(r.Id) ?? [];
    const scope = (r.SBQQ__TargetObject__c ?? '').toLowerCase();
    const writes = actions.map((a) => bare(a.SBQQ__Field__c)).filter(Boolean);
    const writesPrice = actions.some(
      (a) =>
        PRICE_FIELDS.has(bare(a.SBQQ__Field__c)) ||
        (!!a.SBQQ__Formula__c && PRICE_FIELDS.has(bare(a.SBQQ__Field__c))),
    );
    const writesDiscount = writes.some((f) => DISCOUNT_FIELDS.has(f));
    const writesTested = writes.some((f) => testedByValidation.has(f));
    const testsAttribute = conds.some((c) => attributeTargets.has(bare(c.SBQQ__Field__c)));
    let rowId: RowId | null = null;
    if (scope === 'configurator') rowId = 'cfg.priceRuleConfigurator';
    else if (writesTested) rowId = 'grd.floorCeiling';
    else if (writesPrice)
      rowId = testsAttribute ? 'price.attributeDriven' : 'price.priceRulesPrice';
    else if (writesDiscount) rowId = 'dsc.priceRulesDiscount';
    else if (writes.length) rowId = 'disc.priceRulesDefaulting';
    if (!rowId) {
      priceRes += 1;
      residue.push({ object: ex.priceRule.object, id: r.Id, name: r.Name });
      continue;
    }
    const details: string[] = [];
    const event =
      scope === 'configurator'
        ? r.SBQQ__ConfiguratorEvaluationEvent__c
        : r.SBQQ__EvaluationEvent__c;
    if (event) details.push(`${r.SBQQ__TargetObject__c ?? 'Calculator'} · ${event}`);
    const secondary: Listing[] = [];
    if ((r.SBQQ__ConditionsMet__c ?? '').toLowerCase() === 'custom') {
      secondary.push(L('grd.customLogic'));
      const present = conds.map((c) => c.SBQQ__Index__c ?? -1);
      const v = validateAgainstIndexes(r.SBQQ__AdvancedCondition__c, present);
      if (v.parsed)
        details.push(
          `custom logic ${r.SBQQ__AdvancedCondition__c} → ${v.parsed.dnf.map((g) => g.join(' AND ')).join(' OR ')}`,
        );
      if (!v.ok)
        ruleConditionProblems.push({
          rule: r.Name,
          problem: v.error ?? `references conditions ${v.missing.join(', ')} that do not exist`,
        });
    }
    const listing = L(rowId);
    priceRuleBucket.set(r.Id, listing.bucket);
    add(ex.priceRule, r, listing, secondary, details);
  }
  stat(ex.priceRule, ex.priceRule.records.length - priceRes, priceRes);

  // Price actions with their own discriminator.
  let countedPriceActions = 0;
  for (const a of ex.priceAction.records) {
    const target = (a.SBQQ__TargetObject__c ?? '').toLowerCase();
    const check = checkFormula(a.SBQQ__Formula__c);
    let rowId: RowId | null = null;
    const details: string[] = [];
    if (!check.ok) {
      rowId = 'price.actionsOverLimit';
      details.push(...check.breaches);
    } else if (target === 'quote')
      rowId = a.SBQQ__SourceVariable__c
        ? 'price.actionsQuoteRollup'
        : 'price.actionsQuoteArbitrary';
    if (!rowId) continue;
    countedPriceActions += 1;
    add(
      ex.priceAction,
      { ...a, Name: `${a.SBQQ__Field__c ?? 'action'} on rule ${a.SBQQ__Rule__c}` },
      L(rowId),
      [],
      details,
    );
  }
  objects.push({
    object: ex.priceAction.object,
    status: ex.priceAction.status,
    count: ex.priceAction.count,
    retrieved: ex.priceAction.records.length,
    classified: countedPriceActions,
    residue: 0,
    partial: ex.priceAction.partial,
    bulkTouch: null,
  });

  // ── Summary variables follow the rule that consumes them ────────────────
  const svConsumer = new Map<string, BucketId>();
  const note = (id: string | null | undefined, bucket: BucketId | undefined) => {
    if (id && bucket && !svConsumer.has(id)) svConsumer.set(id, bucket);
  };
  for (const a of ex.priceAction.records)
    note(a.SBQQ__SourceVariable__c, priceRuleBucket.get(a.SBQQ__Rule__c));
  for (const c of ex.priceCondition.records) {
    note(c.SBQQ__TestedVariable__c, priceRuleBucket.get(c.SBQQ__Rule__c));
    note(c.SBQQ__FilterVariable__c, priceRuleBucket.get(c.SBQQ__Rule__c));
  }
  for (const c of ex.errorCondition.records) {
    note(c.SBQQ__TestedVariable__c, productRuleBucket.get(c.SBQQ__Rule__c));
    note(c.SBQQ__FilterVariable__c, productRuleBucket.get(c.SBQQ__Rule__c));
  }
  for (const t of ex.termCondition.records) note(t.SBQQ__TestedVariable__c, 'output');
  let deadSummaryVariables = 0;
  for (const s of ex.summaryVariable.records) {
    const target = (s.SBQQ__TargetObject__c ?? '').toLowerCase();
    const scope = (s.SBQQ__Scope__c ?? '').toLowerCase();
    let rowId: RowId = 'sv.plain';
    if (target === 'asset' || target === 'subscription' || scope === 'assets') rowId = 'sv.asset';
    else if (target === 'product option') rowId = 'sv.productOption';
    else if (s.SBQQ__ConstraintField__c) rowId = 'sv.constraint';
    else if (s.SBQQ__CombineWith__c || s.SBQQ__ValueElement__c != null) rowId = 'sv.composite';
    const consumer = svConsumer.get(s.Id);
    const details: string[] = [];
    let aliveOverride: boolean | undefined;
    if (!consumer) {
      deadSummaryVariables += 1;
      details.push('no rule, condition or term references this variable — dead configuration');
      aliveOverride = false;
    }
    add(ex.summaryVariable, s, L(rowId, consumer ?? 'price'), [], details, aliveOverride);
  }
  stat(ex.summaryVariable, ex.summaryVariable.records.length, 0);

  let lqRes = 0;
  for (const q of ex.lookupQuery.records) {
    if (q.SBQQ__ProductRule__c)
      add(ex.lookupQuery, q, L('cfg.lookupProductRule'), cross('cfg.lookupProductRule'));
    else if (q.SBQQ__PriceRule__c)
      add(ex.lookupQuery, q, L('price.lookupPriceRule'), cross('price.lookupPriceRule'));
    else {
      lqRes += 1;
      residue.push({ object: ex.lookupQuery.object, id: q.Id, name: q.Name });
    }
  }
  stat(ex.lookupQuery, ex.lookupQuery.records.length - lqRes, lqRes);

  // Dimensions: differing quantities across segments sharing a segment key.
  const differingDimensions = new Set<string>();
  const byKey = groupBy(
    ex.segmentedLines.records.filter((l) => l.SBQQ__SegmentKey__c),
    (l) => l.SBQQ__SegmentKey__c as string,
  );
  for (const lines of byKey.values()) {
    const qty = new Set(lines.map((l) => l.SBQQ__Quantity__c ?? 0));
    if (qty.size > 1)
      for (const l of lines)
        if (l.SBQQ__Dimension__c) differingDimensions.add(l.SBQQ__Dimension__c);
  }
  for (const d of ex.dimension.records)
    add(ex.dimension, d, L(differingDimensions.has(d.Id) ? 'price.mdqDiffering' : 'price.mdqSame'));
  stat(ex.dimension, ex.dimension.records.length, 0);

  // ── Discounting ─────────────────────────────────────────────────────────
  for (const s of ex.discountSchedule.records) {
    const type = (s.SBQQ__Type__c ?? '').toLowerCase();
    const scope = (s.SBQQ__AggregationScope__c ?? '').toLowerCase();
    let rowId: RowId = 'dsc.perLine';
    const secondary: Listing[] = [];
    if (type === 'slab') rowId = 'dsc.slab';
    else if (scope === 'group') rowId = 'dsc.groupScope';
    else if (scope === 'quote') rowId = 'dsc.quoteScope';
    if (scope === 'group') secondary.push(L('grd.groupGated'));
    add(ex.discountSchedule, s, L(rowId), secondary);
  }
  stat(ex.discountSchedule, ex.discountSchedule.records.length, 0);

  const accounts = new Set<string>();
  for (const c of ex.contractedPrice.records) {
    if (c.SBQQ__Account__c) accounts.add(c.SBQQ__Account__c);
    add(ex.contractedPrice, c, L('dsc.contractedPrices'));
  }
  stat(ex.contractedPrice, ex.contractedPrice.records.length, 0);

  // ── Guardrails: platform validation rules ───────────────────────────────
  for (const v of ex.validationRule.records) {
    add(
      ex.validationRule,
      {
        Id: v.Id,
        Name: `${v.EntityDefinition?.QualifiedApiName ?? ''}.${v.ValidationName}`,
        LastModifiedDate: undefined,
      },
      L('grd.platformValidation'),
      cross('grd.platformValidation'),
      [],
      true,
    );
  }
  stat(ex.validationRule, ex.validationRule.records.length, 0);

  // Conditions gating on a quote line group (product rules / approvals) cross-list to grd.groupGated.
  for (const c of ex.errorCondition.records) {
    if (/group/i.test(c.SBQQ__TestedObject__c ?? '')) {
      const rec = records.find((r) => r.id === c.SBQQ__Rule__c);
      if (rec && !rec.secondary.some((s) => s.rowId === 'grd.groupGated'))
        rec.secondary.push(L('grd.groupGated'));
    }
  }

  // ── Approvals ───────────────────────────────────────────────────────────
  for (const r of ex.approvalRule.records)
    add(ex.approvalRule, r, L(r.sbaa__ApproverField__c ? 'apr.derivedApprover' : 'apr.rules'));
  stat(ex.approvalRule, ex.approvalRule.records.length, 0);
  for (const c of ex.approvalChain.records) add(ex.approvalChain, c, L('apr.chains'));
  stat(ex.approvalChain, ex.approvalChain.records.length, 0);
  for (const t of ex.trackedField.records) add(ex.trackedField, t, L('apr.trackedFields'));
  stat(ex.trackedField, ex.trackedField.records.length, 0);
  for (const v of ex.approvalVariable.records) add(ex.approvalVariable, v, L('apr.variables'));
  stat(ex.approvalVariable, ex.approvalVariable.records.length, 0);
  for (const p of ex.processDefinition.records)
    add(
      ex.processDefinition,
      { Id: p.Id, Name: p.Name, LastModifiedDate: p.LastModifiedDate },
      L('apr.native'),
      [],
      [`${p.TableEnumOrId} · ${p.State}`],
    );
  stat(ex.processDefinition, ex.processDefinition.records.length, 0);
  for (const c of ex.approvalCondition.records) {
    if (/group/i.test(c.sbaa__TestedField__c ?? '')) {
      const rec = records.find((r) => r.id === c.sbaa__ApprovalRule__c);
      if (rec && !rec.secondary.some((s) => s.rowId === 'grd.groupGated'))
        rec.secondary.push(L('grd.groupGated'));
    }
  }

  // Approval history → median cycle time and rules fired.
  const cycles: number[] = [];
  const firedRules = new Set<string>();
  for (const h of ex.approvalHistory.records) {
    if (h.sbaa__Rule__c) firedRules.add(h.sbaa__Rule__c);
    if (/approved|rejected/i.test(h.sbaa__Status__c ?? ''))
      cycles.push((Date.parse(h.LastModifiedDate) - Date.parse(h.CreatedDate)) / 86_400_000);
  }
  for (const p of ex.processInstance.records) {
    if (p.CompletedDate)
      cycles.push((Date.parse(p.CompletedDate) - Date.parse(p.CreatedDate)) / 86_400_000);
  }
  const medianCycle = median(cycles.filter((d) => d >= 0));

  // ── Quote output ────────────────────────────────────────────────────────
  for (const t of ex.quoteTemplate.records) add(ex.quoteTemplate, t, L('out.templates'));
  stat(ex.quoteTemplate, ex.quoteTemplate.records.length, 0);
  for (const c of ex.lineColumn.records) add(ex.lineColumn, c, L('out.lineColumns'));
  stat(ex.lineColumn, ex.lineColumn.records.length, 0);
  for (const t of ex.quoteTerm.records) add(ex.quoteTerm, t, L('out.terms'));
  stat(ex.quoteTerm, ex.quoteTerm.records.length, 0);
  for (const t of ex.termCondition.records)
    add(
      ex.termCondition,
      {
        Id: t.Id,
        Name: `${t.SBQQ__Field__c ?? ''} ${t.SBQQ__Operator__c ?? ''} ${t.SBQQ__Value__c ?? ''}`.trim(),
        LastModifiedDate: undefined,
      },
      L('out.termConditions'),
      [],
      [],
      true,
    );
  stat(ex.termCondition, ex.termCondition.records.length, 0);
  if (ex.quoteLineGroupCount > 0)
    tallies.push({
      rowId: 'out.groups',
      bucket: 'output',
      count: ex.quoteLineGroupCount,
      alive: ex.quoteLineGroupAlive,
    });

  // ── Contract lifecycle (count-only rows) ────────────────────────────────
  tallies.push({
    rowId: 'life.contracts',
    bucket: 'lifecycle',
    count: ex.contractActive,
    alive: ex.contractAlive,
    details: [`${ex.subscriptionCount} subscriptions`],
  });
  const sinceYear = Number(ex.since.slice(0, 4));
  const amendRenew = ex.quotesByYear
    .filter((q) => q.year >= sinceYear && /amendment|renewal/i.test(q.type))
    .reduce((a, q) => a + q.count, 0);
  tallies.push({
    rowId: 'life.amendRenew',
    bucket: 'lifecycle',
    count: amendRenew,
    alive: amendRenew,
  });
  if (ex.orderCount + ex.assetCount > 0)
    tallies.push({
      rowId: 'life.ordersAssets',
      bucket: 'lifecycle',
      count: ex.orderCount + ex.assetCount,
      alive: ex.orderCount + ex.assetCount,
      details: [`${ex.orderCount} orders`, `${ex.assetCount} assets`],
    });
  const nowYear = Number(ex.now.slice(0, 4));
  const lastYear = nowYear - 1;
  const lastYearRows = ex.quotesByYear.filter((q) => q.year === lastYear);
  const lastYearTotal = lastYearRows.reduce((a, q) => a + q.count, 0);
  const lastYearAR = lastYearRows
    .filter((q) => /amendment|renewal/i.test(q.type))
    .reduce((a, q) => a + q.count, 0);

  // ── Custom code & UI ────────────────────────────────────────────────────
  const qcpHooks: Record<string, string[]> = {};
  for (const s of ex.customScript.records) {
    const code = s.SBQQ__Code__c ?? '';
    const hooks = QCP_HOOKS.filter(
      (h) =>
        new RegExp(`\\b${h}\\s*[:(=]`).test(code) || new RegExp(`function\\s+${h}\\b`).test(code),
    );
    qcpHooks[s.Name] = hooks;
    add(
      ex.customScript,
      s,
      L('code.qcp'),
      [],
      hooks.length ? [`hooks: ${hooks.join(', ')}`] : ['no calculator hook detected'],
    );
  }
  stat(ex.customScript, ex.customScript.records.length, 0);
  for (const t of ex.apexTrigger.records)
    add(
      ex.apexTrigger,
      { Id: t.Id, Name: t.Name, LastModifiedDate: t.LastModifiedDate },
      L('code.triggers'),
      [],
      [`${t.TableEnumOrId} · ${t.Status ?? ''}`],
    );
  stat(ex.apexTrigger, ex.apexTrigger.records.length, 0);
  for (const a of ex.customAction.records)
    add(
      ex.customAction,
      a,
      L('code.customActions'),
      [],
      [a.SBQQ__Location__c ?? '', a.SBQQ__Type__c ?? ''].filter(Boolean),
    );
  stat(ex.customAction, ex.customAction.records.length, 0);
  for (const l of ex.layout.records)
    add(
      ex.layout,
      { Id: l.Id, Name: `Layout · ${l.Name}` },
      L('code.ui'),
      [],
      [l.TableEnumOrId ?? ''],
      true,
    );
  stat(ex.layout, ex.layout.records.length, 0);
  for (const w of ex.webLink.records)
    add(
      ex.webLink,
      { Id: w.Id, Name: `Button · ${w.Name}` },
      L('code.ui'),
      [],
      [w.PageOrSobjectType ?? ''],
      true,
    );
  stat(ex.webLink, ex.webLink.records.length, 0);
  for (const f of ex.flexiPage.records)
    add(
      ex.flexiPage,
      { Id: f.Id, Name: `Record page · ${f.DeveloperName}` },
      L('code.ui'),
      [],
      [f.EntityDefinitionId ?? ''],
      true,
    );
  stat(ex.flexiPage, ex.flexiPage.records.length, 0);

  const facts: ClassificationFacts = {
    bundles: bundleParents.size,
    nestingDepth,
    featureCount: ex.productFeature.count,
    optionCount: ex.productOption.count,
    approverCount: ex.approver.count,
    medianApprovalCycleDays: medianCycle,
    approvalHistoryCount: ex.approvalHistory.count + ex.processInstance.count,
    approvalRulesFired: firedRules.size,
    contractedPriceAccounts: accounts.size,
    discountTierCount: ex.discountTier.count,
    templateSectionCount: ex.templateSection.count,
    templateContentCount: ex.templateContent.count,
    deadSummaryVariables,
    qcpHooks,
    ruleConditionProblems,
    attributeCount: ex.configurationAttribute.count,
    currencies,
    multiCurrency,
    advancedApprovalsInstalled: ex.approvalRule.status !== 'absent',
    nativeApprovalProcesses: ex.processDefinition.count,
    subscriptionCount: ex.subscriptionCount,
    productsNeverQuoted: Math.max(0, ex.product2.count - ex.distinctProductsQuoted),
    amendRenewShareLastYear: lastYearTotal ? lastYearAR / lastYearTotal : null,
    lastYear: lastYearTotal ? lastYear : null,
  };

  return { records, tallies, residue, objects, facts };
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const a = sorted[mid] as number;
  const b = sorted[mid - 1] as number;
  return sorted.length % 2 ? a : (a + b) / 2;
}

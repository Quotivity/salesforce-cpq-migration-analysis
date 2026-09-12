import type { OrgConnection } from '../connection.js';
import { aggregate, count, inList, type ObjectRead, quote, readObject, soqlDate } from '../soql.js';
import type { BucketId } from '../types.js';
import * as R from './records.js';

export interface ExtractOptions {
  /** Dead-configuration window in months. Defaults to 24. */
  windowMonths?: number;
  /** Injectable clock for tests. */
  now?: Date;
  onProgress?: (event: ProgressEvent) => void;
}

export type ProgressStep = BucketId | 'seed' | 'classify';

export interface ProgressEvent {
  step: ProgressStep;
  status: 'start' | 'done' | 'error';
  detail?: string;
}

export interface YearCount {
  year: number;
  type: string;
  count: number;
}

export interface Extraction {
  windowMonths: number;
  since: string;
  approvalSince: string;
  now: string;

  product2: ObjectRead<R.Product2Rec>;
  pricebook2: ObjectRead<R.Pricebook2Rec>;
  currencyType: ObjectRead<R.CurrencyTypeRec>;
  datedConversionRate: ObjectRead<R.DatedConversionRateRec>;

  productFeature: ObjectRead<R.ProductFeatureRec>;
  productOption: ObjectRead<R.ProductOptionRec>;
  optionConstraint: ObjectRead<R.OptionConstraintRec>;
  configurationRule: ObjectRead<R.ConfigurationRuleRec>;
  configurationAttribute: ObjectRead<R.ConfigurationAttributeRec>;
  productRule: ObjectRead<R.ProductRuleRec>;
  errorCondition: ObjectRead<R.ErrorConditionRec>;
  productAction: ObjectRead<R.ProductActionRec>;

  quoteProcess: ObjectRead<R.QuoteProcessRec>;
  processInput: ObjectRead<R.ProcessInputRec>;
  processInputCondition: ObjectRead<R.ProcessInputConditionRec>;

  priceRule: ObjectRead<R.PriceRuleRec>;
  priceCondition: ObjectRead<R.PriceConditionRec>;
  priceAction: ObjectRead<R.PriceActionRec>;
  summaryVariable: ObjectRead<R.SummaryVariableRec>;
  lookupQuery: ObjectRead<R.LookupQueryRec>;
  blockPrice: ObjectRead<R.BlockPriceRec>;
  dimension: ObjectRead<R.DimensionRec>;
  segmentedLines: ObjectRead<R.SegmentedLineRec>;

  discountSchedule: ObjectRead<R.DiscountScheduleRec>;
  discountTier: ObjectRead<R.DiscountTierRec>;
  contractedPrice: ObjectRead<R.ContractedPriceRec>;

  approvalRule: ObjectRead<R.ApprovalRuleRec>;
  approvalCondition: ObjectRead<R.ApprovalConditionRec>;
  approvalChain: ObjectRead<R.NamedRec>;
  approver: ObjectRead<R.ApproverRec>;
  approvalVariable: ObjectRead<R.NamedRec>;
  trackedField: ObjectRead<R.NamedRec>;
  approvalHistory: ObjectRead<R.ApprovalHistoryRec>;
  processDefinition: ObjectRead<R.ProcessDefinitionRec>;
  processInstance: ObjectRead<R.ProcessInstanceRec>;

  quoteTemplate: ObjectRead<R.NamedRec>;
  templateSection: ObjectRead<R.TemplateSectionRec>;
  templateContent: ObjectRead<R.TemplateContentRec>;
  lineColumn: ObjectRead<R.LineColumnRec>;
  quoteTerm: ObjectRead<R.NamedRec>;
  termCondition: ObjectRead<R.TermConditionRec>;
  quoteLineGroupCount: number;
  quoteLineGroupAlive: number;

  contractActive: number;
  contractAlive: number;
  subscriptionCount: number;
  orderCount: number;
  assetCount: number;
  quotesByYear: YearCount[];
  quoteDateField: string;
  quotesInWindow: number;
  quoteLinesInWindow: number;
  distinctProductsQuoted: number;

  customScript: ObjectRead<R.CustomScriptRec>;
  customAction: ObjectRead<R.CustomActionRec>;
  apexTrigger: ObjectRead<R.ApexTriggerRec>;
  webLink: ObjectRead<R.WebLinkRec>;
  layout: ObjectRead<R.LayoutRec>;
  flexiPage: ObjectRead<R.FlexiPageRec>;
  validationRule: ObjectRead<R.ValidationRuleRec>;
  quoteFields: ObjectRead<R.FieldDefinitionRec>;
  quoteLineFields: ObjectRead<R.FieldDefinitionRec>;

  /** Creator ids that resolve to no User record — the package install signature. */
  seedCreators: Set<string>;
  /** Records per object created by a seed creator (removed from every count). */
  seeded: Record<string, number>;
  /** Objects that could not be read after retries, with the reason. */
  unread: { object: string; reason: string }[];
}

const monthsAgo = (now: Date, months: number): Date => {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
};

/** Objects CPQ seeds through its post-install process. Checked on every configuration object read. */
const SEED_CHECKED = [
  'Product2',
  'Pricebook2',
  'SBQQ__ProductFeature__c',
  'SBQQ__ProductOption__c',
  'SBQQ__OptionConstraint__c',
  'SBQQ__ConfigurationRule__c',
  'SBQQ__ConfigurationAttribute__c',
  'SBQQ__ProductRule__c',
  'SBQQ__QuoteProcess__c',
  'SBQQ__ProcessInput__c',
  'SBQQ__PriceRule__c',
  'SBQQ__SummaryVariable__c',
  'SBQQ__LookupQuery__c',
  'SBQQ__DiscountSchedule__c',
  'SBQQ__ContractedPrice__c',
  'SBQQ__Dimension__c',
  'SBQQ__BlockPrice__c',
  'sbaa__ApprovalRule__c',
  'sbaa__ApprovalChain__c',
  'sbaa__Approver__c',
  'sbaa__ApprovalVariable__c',
  'sbaa__TrackedField__c',
  'SBQQ__QuoteTemplate__c',
  'SBQQ__TemplateContent__c',
  'SBQQ__LineColumn__c',
  'SBQQ__QuoteTerm__c',
  'SBQQ__CustomScript__c',
  'SBQQ__CustomAction__c',
];

export async function extractAll(
  conn: OrgConnection,
  opts: ExtractOptions = {},
): Promise<Extraction> {
  const now = opts.now ?? new Date();
  const windowMonths = opts.windowMonths ?? 24;
  const since = soqlDate(monthsAgo(now, windowMonths));
  const approvalSince = soqlDate(monthsAgo(now, 12));
  const progress = opts.onProgress ?? (() => {});
  const unread: { object: string; reason: string }[] = [];
  const track = <T extends object>(read: ObjectRead<T>): ObjectRead<T> => {
    if (read.status === 'unread')
      unread.push({ object: read.object, reason: read.reason ?? 'unknown' });
    return read;
  };
  const step = async <T>(id: ProgressStep, fn: () => Promise<T>): Promise<T> => {
    progress({ step: id, status: 'start' });
    try {
      const out = await fn();
      progress({ step: id, status: 'done' });
      return out;
    } catch (err) {
      progress({
        step: id,
        status: 'error',
        detail: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
  const read = <T extends object>(
    object: string,
    fields: readonly string[],
    o: Parameters<typeof readObject>[3] = {},
  ) => readObject<T>(conn, object, fields, o).then(track);

  // ── Catalog ──────────────────────────────────────────────────────────────
  const catalog = await step('catalog', async () => ({
    product2: await read<R.Product2Rec>('Product2', R.PRODUCT2_FIELDS, {
      where: 'IsActive = true',
    }),
    pricebook2: await read<R.Pricebook2Rec>('Pricebook2', R.PRICEBOOK2_FIELDS),
    currencyType: await read<R.CurrencyTypeRec>('CurrencyType', R.CURRENCY_FIELDS, {
      optional: true,
    }),
    datedConversionRate: await read<R.DatedConversionRateRec>('DatedConversionRate', R.DCR_FIELDS, {
      optional: true,
    }),
  }));

  // ── Configuration (bundles + product rules, the first classifier input set) ──
  const configuration = await step('configuration', async () => ({
    productFeature: await read<R.ProductFeatureRec>('SBQQ__ProductFeature__c', R.FEATURE_FIELDS),
    productOption: await read<R.ProductOptionRec>('SBQQ__ProductOption__c', R.OPTION_FIELDS),
    optionConstraint: await read<R.OptionConstraintRec>(
      'SBQQ__OptionConstraint__c',
      R.CONSTRAINT_FIELDS,
    ),
    configurationRule: await read<R.ConfigurationRuleRec>(
      'SBQQ__ConfigurationRule__c',
      R.CONFIG_RULE_FIELDS,
    ),
    configurationAttribute: await read<R.ConfigurationAttributeRec>(
      'SBQQ__ConfigurationAttribute__c',
      R.ATTRIBUTE_FIELDS,
    ),
    productRule: await read<R.ProductRuleRec>('SBQQ__ProductRule__c', R.PRODUCT_RULE_FIELDS, {
      classifierInput: true,
    }),
    errorCondition: await read<R.ErrorConditionRec>(
      'SBQQ__ErrorCondition__c',
      R.ERROR_CONDITION_FIELDS,
      {
        classifierInput: true,
        orderBy: 'SBQQ__Rule__c, SBQQ__Index__c',
      },
    ),
    productAction: await read<R.ProductActionRec>(
      'SBQQ__ProductAction__c',
      R.PRODUCT_ACTION_FIELDS,
      {
        classifierInput: true,
      },
    ),
  }));

  // ── Discovery & capture ──────────────────────────────────────────────────
  const discovery = await step('discovery', async () => ({
    quoteProcess: await read<R.QuoteProcessRec>('SBQQ__QuoteProcess__c', R.QUOTE_PROCESS_FIELDS),
    processInput: await read<R.ProcessInputRec>('SBQQ__ProcessInput__c', R.PROCESS_INPUT_FIELDS),
    processInputCondition: await read<R.ProcessInputConditionRec>(
      'SBQQ__ProcessInputCondition__c',
      R.PROCESS_INPUT_CONDITION_FIELDS,
    ),
  }));

  // ── Price determination (price rules, the second classifier input set) ──
  const price = await step('price', async () => ({
    priceRule: await read<R.PriceRuleRec>('SBQQ__PriceRule__c', R.PRICE_RULE_FIELDS, {
      classifierInput: true,
    }),
    priceCondition: await read<R.PriceConditionRec>(
      'SBQQ__PriceCondition__c',
      R.PRICE_CONDITION_FIELDS,
      {
        classifierInput: true,
        orderBy: 'SBQQ__Rule__c, SBQQ__Index__c',
      },
    ),
    priceAction: await read<R.PriceActionRec>('SBQQ__PriceAction__c', R.PRICE_ACTION_FIELDS, {
      classifierInput: true,
      orderBy: 'SBQQ__Rule__c, SBQQ__Order__c',
    }),
    summaryVariable: await read<R.SummaryVariableRec>(
      'SBQQ__SummaryVariable__c',
      R.SUMMARY_VARIABLE_FIELDS,
    ),
    lookupQuery: await read<R.LookupQueryRec>('SBQQ__LookupQuery__c', R.LOOKUP_QUERY_FIELDS),
    blockPrice: await read<R.BlockPriceRec>('SBQQ__BlockPrice__c', R.BLOCK_PRICE_FIELDS),
    dimension: await read<R.DimensionRec>('SBQQ__Dimension__c', R.DIMENSION_FIELDS),
    segmentedLines: await read<R.SegmentedLineRec>('SBQQ__QuoteLine__c', R.SEGMENTED_LINE_FIELDS, {
      where: `SBQQ__Dimension__c != null AND LastModifiedDate >= ${since}`,
      orderBy: 'SBQQ__SegmentKey__c, SBQQ__SegmentIndex__c',
    }),
  }));

  // ── Discounting ─────────────────────────────────────────────────────────
  const discounting = await step('discounting', async () => ({
    discountSchedule: await read<R.DiscountScheduleRec>(
      'SBQQ__DiscountSchedule__c',
      R.DISCOUNT_SCHEDULE_FIELDS,
    ),
    discountTier: await read<R.DiscountTierRec>('SBQQ__DiscountTier__c', R.DISCOUNT_TIER_FIELDS, {
      orderBy: 'SBQQ__Schedule__c, SBQQ__Number__c',
    }),
    contractedPrice: await read<R.ContractedPriceRec>(
      'SBQQ__ContractedPrice__c',
      R.CONTRACTED_PRICE_FIELDS,
    ),
  }));

  // ── Guardrails (platform validation rules; product rules already read) ──
  const guardrails = await step('guardrails', async () => {
    const validationRule = await read<R.ValidationRuleRec>(
      'ValidationRule',
      R.VALIDATION_RULE_FIELDS,
      {
        where: 'NamespacePrefix = null',
        tooling: true,
      },
    );
    validationRule.records = validationRule.records.filter((v) =>
      R.isCpqObject(v.EntityDefinition?.QualifiedApiName ?? undefined),
    );
    validationRule.count = validationRule.records.length;
    return { validationRule };
  });

  // ── Approvals: Advanced Approvals (sbaa) and native processes ───────────
  const approvals = await step('approvals', async () => ({
    approvalRule: await read<R.ApprovalRuleRec>('sbaa__ApprovalRule__c', R.APPROVAL_RULE_FIELDS, {
      optional: true,
    }),
    approvalCondition: await read<R.ApprovalConditionRec>(
      'sbaa__ApprovalCondition__c',
      R.APPROVAL_CONDITION_FIELDS,
      {
        optional: true,
      },
    ),
    approvalChain: await read<R.NamedRec>('sbaa__ApprovalChain__c', R.NAMED_FIELDS, {
      optional: true,
    }),
    approver: await read<R.ApproverRec>('sbaa__Approver__c', R.APPROVER_FIELDS, { optional: true }),
    approvalVariable: await read<R.NamedRec>('sbaa__ApprovalVariable__c', R.NAMED_FIELDS, {
      optional: true,
    }),
    trackedField: await read<R.NamedRec>('sbaa__TrackedField__c', R.NAMED_FIELDS, {
      optional: true,
    }),
    approvalHistory: await read<R.ApprovalHistoryRec>(
      'sbaa__Approval__c',
      R.APPROVAL_HISTORY_FIELDS,
      {
        optional: true,
        where: `CreatedDate >= ${approvalSince}`,
      },
    ),
    processDefinition: await read<R.ProcessDefinitionRec>(
      'ProcessDefinition',
      R.PROCESS_DEFINITION_FIELDS,
      {
        where: "Type = 'Approval' AND TableEnumOrId IN ('SBQQ__Quote__c', 'Opportunity')",
      },
    ),
    processInstance: await read<R.ProcessInstanceRec>(
      'ProcessInstance',
      R.PROCESS_INSTANCE_FIELDS,
      {
        where: `CreatedDate >= ${approvalSince} AND ProcessDefinition.TableEnumOrId IN ('SBQQ__Quote__c', 'Opportunity')`,
      },
    ),
  }));

  // ── Quote output ────────────────────────────────────────────────────────
  const output = await step('output', async () => ({
    quoteTemplate: await read<R.NamedRec>('SBQQ__QuoteTemplate__c', R.NAMED_FIELDS),
    templateSection: await read<R.TemplateSectionRec>(
      'SBQQ__TemplateSection__c',
      R.TEMPLATE_SECTION_FIELDS,
    ),
    templateContent: await read<R.TemplateContentRec>(
      'SBQQ__TemplateContent__c',
      R.TEMPLATE_CONTENT_FIELDS,
    ),
    lineColumn: await read<R.LineColumnRec>('SBQQ__LineColumn__c', R.LINE_COLUMN_FIELDS),
    quoteTerm: await read<R.NamedRec>('SBQQ__QuoteTerm__c', R.NAMED_FIELDS),
    termCondition: await read<R.TermConditionRec>(
      'SBQQ__TermCondition__c',
      R.TERM_CONDITION_FIELDS,
    ),
    quoteLineGroupCount: await safeCount(conn, 'SBQQ__QuoteLineGroup__c'),
    quoteLineGroupAlive: await safeCount(
      conn,
      'SBQQ__QuoteLineGroup__c',
      `LastModifiedDate >= ${since}`,
    ),
  }));

  // ── Contract lifecycle + volume ─────────────────────────────────────────
  const lifecycle = await step('lifecycle', async () => {
    const quoteDateField = await pickQuoteDateField(conn);
    const dateExpr = quoteDateField === 'CreatedDate' ? 'CreatedDate' : quoteDateField;
    const byYear = await aggregate<{ y: number; t: string | null; c: number }>(
      conn,
      `SELECT CALENDAR_YEAR(${dateExpr}) y, SBQQ__Type__c t, COUNT(Id) c FROM SBQQ__Quote__c GROUP BY CALENDAR_YEAR(${dateExpr}), SBQQ__Type__c`,
    );
    const sinceDate = since.slice(0, 10);
    const windowWhere =
      quoteDateField === 'CreatedDate'
        ? `CreatedDate >= ${since}`
        : `${quoteDateField} >= ${sinceDate}`;
    const distinct = await aggregate<{ n: number }>(
      conn,
      `SELECT COUNT_DISTINCT(SBQQ__Product__c) n FROM SBQQ__QuoteLine__c WHERE SBQQ__Quote__r.${windowWhere}`,
    );
    return {
      contractActive: await safeCount(conn, 'Contract', "Status = 'Activated'"),
      contractAlive: await safeCount(
        conn,
        'Contract',
        `Status = 'Activated' AND LastModifiedDate >= ${since}`,
      ),
      subscriptionCount: await safeCount(conn, 'SBQQ__Subscription__c'),
      orderCount: await safeCount(conn, 'Order', 'SBQQ__Quote__c != null'),
      assetCount: await safeCount(conn, 'Asset'),
      quotesByYear: byYear.rows
        .filter((r) => r.y != null)
        .map((r) => ({ year: Number(r.y), type: r.t ?? 'Quote', count: Number(r.c) })),
      quoteDateField,
      quotesInWindow: await safeCount(conn, 'SBQQ__Quote__c', windowWhere),
      quoteLinesInWindow: await safeCount(
        conn,
        'SBQQ__QuoteLine__c',
        `SBQQ__Quote__r.${windowWhere}`,
      ),
      distinctProductsQuoted: Number(distinct.rows[0]?.n ?? 0),
    };
  });

  // ── Custom code & UI ────────────────────────────────────────────────────
  const code = await step('code', async () => {
    const apexTrigger = await read<R.ApexTriggerRec>('ApexTrigger', R.APEX_TRIGGER_FIELDS, {
      where: 'NamespacePrefix = null',
    });
    apexTrigger.records = apexTrigger.records.filter((t) => R.isCpqObject(t.TableEnumOrId));
    apexTrigger.count = apexTrigger.records.length;

    const webLink = await read<R.WebLinkRec>('WebLink', R.WEBLINK_FIELDS, {
      where: 'NamespacePrefix = null',
      tooling: true,
    });
    webLink.records = webLink.records.filter((w) =>
      R.isCpqObject(w.PageOrSobjectType ?? undefined),
    );
    webLink.count = webLink.records.length;

    const layout = await read<R.LayoutRec>('Layout', R.LAYOUT_FIELDS, {
      where: 'NamespacePrefix = null',
      tooling: true,
    });
    layout.records = layout.records.filter((l) => R.isCpqObject(l.TableEnumOrId ?? undefined));
    layout.count = layout.records.length;

    const flexiPage = await read<R.FlexiPageRec>('FlexiPage', R.FLEXIPAGE_FIELDS, {
      where: "NamespacePrefix = null AND Type = 'RecordPage'",
      tooling: true,
    });
    flexiPage.records = flexiPage.records.filter((f) =>
      R.isCpqObject(f.EntityDefinitionId ?? undefined),
    );
    flexiPage.count = flexiPage.records.length;

    return {
      customScript: await read<R.CustomScriptRec>('SBQQ__CustomScript__c', R.CUSTOM_SCRIPT_FIELDS),
      customAction: await read<R.CustomActionRec>('SBQQ__CustomAction__c', R.CUSTOM_ACTION_FIELDS),
      apexTrigger,
      webLink,
      layout,
      flexiPage,
      quoteFields: await read<R.FieldDefinitionRec>('FieldDefinition', R.FIELD_DEFINITION_FIELDS, {
        where: "EntityDefinition.QualifiedApiName = 'SBQQ__Quote__c'",
      }),
      quoteLineFields: await read<R.FieldDefinitionRec>(
        'FieldDefinition',
        R.FIELD_DEFINITION_FIELDS,
        {
          where: "EntityDefinition.QualifiedApiName = 'SBQQ__QuoteLine__c'",
        },
      ),
    };
  });

  const partial: Omit<Extraction, 'seedCreators' | 'seeded'> = {
    windowMonths,
    since,
    approvalSince,
    now: now.toISOString(),
    ...catalog,
    ...configuration,
    ...discovery,
    ...price,
    ...discounting,
    ...guardrails,
    ...approvals,
    ...output,
    ...lifecycle,
    ...code,
    unread,
  };

  // ── Package seed detection, applied to every configuration object ───────
  const { seedCreators, seeded } = await step('seed', () => detectSeeds(conn, partial));
  return { ...partial, seedCreators, seeded };
}

async function safeCount(conn: OrgConnection, object: string, where?: string): Promise<number> {
  try {
    return await count(conn, object, where);
  } catch {
    return 0;
  }
}

/** Business date for quote volume: StartDate, then ExpirationDate, then CreatedDate. Prints which. */
export async function pickQuoteDateField(conn: OrgConnection): Promise<string> {
  const total = await safeCount(conn, 'SBQQ__Quote__c');
  if (total === 0) return 'CreatedDate';
  for (const field of ['SBQQ__StartDate__c', 'SBQQ__ExpirationDate__c']) {
    const populated = await safeCount(conn, 'SBQQ__Quote__c', `${field} != null`);
    if (populated / total >= 0.5) return field;
  }
  return 'CreatedDate';
}

/**
 * For each configuration object, group by CreatedById. A creator that resolves to no User record is
 * the package install user; its records are seed data, reported separately and never given a verdict.
 */
export async function detectSeeds(
  conn: OrgConnection,
  ex: Omit<Extraction, 'seedCreators' | 'seeded'>,
): Promise<{ seedCreators: Set<string>; seeded: Record<string, number> }> {
  const groups = new Map<string, { creator: string; n: number }[]>();
  const creators = new Set<string>();
  for (const object of SEED_CHECKED) {
    const read = readFor(ex, object);
    if (read?.status !== 'ok' || read.count === 0) continue;
    const res = await aggregate<{ CreatedById: string; n: number }>(
      conn,
      `SELECT CreatedById, COUNT(Id) n FROM ${object} GROUP BY CreatedById`,
    );
    const rows = res.rows
      .filter((r) => r.CreatedById)
      .map((r) => ({ creator: r.CreatedById, n: Number(r.n) }));
    groups.set(object, rows);
    for (const r of rows) creators.add(r.creator);
  }
  const seedCreators = new Set<string>();
  if (creators.size) {
    const resolved = new Set<string>();
    const ids = [...creators];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const users = await aggregate<{ Id: string }>(
        conn,
        `SELECT Id FROM User WHERE Id IN ${inList(chunk)}`,
      );
      if (users.status !== 'ok') return { seedCreators, seeded: {} };
      for (const u of users.rows) resolved.add(u.Id);
    }
    for (const id of creators) if (!resolved.has(id)) seedCreators.add(id);
  }
  const seeded: Record<string, number> = {};
  for (const [object, rows] of groups) {
    const n = rows.filter((r) => seedCreators.has(r.creator)).reduce((a, r) => a + r.n, 0);
    if (n > 0) seeded[object] = n;
    const read = readFor(ex, object);
    if (read && n > 0) {
      read.records = read.records.filter(
        (rec) => !seedCreators.has(String((rec as R.Audited).CreatedById ?? '')),
      );
      read.count = Math.max(0, read.count - n);
    }
  }
  return { seedCreators, seeded };
}

function readFor(
  ex: Omit<Extraction, 'seedCreators' | 'seeded'>,
  object: string,
): ObjectRead<R.Audited> | undefined {
  const map: Record<string, ObjectRead<R.Audited> | undefined> = {
    Product2: ex.product2,
    Pricebook2: ex.pricebook2,
    SBQQ__ProductFeature__c: ex.productFeature,
    SBQQ__ProductOption__c: ex.productOption,
    SBQQ__OptionConstraint__c: ex.optionConstraint,
    SBQQ__ConfigurationRule__c: ex.configurationRule,
    SBQQ__ConfigurationAttribute__c: ex.configurationAttribute,
    SBQQ__ProductRule__c: ex.productRule,
    SBQQ__QuoteProcess__c: ex.quoteProcess,
    SBQQ__ProcessInput__c: ex.processInput,
    SBQQ__PriceRule__c: ex.priceRule,
    SBQQ__SummaryVariable__c: ex.summaryVariable,
    SBQQ__LookupQuery__c: ex.lookupQuery,
    SBQQ__DiscountSchedule__c: ex.discountSchedule,
    SBQQ__ContractedPrice__c: ex.contractedPrice,
    SBQQ__Dimension__c: ex.dimension,
    SBQQ__BlockPrice__c: ex.blockPrice,
    sbaa__ApprovalRule__c: ex.approvalRule,
    sbaa__ApprovalChain__c: ex.approvalChain,
    sbaa__Approver__c: ex.approver,
    sbaa__ApprovalVariable__c: ex.approvalVariable,
    sbaa__TrackedField__c: ex.trackedField,
    SBQQ__QuoteTemplate__c: ex.quoteTemplate,
    SBQQ__TemplateContent__c: ex.templateContent,
    SBQQ__LineColumn__c: ex.lineColumn,
    SBQQ__QuoteTerm__c: ex.quoteTerm,
    SBQQ__CustomScript__c: ex.customScript,
    SBQQ__CustomAction__c: ex.customAction,
  };
  return map[object];
}

export { quote };

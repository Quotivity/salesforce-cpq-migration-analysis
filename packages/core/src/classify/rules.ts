import type { BucketId, ReviewReason, Shape, Verdict } from '../types.js';

/**
 * The spec's classification table as data. The discriminator row — not the object — is the unit of
 * counting and the unit a verdict attaches to. Each record gets one primary row (counted once) and
 * may be cross-listed to a secondary row (shown twice, counted once).
 */
export type RowId =
  | 'cat.products'
  | 'cat.pricebooks'
  | 'cat.currencies'
  | 'cat.dcrStatic'
  | 'cat.dcrTable'
  | 'cfg.features'
  | 'cfg.featurePickOne'
  | 'cfg.featurePickMany'
  | 'cfg.featureCap'
  | 'cfg.optionsPlain'
  | 'cfg.optionsNested'
  | 'cfg.configRules'
  | 'cfg.constraintExclusion'
  | 'cfg.constraintDepSatisfied'
  | 'cfg.constraintDepOther'
  | 'cfg.selectionRules'
  | 'cfg.filterRules'
  | 'cfg.actionSwap'
  | 'cfg.actionRemoveNoReplacement'
  | 'cfg.lookupProductRule'
  | 'cfg.priceRuleConfigurator'
  | 'disc.attributesGuided'
  | 'disc.attributesOnOptions'
  | 'disc.quoteProcesses'
  | 'disc.processInputs'
  | 'disc.priceRulesDefaulting'
  | 'price.costPlus'
  | 'price.percentOfTotal'
  | 'price.block'
  | 'price.attributeDriven'
  | 'price.priceRulesPrice'
  | 'price.actionsOverLimit'
  | 'price.actionsQuoteRollup'
  | 'price.actionsQuoteArbitrary'
  | 'price.subscriptionUnbundled'
  | 'price.subscriptionBundled'
  | 'price.usage'
  | 'price.mdqSame'
  | 'price.mdqDiffering'
  | 'price.lookupPriceRule'
  | 'sv.plain'
  | 'sv.constraint'
  | 'sv.composite'
  | 'sv.productOption'
  | 'sv.asset'
  | 'dsc.perLine'
  | 'dsc.quoteScope'
  | 'dsc.groupScope'
  | 'dsc.slab'
  | 'dsc.contractedPrices'
  | 'dsc.priceRulesDiscount'
  | 'grd.validation'
  | 'grd.alert'
  | 'grd.quoteScope'
  | 'grd.floorCeiling'
  | 'grd.customLogic'
  | 'grd.platformValidation'
  | 'grd.productFlags'
  | 'grd.groupGated'
  | 'apr.rules'
  | 'apr.derivedApprover'
  | 'apr.chains'
  | 'apr.trackedFields'
  | 'apr.variables'
  | 'apr.native'
  | 'out.templates'
  | 'out.lineColumns'
  | 'out.terms'
  | 'out.termConditions'
  | 'out.groups'
  | 'life.contracts'
  | 'life.amendRenew'
  | 'life.ordersAssets'
  | 'code.qcp'
  | 'code.triggers'
  | 'code.customActions'
  | 'code.ui';

export interface RuleRow {
  id: RowId;
  /** Row label in the admin's vocabulary, as rendered in the bucket breakdown. */
  label: string;
  source: string;
  discriminator: string;
  /** Primary bucket. `follows` means the record lands in the bucket of the rule that consumes it. */
  bucket: BucketId | 'follows';
  /** Second bucket the row is also shown under, with a cross-reference marker. */
  crossBucket?: BucketId;
  lands: string;
  verdict: Verdict;
  shape?: Shape;
  review?: ReviewReason;
  /** Unit printed after the count when it is not the row's own record ("14 products"). */
  unit?: string;
  /** Stage 2 mapping row this classification row rolls up to. */
  mapping: string;
}

const row = (r: RuleRow): RuleRow => r;

export const RULE_ROWS: readonly RuleRow[] = [
  // ── Catalog ─────────────────────────────────────────────────────────────
  row({
    id: 'cat.products',
    label: 'Active products',
    source: 'Product2',
    discriminator: 'active',
    bucket: 'catalog',
    lands: 'HubSpot product',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'catalog.products',
  }),
  row({
    id: 'cat.pricebooks',
    label: 'Price books',
    source: 'Pricebook2',
    discriminator: '—',
    bucket: 'catalog',
    lands: 'Quotivity price book',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'catalog.products',
  }),
  row({
    id: 'cat.currencies',
    label: 'Enabled currencies',
    source: 'CurrencyType',
    discriminator: 'more than one enabled',
    bucket: 'catalog',
    lands: 'Price book entry prices per enabled portal currency',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'catalog.multicurrency',
  }),
  row({
    id: 'cat.dcrStatic',
    label: 'Dated conversion rates, one period per currency',
    source: 'DatedConversionRate',
    discriminator: 'one rate period per currency',
    bucket: 'catalog',
    lands: 'A manually set exchange rate — equivalent to a static rate',
    verdict: 'Clear path',
    shape: '1:1',
    unit: 'currencies',
    mapping: 'catalog.dcrStatic',
  }),
  row({
    id: 'cat.dcrTable',
    label: 'Dated conversion rates, maintained rate table',
    source: 'DatedConversionRate',
    discriminator: 'multiple maintained rate periods per currency',
    bucket: 'catalog',
    lands:
      'HubSpot holds one current rate per currency. There is no way to author a rate for a named past or future period',
    verdict: 'Degraded',
    unit: 'currencies',
    mapping: 'catalog.dcrTable',
  }),

  // ── Configuration ───────────────────────────────────────────────────────
  row({
    id: 'cfg.features',
    label: 'Bundle options (CPQ product features), optional selection',
    source: 'SBQQ__ProductFeature__c',
    discriminator: 'no selection minimum',
    bucket: 'configuration',
    lands: 'Bundle option',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.bundles',
  }),
  row({
    id: 'cfg.featurePickOne',
    label: 'Features — pick one',
    source: 'SBQQ__ProductFeature__c',
    discriminator: 'MinOptionCount = 1, MaxOptionCount = 1',
    bucket: 'configuration',
    lands: 'Included option with a default product — "Pick one"',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.minMax',
  }),
  row({
    id: 'cfg.featurePickMany',
    label: 'Features — pick one or more',
    source: 'SBQQ__ProductFeature__c',
    discriminator: 'MinOptionCount = 1, MaxOptionCount blank',
    bucket: 'configuration',
    lands: 'Included option, allow multiple — "Pick one or more"',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.minMax',
  }),
  row({
    id: 'cfg.featureCap',
    label: 'Features with a numeric option cap',
    source: 'SBQQ__ProductFeature__c',
    discriminator: 'MinOptionCount > 1, or MaxOptionCount is a finite number > 1',
    bucket: 'configuration',
    lands: 'Allow-multiple, plus roll-up + Block to enforce the count',
    verdict: 'Degraded',
    mapping: 'configuration.minMax',
  }),
  row({
    id: 'cfg.optionsPlain',
    label: 'Option products, not configurable',
    source: 'SBQQ__ProductOption__c',
    discriminator: 'OptionalSKU is not configurable',
    bucket: 'configuration',
    lands: 'Option product',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.bundles',
  }),
  row({
    id: 'cfg.optionsNested',
    label: 'Option products that are themselves bundles',
    source: 'SBQQ__ProductOption__c',
    discriminator: 'OptionalSKU is itself configurable',
    bucket: 'configuration',
    lands: '—',
    verdict: 'No target',
    mapping: 'configuration.nested',
  }),
  row({
    id: 'cfg.configRules',
    label: 'Configuration rules',
    source: 'SBQQ__ConfigurationRule__c',
    discriminator: '—',
    bucket: 'configuration',
    lands: 'Absorbed — scope is implicit, since Compatibility Rules execute within the bundle',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.bundles',
  }),
  row({
    id: 'cfg.constraintExclusion',
    label: 'Option constraints — exclusion',
    source: 'SBQQ__OptionConstraint__c',
    discriminator: 'Type = Exclusion',
    bucket: 'configuration',
    lands: 'Compatibility Rule (Incompatible)',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.exclusion',
  }),
  row({
    id: 'cfg.constraintDepSatisfied',
    label: 'Option constraints — dependency, already satisfied',
    source: 'SBQQ__OptionConstraint__c',
    discriminator: 'Type = Dependency, required option is on an included option with a default',
    bucket: 'configuration',
    lands: 'Already satisfied — the option is always present',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.dependency',
  }),
  row({
    id: 'cfg.constraintDepOther',
    label: 'Option constraints — dependency, any other shape',
    source: 'SBQQ__OptionConstraint__c',
    discriminator: 'Type = Dependency, any other shape',
    bucket: 'configuration',
    lands: 'Add add-on bundle product, or Block',
    verdict: 'Degraded',
    mapping: 'configuration.dependency',
  }),
  row({
    id: 'cfg.selectionRules',
    label: 'Selection rules',
    source: 'SBQQ__ProductRule__c',
    discriminator: 'Type = Selection',
    bucket: 'configuration',
    lands: 'Add add-on bundle product / Swap bundle product',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.bundles',
  }),
  row({
    id: 'cfg.filterRules',
    label: 'Filter rules — dynamic option sets',
    source: 'SBQQ__ProductRule__c',
    discriminator: 'Type = Filter',
    bucket: 'configuration',
    lands: '—',
    verdict: 'No target',
    mapping: 'configuration.filter',
  }),
  row({
    id: 'cfg.actionSwap',
    label: 'Remove or disable actions with a replacement',
    source: 'SBQQ__ProductAction__c',
    discriminator: 'Type contains Remove or Disable, replacement exists in the option',
    bucket: 'configuration',
    lands: 'Swap bundle product',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'configuration.bundles',
  }),
  row({
    id: 'cfg.actionRemoveNoReplacement',
    label: 'Remove or disable actions with no replacement',
    source: 'SBQQ__ProductAction__c',
    discriminator: 'Type contains Remove or Disable, no replacement',
    bucket: 'configuration',
    lands: '—',
    verdict: 'No target',
    mapping: 'configuration.nested',
  }),
  row({
    id: 'cfg.lookupProductRule',
    label: 'Lookup queries on a product rule',
    source: 'SBQQ__LookupQuery__c',
    discriminator: 'on a product rule',
    bucket: 'configuration',
    crossBucket: 'code',
    lands: 'Depends on the custom object behind them, which the tool cannot read',
    verdict: 'Further review',
    review: 'Unread',
    mapping: 'configuration.lookup',
  }),
  row({
    id: 'cfg.priceRuleConfigurator',
    label: 'Price rules evaluated in the configurator',
    source: 'SBQQ__PriceRule__c',
    discriminator: 'TargetObject = Configurator',
    bucket: 'configuration',
    lands:
      'Compatibility Rules and Dynamic Property Sets evaluate in the configurator; pricing does not resolve until the bundle lands on the quote',
    verdict: 'Degraded',
    mapping: 'configuration.dependency',
  }),

  // ── Discovery & capture ─────────────────────────────────────────────────
  row({
    id: 'disc.attributesGuided',
    label: 'Attributes not applied to product options',
    source: 'SBQQ__ConfigurationAttribute__c',
    discriminator: 'not applied to product options',
    bucket: 'discovery',
    lands: 'Guided Selling question',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'discovery.attributes',
  }),
  row({
    id: 'disc.attributesOnOptions',
    label: 'Attributes applied to product options',
    source: 'SBQQ__ConfigurationAttribute__c',
    discriminator: 'applied to product options',
    bucket: 'discovery',
    crossBucket: 'configuration',
    lands: 'Bundle header property + Update Bundle Members',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'discovery.attributes',
  }),
  row({
    id: 'disc.quoteProcesses',
    label: 'Quote processes',
    source: 'SBQQ__QuoteProcess__c',
    discriminator: '—',
    bucket: 'discovery',
    lands: 'Guided Selling flow',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'discovery.guided',
  }),
  row({
    id: 'disc.processInputs',
    label: 'Process inputs',
    source: 'SBQQ__ProcessInput__c',
    discriminator: '—',
    bucket: 'discovery',
    lands: 'Guided Selling questions',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'discovery.guided',
  }),
  row({
    id: 'disc.priceRulesDefaulting',
    label: 'Price rules writing a non-money field',
    source: 'SBQQ__PriceRule__c',
    discriminator: 'actions write a non-money field',
    bucket: 'discovery',
    lands: 'Update Line Items',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'discovery.attributes',
  }),

  // ── Price determination (counts mechanisms) ─────────────────────────────
  row({
    id: 'price.costPlus',
    label: 'Cost-plus pricing',
    source: 'Product2',
    discriminator: 'PricingMethod = Cost',
    bucket: 'price',
    lands: 'Calculated pricing formula',
    verdict: 'Clear path',
    shape: 'Fan-out',
    unit: 'products',
    mapping: 'price.calculated',
  }),
  row({
    id: 'price.percentOfTotal',
    label: 'Percent-of-total pricing',
    source: 'Product2',
    discriminator: 'PricingMethod = Percent Of Total',
    bucket: 'price',
    lands: 'Roll-up + calculated pricing formula',
    verdict: 'Clear path',
    shape: 'Fan-out',
    unit: 'products',
    mapping: 'price.calculated',
  }),
  row({
    id: 'price.block',
    label: 'Block pricing',
    source: 'Product2',
    discriminator: 'PricingMethod = Block, or BlockPrice__c rows',
    bucket: 'price',
    lands: 'Calculated pricing formula',
    verdict: 'Clear path',
    shape: 'Fan-out',
    unit: 'products',
    mapping: 'price.calculated',
  }),
  row({
    id: 'price.attributeDriven',
    label: 'Attribute-driven price',
    source: 'SBQQ__PriceRule__c',
    discriminator: 'price written from a configuration attribute',
    bucket: 'price',
    lands: 'Pricing table (value or range), or product variants',
    verdict: 'Clear path',
    shape: '1:1',
    unit: 'rules',
    mapping: 'price.tiers',
  }),
  row({
    id: 'price.priceRulesPrice',
    label: 'Price rules writing a price field',
    source: 'SBQQ__PriceRule__c',
    discriminator: 'actions write unit / list / net price, or a price formula',
    bucket: 'price',
    lands: 'Calculated pricing formula',
    verdict: 'Clear path',
    shape: 'Fan-out',
    unit: 'rules',
    mapping: 'price.calculated',
  }),
  row({
    id: 'price.actionsOverLimit',
    label: 'Price actions over the formula limits',
    source: 'SBQQ__PriceAction__c',
    discriminator:
      'formula outside the supported grammar, or over the IF / length / nesting limits',
    bucket: 'price',
    lands: '—',
    verdict: 'No target',
    mapping: 'price.term',
  }),
  row({
    id: 'price.actionsQuoteRollup',
    label: 'Summary variables rolled up to the quote',
    source: 'SBQQ__PriceAction__c',
    discriminator: 'TargetObject = Quote, SourceVariable populated',
    bucket: 'price',
    lands: 'Roll-up, which writes its result to the quote',
    verdict: 'Clear path',
    shape: 'Fan-out',
    mapping: 'price.calculated',
  }),
  row({
    id: 'price.actionsQuoteArbitrary',
    label: 'Price actions writing an arbitrary quote field',
    source: 'SBQQ__PriceAction__c',
    discriminator: 'TargetObject = Quote, SourceVariable empty',
    bucket: 'price',
    lands: '— no outcome writes an arbitrary quote property',
    verdict: 'No target',
    mapping: 'price.term',
  }),
  row({
    id: 'price.subscriptionUnbundled',
    label: 'Subscription term, not a bundle option',
    source: 'Product2',
    discriminator: 'SubscriptionPricing, SubscriptionTerm, not a bundle option',
    bucket: 'price',
    crossBucket: 'lifecycle',
    lands: 'Ramp pricing',
    verdict: 'Degraded',
    unit: 'products',
    mapping: 'price.mdq',
  }),
  row({
    id: 'price.subscriptionBundled',
    label: 'Subscription term on a bundle header or option',
    source: 'Product2',
    discriminator: 'SubscriptionPricing, and the product is a bundle header or option product',
    bucket: 'price',
    crossBucket: 'lifecycle',
    lands:
      'Stepped periods built with Update Bundle Members rules — the Ramp Pricing feature itself cannot be applied to a bundle',
    verdict: 'Degraded',
    unit: 'products',
    mapping: 'price.mdq',
  }),
  row({
    id: 'price.usage',
    label: 'Usage-based charge type',
    source: 'Product2',
    discriminator: 'ChargeType = Usage',
    bucket: 'price',
    lands: '—',
    verdict: 'No target',
    unit: 'products',
    mapping: 'price.term',
  }),
  row({
    id: 'price.mdqSame',
    label: 'MDQ segments, same quantity every segment',
    source: 'SBQQ__Dimension__c',
    discriminator: 'MDQ segments, same quantity in every segment',
    bucket: 'price',
    lands: 'Ramp pricing; Update Bundle Members rules when the product is bundled',
    verdict: 'Clear path',
    shape: '1:1',
    unit: 'dimensions',
    mapping: 'price.mdq',
  }),
  row({
    id: 'price.mdqDiffering',
    label: 'MDQ segments with differing quantities',
    source: 'SBQQ__Dimension__c',
    discriminator: 'MDQ segments with differing quantities',
    bucket: 'price',
    lands: 'Quantity is locked across ramp periods — stepped quantity does not carry',
    verdict: 'Degraded',
    unit: 'dimensions',
    mapping: 'price.mdq',
  }),
  row({
    id: 'price.lookupPriceRule',
    label: 'Lookup queries on a price rule',
    source: 'SBQQ__LookupQuery__c',
    discriminator: 'on a price rule',
    bucket: 'price',
    crossBucket: 'code',
    lands:
      'Depends on the custom object behind it, and custom object values cannot be inputs to a pricing formula',
    verdict: 'Further review',
    review: 'Unread',
    mapping: 'price.lookup',
  }),

  // ── Summary variables (follow the rule that uses them) ──────────────────
  row({
    id: 'sv.plain',
    label: 'Summary variables over quote lines',
    source: 'SBQQ__SummaryVariable__c',
    discriminator: 'TargetObject = Quote Line, no constraint field',
    bucket: 'follows',
    lands: 'Roll-up field, with conditions when FilterField is set',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'price.calculated',
  }),
  row({
    id: 'sv.constraint',
    label: 'Summary variables constrained to a quote value',
    source: 'SBQQ__SummaryVariable__c',
    discriminator: 'ConstraintField populated',
    bucket: 'follows',
    lands:
      'Roll-up conditions compare a line property to a static value, not to a quote property. Needs Update Line Items to stamp the quote value onto lines first, then filter on it',
    verdict: 'Degraded',
    mapping: 'price.mdq',
  }),
  row({
    id: 'sv.composite',
    label: 'Composite summary variables',
    source: 'SBQQ__SummaryVariable__c',
    discriminator: 'CombineWith or ValueElement populated',
    bucket: 'follows',
    lands: 'Two roll-ups, composed in a calculated pricing formula',
    verdict: 'Clear path',
    shape: 'Fan-out',
    mapping: 'price.calculated',
  }),
  row({
    id: 'sv.productOption',
    label: 'Summary variables over product options',
    source: 'SBQQ__SummaryVariable__c',
    discriminator: 'TargetObject = Product Option',
    bucket: 'follows',
    lands: 'Aggregates catalog records at configuration time; roll-ups aggregate quote lines',
    verdict: 'Degraded',
    mapping: 'configuration.dependency',
  }),
  row({
    id: 'sv.asset',
    label: 'Summary variables over assets or subscriptions',
    source: 'SBQQ__SummaryVariable__c',
    discriminator: 'TargetObject = Asset or Subscription, or Scope = Assets',
    bucket: 'follows',
    lands: '— no asset model',
    verdict: 'No target',
    mapping: 'lifecycle.orders',
  }),

  // ── Discounting ─────────────────────────────────────────────────────────
  row({
    id: 'dsc.perLine',
    label: 'Per-line schedules',
    source: 'SBQQ__DiscountSchedule__c',
    discriminator: 'on Product2 or ProductOption, per-line',
    bucket: 'discounting',
    lands: 'Volume pricing tiers',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'discounting.tiers',
  }),
  row({
    id: 'dsc.quoteScope',
    label: 'Schedules aggregating across the quote',
    source: 'SBQQ__DiscountSchedule__c',
    discriminator: 'AggregationScope = Quote',
    bucket: 'discounting',
    lands: 'Quote-wide roll-up, then a calculated pricing formula over it',
    verdict: 'Clear path',
    shape: 'Fan-out',
    mapping: 'discounting.quote',
  }),
  row({
    id: 'dsc.groupScope',
    label: 'Schedules aggregating across a quote line group',
    source: 'SBQQ__DiscountSchedule__c',
    discriminator: 'AggregationScope = Group',
    bucket: 'discounting',
    lands:
      'Roll-ups aggregate quote-wide or per bundle. Line item grouping is a template display feature and carries no functional aggregate',
    verdict: 'Degraded',
    mapping: 'discounting.group',
  }),
  row({
    id: 'dsc.slab',
    label: 'Slab-type schedules',
    source: 'SBQQ__DiscountSchedule__c',
    discriminator: 'Type = Slab',
    bucket: 'discounting',
    lands: 'Volume tiers, converted to per-unit',
    verdict: 'Degraded',
    mapping: 'discounting.tiers',
  }),
  row({
    id: 'dsc.contractedPrices',
    label: 'Contracted prices',
    source: 'SBQQ__ContractedPrice__c',
    discriminator: '—',
    bucket: 'discounting',
    lands: 'Price book assigned to a company',
    verdict: 'Clear path',
    shape: 'Fan-out',
    mapping: 'discounting.contracted',
  }),
  row({
    id: 'dsc.priceRulesDiscount',
    label: 'Price rules writing a discount or markup field',
    source: 'SBQQ__PriceRule__c',
    discriminator: 'actions write a discount or markup field',
    bucket: 'discounting',
    lands: 'Volume tiers or Add One-time Discount',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'discounting.tiers',
  }),

  // ── Guardrails ──────────────────────────────────────────────────────────
  row({
    id: 'grd.validation',
    label: 'Validation rules',
    source: 'SBQQ__ProductRule__c',
    discriminator: 'Type = Validation',
    bucket: 'guardrails',
    lands: 'Block outcome',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'guardrails.validation',
  }),
  row({
    id: 'grd.alert',
    label: 'Alert rules',
    source: 'SBQQ__ProductRule__c',
    discriminator: 'Type = Alert',
    bucket: 'guardrails',
    lands: 'Notify outcome',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'guardrails.alert',
  }),
  row({
    id: 'grd.quoteScope',
    label: 'Quote-scope rules, no bundle context',
    source: 'SBQQ__ProductRule__c',
    discriminator: 'Scope = Quote, no bundle context',
    bucket: 'guardrails',
    lands: 'Block or Require Approval outcome',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'guardrails.validation',
  }),
  row({
    id: 'grd.floorCeiling',
    label: 'Floors and ceilings via price rules',
    source: 'SBQQ__PriceRule__c',
    discriminator: 'actions write a field a validation rule then tests',
    bucket: 'guardrails',
    lands: 'Roll-up + Block outcome',
    verdict: 'Clear path',
    shape: 'Fan-out',
    mapping: 'guardrails.validation',
  }),
  row({
    id: 'grd.customLogic',
    label: 'Custom boolean condition logic on a rule',
    source: 'SBQQ__ProductRule__c, SBQQ__PriceRule__c',
    discriminator: 'ConditionsMet = Custom',
    bucket: 'guardrails',
    lands: 'Condition groups, the expression expanded to disjunctive normal form',
    verdict: 'Clear path',
    shape: 'Fan-out',
    mapping: 'guardrails.custom',
  }),
  row({
    id: 'grd.platformValidation',
    label: 'Platform validation rules on CPQ objects',
    source: 'ValidationRule',
    discriminator: 'on an SBQQ object, NamespacePrefix null',
    bucket: 'guardrails',
    crossBucket: 'code',
    lands: 'Block outcome',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'guardrails.validation',
  }),
  row({
    id: 'grd.productFlags',
    label: 'Non-discountable / not price-editable',
    source: 'Product2',
    discriminator: 'NonDiscountable, PriceEditable = false',
    bucket: 'guardrails',
    lands: 'Price book unit price editability',
    verdict: 'Clear path',
    shape: '1:1',
    unit: 'products',
    mapping: 'guardrails.flags',
  }),
  row({
    id: 'grd.groupGated',
    label: 'Rules and schedules gating on a quote line group',
    source: 'SBQQ__QuoteLineGroup__c',
    discriminator: 'referenced by a discount schedule, rule or approval',
    bucket: 'guardrails',
    lands:
      'Grouping is display-only; anything that aggregates or gates by group has to be rebuilt on a quote-wide or per-bundle roll-up',
    verdict: 'Degraded',
    mapping: 'discounting.group',
  }),

  // ── Approvals ───────────────────────────────────────────────────────────
  row({
    id: 'apr.rules',
    label: 'Approval rules and their conditions',
    source: 'sbaa__ApprovalRule__c',
    discriminator: '—',
    bucket: 'approvals',
    lands: 'Require Approval outcome + approval queue',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'approvals.rules',
  }),
  row({
    id: 'apr.derivedApprover',
    label: 'Approvers derived from a field',
    source: 'sbaa__ApprovalRule__c',
    discriminator: 'approver derived from a field',
    bucket: 'approvals',
    lands: 'Workflow routing',
    verdict: 'Degraded',
    mapping: 'approvals.derived',
  }),
  row({
    id: 'apr.chains',
    label: 'Chains with step-gated ordering',
    source: 'sbaa__ApprovalChain__c',
    discriminator: 'step gated on a prior step',
    bucket: 'approvals',
    lands: 'Stacked Request Quote Approval actions in a HubSpot workflow',
    verdict: 'Clear path',
    shape: 'Rebuild',
    mapping: 'approvals.chains',
  }),
  row({
    id: 'apr.trackedFields',
    label: 'Tracked fields',
    source: 'sbaa__TrackedField__c',
    discriminator: '—',
    bucket: 'approvals',
    lands: 'Rule conditions + roll-ups',
    verdict: 'Degraded',
    mapping: 'approvals.derived',
  }),
  row({
    id: 'apr.variables',
    label: 'Approval variables',
    source: 'sbaa__ApprovalVariable__c',
    discriminator: '—',
    bucket: 'approvals',
    lands: 'Roll-up field, read by the rule conditions',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'approvals.rules',
  }),
  row({
    id: 'apr.native',
    label: 'Native approval processes',
    source: 'ApprovalProcess',
    discriminator: 'native, on Quote or Opportunity',
    bucket: 'approvals',
    lands: 'Require Approval + HubSpot workflow',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'approvals.rules',
  }),

  // ── Quote output ────────────────────────────────────────────────────────
  row({
    id: 'out.templates',
    label: 'Templates, sections, content',
    source: 'SBQQ__QuoteTemplate__c',
    discriminator: '—',
    bucket: 'output',
    lands: 'Quotivity Template',
    verdict: 'Clear path',
    shape: 'Rebuild',
    mapping: 'output.templates',
  }),
  row({
    id: 'out.lineColumns',
    label: 'Line columns',
    source: 'SBQQ__LineColumn__c',
    discriminator: '—',
    bucket: 'output',
    lands: 'Line item columns + Dynamic Property Sets',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'output.templates',
  }),
  row({
    id: 'out.terms',
    label: 'Quote terms',
    source: 'SBQQ__QuoteTerm__c',
    discriminator: '—',
    bucket: 'output',
    lands: 'Terms Library + Insert Template Terms',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'output.templates',
  }),
  row({
    id: 'out.termConditions',
    label: 'Term conditions',
    source: 'SBQQ__TermCondition__c',
    discriminator: '—',
    bucket: 'output',
    lands: 'Template module visibility — condition groups combined with AND / OR',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'output.templates',
  }),
  row({
    id: 'out.groups',
    label: 'Quote line groups used for presentation',
    source: 'SBQQ__QuoteLineGroup__c',
    discriminator: 'groups used for presentation',
    bucket: 'output',
    lands: 'Template grouping of line items by a line item property',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'output.groups',
  }),

  // ── Contract lifecycle ──────────────────────────────────────────────────
  row({
    id: 'life.contracts',
    label: 'Contracts and subscriptions',
    source: 'Contract, SBQQ__Subscription__c',
    discriminator: 'active',
    bucket: 'lifecycle',
    lands: 'HubSpot Contract + contract line items',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'lifecycle.renewals',
  }),
  row({
    id: 'life.amendRenew',
    label: 'Amendment and renewal quotes',
    source: 'SBQQ__Quote__c',
    discriminator: 'Type = Amendment, Renewal',
    bucket: 'lifecycle',
    lands: 'Change quote, renewal quote',
    verdict: 'Clear path',
    shape: '1:1',
    mapping: 'lifecycle.renewals',
  }),
  row({
    id: 'life.ordersAssets',
    label: 'Orders and assets',
    source: 'Order, Asset',
    discriminator: '—',
    bucket: 'lifecycle',
    lands: '—',
    verdict: 'No target',
    mapping: 'lifecycle.orders',
  }),

  // ── Custom code & UI ────────────────────────────────────────────────────
  row({
    id: 'code.qcp',
    label: 'Quote Calculator Plugins',
    source: 'SBQQ__CustomScript__c',
    discriminator: '—',
    bucket: 'code',
    lands: 'Flagged for review — likely calculated pricing',
    verdict: 'Further review',
    review: 'Unread',
    mapping: 'code.custom',
  }),
  row({
    id: 'code.triggers',
    label: 'Apex triggers on CPQ objects',
    source: 'ApexTrigger',
    discriminator: 'TableEnumOrId is an SBQQ object, NamespacePrefix null',
    bucket: 'code',
    lands: 'Flagged for review — trigger bodies are unread',
    verdict: 'Further review',
    review: 'Unread',
    mapping: 'code.custom',
  }),
  row({
    id: 'code.customActions',
    label: 'Custom actions',
    source: 'SBQQ__CustomAction__c',
    discriminator: 'not package-owned',
    bucket: 'code',
    lands: 'Flagged for review',
    verdict: 'Further review',
    review: 'Unread',
    mapping: 'code.custom',
  }),
  row({
    id: 'code.ui',
    label: 'Layouts, buttons, record pages',
    source: 'Layout, WebLink, FlexiPage',
    discriminator: 'on an SBQQ object, not package-owned',
    bucket: 'code',
    lands: 'Flagged for review',
    verdict: 'Further review',
    review: 'Unread',
    mapping: 'code.custom',
  }),
];

const byId = new Map(RULE_ROWS.map((r) => [r.id, r]));

export function ruleRow(id: RowId): RuleRow {
  const r = byId.get(id);
  if (!r) throw new Error(`unknown rule row ${id}`);
  return r;
}

/** Buckets whose Exists value counts mechanisms (non-empty rows) rather than records. */
export const MECHANISM_BUCKETS: ReadonlySet<BucketId> = new Set(['price']);

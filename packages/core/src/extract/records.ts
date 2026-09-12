/**
 * Record shapes and field lists, one per object the tool reads. Field names follow the schema
 * notes in the spec (verified against CPQ package v67). Do not "tidy" them: several look wrong
 * and are not (TargetObject__c is the evaluation scope; Field__c means different things on
 * PriceCondition and PriceAction; PriceCondition and ErrorCondition are not field-compatible).
 */

export interface Audited {
  Id: string;
  LastModifiedDate?: string;
  CreatedById?: string;
  CreatedDate?: string;
}

export const AUDIT = ['Id', 'LastModifiedDate', 'CreatedById', 'CreatedDate'] as const;

export interface Product2Rec extends Audited {
  Name: string;
  ProductCode?: string | null;
  IsActive: boolean;
  SBQQ__PricingMethod__c?: string | null;
  SBQQ__SubscriptionPricing__c?: string | null;
  SBQQ__SubscriptionTerm__c?: number | null;
  SBQQ__ChargeType__c?: string | null;
  SBQQ__NonDiscountable__c?: boolean | null;
  SBQQ__PriceEditable__c?: boolean | null;
  SBQQ__OptionSelectionMethod__c?: string | null;
  SBQQ__ConfigurationType__c?: string | null;
}
export const PRODUCT2_FIELDS = [
  ...AUDIT,
  'Name',
  'ProductCode',
  'IsActive',
  'SBQQ__PricingMethod__c',
  'SBQQ__SubscriptionPricing__c',
  'SBQQ__SubscriptionTerm__c',
  'SBQQ__ChargeType__c',
  'SBQQ__NonDiscountable__c',
  'SBQQ__PriceEditable__c',
  'SBQQ__OptionSelectionMethod__c',
  'SBQQ__ConfigurationType__c',
];

export interface Pricebook2Rec extends Audited {
  Name: string;
  IsActive: boolean;
  IsStandard: boolean;
}
export const PRICEBOOK2_FIELDS = [...AUDIT, 'Name', 'IsActive', 'IsStandard'];

export interface CurrencyTypeRec {
  Id: string;
  IsoCode: string;
  IsActive: boolean;
  IsCorporate: boolean;
}
export const CURRENCY_FIELDS = ['Id', 'IsoCode', 'IsActive', 'IsCorporate'];

export interface DatedConversionRateRec {
  Id: string;
  IsoCode: string;
  StartDate: string;
  NextStartDate?: string | null;
  ConversionRate: number;
}
export const DCR_FIELDS = ['Id', 'IsoCode', 'StartDate', 'NextStartDate', 'ConversionRate'];

export interface ProductFeatureRec extends Audited {
  Name: string;
  SBQQ__ConfiguredSKU__c: string;
  SBQQ__MinOptionCount__c?: number | null;
  SBQQ__MaxOptionCount__c?: number | null;
  SBQQ__Number__c?: number | null;
}
export const FEATURE_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__ConfiguredSKU__c',
  'SBQQ__MinOptionCount__c',
  'SBQQ__MaxOptionCount__c',
  'SBQQ__Number__c',
];

export interface ProductOptionRec extends Audited {
  SBQQ__ConfiguredSKU__c: string;
  SBQQ__OptionalSKU__c: string;
  SBQQ__Feature__c?: string | null;
  SBQQ__Selected__c?: boolean | null;
  SBQQ__Required__c?: boolean | null;
  SBQQ__Type__c?: string | null;
  SBQQ__Number__c?: number | null;
}
export const OPTION_FIELDS = [
  ...AUDIT,
  'SBQQ__ConfiguredSKU__c',
  'SBQQ__OptionalSKU__c',
  'SBQQ__Feature__c',
  'SBQQ__Selected__c',
  'SBQQ__Required__c',
  'SBQQ__Type__c',
  'SBQQ__Number__c',
];

export interface OptionConstraintRec extends Audited {
  Name: string;
  SBQQ__Type__c: string;
  SBQQ__ConfiguredSKU__c?: string | null;
  SBQQ__ConstrainedOption__c?: string | null;
  SBQQ__ConstrainingOption__c?: string | null;
  SBQQ__Active__c?: boolean | null;
}
export const CONSTRAINT_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Type__c',
  'SBQQ__ConfiguredSKU__c',
  'SBQQ__ConstrainedOption__c',
  'SBQQ__ConstrainingOption__c',
  'SBQQ__Active__c',
];

export interface ConfigurationRuleRec extends Audited {
  SBQQ__Product__c?: string | null;
  SBQQ__ProductRule__c?: string | null;
  SBQQ__ProductFeature__c?: string | null;
  SBQQ__Active__c?: boolean | null;
}
export const CONFIG_RULE_FIELDS = [
  ...AUDIT,
  'SBQQ__Product__c',
  'SBQQ__ProductRule__c',
  'SBQQ__ProductFeature__c',
  'SBQQ__Active__c',
];

export interface ConfigurationAttributeRec extends Audited {
  Name: string;
  SBQQ__Product__c?: string | null;
  SBQQ__TargetField__c?: string | null;
  SBQQ__ApplyToProductOptions__c?: boolean | null;
  SBQQ__Required__c?: boolean | null;
}
export const ATTRIBUTE_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Product__c',
  'SBQQ__TargetField__c',
  'SBQQ__ApplyToProductOptions__c',
  'SBQQ__Required__c',
];

export interface QuoteProcessRec extends Audited {
  Name: string;
  SBQQ__Default__c?: boolean | null;
}
export const QUOTE_PROCESS_FIELDS = [...AUDIT, 'Name', 'SBQQ__Default__c'];

export interface ProcessInputRec extends Audited {
  Name: string;
  SBQQ__QuoteProcess__c?: string | null;
  SBQQ__Required__c?: boolean | null;
}
export const PROCESS_INPUT_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__QuoteProcess__c',
  'SBQQ__Required__c',
];

export interface ProcessInputConditionRec {
  Id: string;
  SBQQ__ProcessInput__c?: string | null;
  SBQQ__Field__c?: string | null;
  SBQQ__Operator__c?: string | null;
  SBQQ__Value__c?: string | null;
}
export const PROCESS_INPUT_CONDITION_FIELDS = [
  'Id',
  'SBQQ__ProcessInput__c',
  'SBQQ__Field__c',
  'SBQQ__Operator__c',
  'SBQQ__Value__c',
];

export interface ProductRuleRec extends Audited {
  Name: string;
  SBQQ__Type__c?: string | null;
  SBQQ__Scope__c?: string | null;
  SBQQ__Active__c?: boolean | null;
  SBQQ__ConditionsMet__c?: string | null;
  SBQQ__AdvancedCondition__c?: string | null;
  /** Always / Save / Edit on product rules — a different domain from the price-rule field. */
  SBQQ__EvaluationEvent__c?: string | null;
  SBQQ__ErrorMessage__c?: string | null;
  SBQQ__LookupObject__c?: string | null;
}
export const PRODUCT_RULE_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Type__c',
  'SBQQ__Scope__c',
  'SBQQ__Active__c',
  'SBQQ__ConditionsMet__c',
  'SBQQ__AdvancedCondition__c',
  'SBQQ__EvaluationEvent__c',
  'SBQQ__ErrorMessage__c',
  'SBQQ__LookupObject__c',
];

export interface ErrorConditionRec {
  Id: string;
  SBQQ__Rule__c: string;
  SBQQ__Index__c?: number | null;
  SBQQ__TestedObject__c?: string | null;
  SBQQ__TestedField__c?: string | null;
  SBQQ__Operator__c?: string | null;
  SBQQ__FilterType__c?: string | null;
  SBQQ__FilterValue__c?: string | null;
  SBQQ__TestedVariable__c?: string | null;
  SBQQ__FilterVariable__c?: string | null;
  SBQQ__TestedConfigurationAttribute__c?: string | null;
}
export const ERROR_CONDITION_FIELDS = [
  'Id',
  'SBQQ__Rule__c',
  'SBQQ__Index__c',
  'SBQQ__TestedObject__c',
  'SBQQ__TestedField__c',
  'SBQQ__Operator__c',
  'SBQQ__FilterType__c',
  'SBQQ__FilterValue__c',
  'SBQQ__TestedVariable__c',
  'SBQQ__FilterVariable__c',
  'SBQQ__TestedConfigurationAttribute__c',
];

export interface ProductActionRec {
  Id: string;
  SBQQ__Rule__c: string;
  SBQQ__Type__c?: string | null;
  SBQQ__Product__c?: string | null;
  SBQQ__ValueField__c?: string | null;
  SBQQ__ValueAttribute__c?: string | null;
  SBQQ__Required__c?: boolean | null;
  SBQQ__FilterField__c?: string | null;
  SBQQ__FilterValue__c?: string | null;
}
export const PRODUCT_ACTION_FIELDS = [
  'Id',
  'SBQQ__Rule__c',
  'SBQQ__Type__c',
  'SBQQ__Product__c',
  'SBQQ__ValueField__c',
  'SBQQ__ValueAttribute__c',
  'SBQQ__Required__c',
  'SBQQ__FilterField__c',
  'SBQQ__FilterValue__c',
];

export interface PriceRuleRec extends Audited {
  Name: string;
  SBQQ__Active__c?: boolean | null;
  /** Evaluation scope: Configurator / Calculator. Read this first. */
  SBQQ__TargetObject__c?: string | null;
  /** Multipicklist, Calculator scope only. Populated on Configurator rules too — ignore it there. */
  SBQQ__EvaluationEvent__c?: string | null;
  /** Save / Edit, Configurator scope only. */
  SBQQ__ConfiguratorEvaluationEvent__c?: string | null;
  SBQQ__ConditionsMet__c?: string | null;
  SBQQ__AdvancedCondition__c?: string | null;
  SBQQ__EvaluationOrder__c?: number | null;
  SBQQ__LookupObject__c?: string | null;
}
export const PRICE_RULE_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Active__c',
  'SBQQ__TargetObject__c',
  'SBQQ__EvaluationEvent__c',
  'SBQQ__ConfiguratorEvaluationEvent__c',
  'SBQQ__ConditionsMet__c',
  'SBQQ__AdvancedCondition__c',
  'SBQQ__EvaluationOrder__c',
  'SBQQ__LookupObject__c',
];

export interface PriceConditionRec {
  Id: string;
  SBQQ__Rule__c: string;
  SBQQ__Index__c?: number | null;
  SBQQ__Object__c?: string | null;
  /** The TESTED field. */
  SBQQ__Field__c?: string | null;
  SBQQ__Operator__c?: string | null;
  SBQQ__FilterType__c?: string | null;
  SBQQ__Value__c?: string | null;
  SBQQ__TestedVariable__c?: string | null;
  SBQQ__FilterVariable__c?: string | null;
}
export const PRICE_CONDITION_FIELDS = [
  'Id',
  'SBQQ__Rule__c',
  'SBQQ__Index__c',
  'SBQQ__Object__c',
  'SBQQ__Field__c',
  'SBQQ__Operator__c',
  'SBQQ__FilterType__c',
  'SBQQ__Value__c',
  'SBQQ__TestedVariable__c',
  'SBQQ__FilterVariable__c',
];

export interface PriceActionRec {
  Id: string;
  SBQQ__Rule__c: string;
  SBQQ__TargetObject__c?: string | null;
  /** The TARGET field. */
  SBQQ__Field__c?: string | null;
  SBQQ__Formula__c?: string | null;
  SBQQ__Value__c?: string | null;
  SBQQ__ValueField__c?: string | null;
  SBQQ__SourceVariable__c?: string | null;
  SBQQ__SourceLookupField__c?: string | null;
  SBQQ__Order__c?: number | null;
}
export const PRICE_ACTION_FIELDS = [
  'Id',
  'SBQQ__Rule__c',
  'SBQQ__TargetObject__c',
  'SBQQ__Field__c',
  'SBQQ__Formula__c',
  'SBQQ__Value__c',
  'SBQQ__ValueField__c',
  'SBQQ__SourceVariable__c',
  'SBQQ__SourceLookupField__c',
  'SBQQ__Order__c',
];

export interface SummaryVariableRec extends Audited {
  Name: string;
  SBQQ__TargetObject__c?: string | null;
  SBQQ__Scope__c?: string | null;
  SBQQ__AggregateFunction__c?: string | null;
  SBQQ__AggregateField__c?: string | null;
  SBQQ__FilterField__c?: string | null;
  SBQQ__Operator__c?: string | null;
  SBQQ__FilterValue__c?: string | null;
  SBQQ__ConstraintField__c?: string | null;
  SBQQ__CombineWith__c?: string | null;
  SBQQ__CompositeOperator__c?: string | null;
  SBQQ__ValueElement__c?: number | null;
}
export const SUMMARY_VARIABLE_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__TargetObject__c',
  'SBQQ__Scope__c',
  'SBQQ__AggregateFunction__c',
  'SBQQ__AggregateField__c',
  'SBQQ__FilterField__c',
  'SBQQ__Operator__c',
  'SBQQ__FilterValue__c',
  'SBQQ__ConstraintField__c',
  'SBQQ__CombineWith__c',
  'SBQQ__CompositeOperator__c',
  'SBQQ__ValueElement__c',
];

export interface LookupQueryRec extends Audited {
  Name: string;
  SBQQ__ProductRule__c?: string | null;
  SBQQ__PriceRule__c?: string | null;
  SBQQ__LookupField__c?: string | null;
  SBQQ__TestedObject__c?: string | null;
  SBQQ__TestedField__c?: string | null;
  SBQQ__Operator__c?: string | null;
}
export const LOOKUP_QUERY_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__ProductRule__c',
  'SBQQ__PriceRule__c',
  'SBQQ__LookupField__c',
  'SBQQ__TestedObject__c',
  'SBQQ__TestedField__c',
  'SBQQ__Operator__c',
];

export interface DiscountScheduleRec extends Audited {
  Name: string;
  SBQQ__Type__c?: string | null;
  SBQQ__AggregationScope__c?: string | null;
  SBQQ__DiscountUnit__c?: string | null;
  SBQQ__Product__c?: string | null;
}
export const DISCOUNT_SCHEDULE_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Type__c',
  'SBQQ__AggregationScope__c',
  'SBQQ__DiscountUnit__c',
  'SBQQ__Product__c',
];

export interface DiscountTierRec {
  Id: string;
  SBQQ__Schedule__c: string;
  SBQQ__LowerBound__c?: number | null;
  SBQQ__UpperBound__c?: number | null;
  SBQQ__Discount__c?: number | null;
  SBQQ__DiscountAmount__c?: number | null;
  SBQQ__Price__c?: number | null;
  SBQQ__Number__c?: number | null;
}
export const DISCOUNT_TIER_FIELDS = [
  'Id',
  'SBQQ__Schedule__c',
  'SBQQ__LowerBound__c',
  'SBQQ__UpperBound__c',
  'SBQQ__Discount__c',
  'SBQQ__DiscountAmount__c',
  'SBQQ__Price__c',
  'SBQQ__Number__c',
];

export interface BlockPriceRec extends Audited {
  SBQQ__Product__c: string;
  SBQQ__LowerBound__c?: number | null;
  SBQQ__UpperBound__c?: number | null;
  SBQQ__Price__c?: number | null;
}
export const BLOCK_PRICE_FIELDS = [
  ...AUDIT,
  'SBQQ__Product__c',
  'SBQQ__LowerBound__c',
  'SBQQ__UpperBound__c',
  'SBQQ__Price__c',
];

export interface ContractedPriceRec extends Audited {
  Name: string;
  SBQQ__Account__c?: string | null;
  SBQQ__Product__c?: string | null;
  SBQQ__Price__c?: number | null;
  SBQQ__Discount__c?: number | null;
  SBQQ__DiscountSchedule__c?: string | null;
  SBQQ__EffectiveDate__c?: string | null;
  SBQQ__ExpirationDate__c?: string | null;
}
export const CONTRACTED_PRICE_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Account__c',
  'SBQQ__Product__c',
  'SBQQ__Price__c',
  'SBQQ__Discount__c',
  'SBQQ__DiscountSchedule__c',
  'SBQQ__EffectiveDate__c',
  'SBQQ__ExpirationDate__c',
];

export interface DimensionRec extends Audited {
  Name: string;
  SBQQ__Product__c?: string | null;
  SBQQ__Type__c?: string | null;
}
export const DIMENSION_FIELDS = [...AUDIT, 'Name', 'SBQQ__Product__c', 'SBQQ__Type__c'];

export interface SegmentedLineRec {
  Id: string;
  SBQQ__Quote__c?: string | null;
  SBQQ__Dimension__c?: string | null;
  SBQQ__SegmentKey__c?: string | null;
  SBQQ__SegmentIndex__c?: number | null;
  SBQQ__Quantity__c?: number | null;
}
export const SEGMENTED_LINE_FIELDS = [
  'Id',
  'SBQQ__Quote__c',
  'SBQQ__Dimension__c',
  'SBQQ__SegmentKey__c',
  'SBQQ__SegmentIndex__c',
  'SBQQ__Quantity__c',
];

export interface ApprovalRuleRec extends Audited {
  Name: string;
  sbaa__Active__c?: boolean | null;
  sbaa__ApprovalChain__c?: string | null;
  sbaa__ApprovalStep__c?: number | null;
  sbaa__Approver__c?: string | null;
  sbaa__ApproverField__c?: string | null;
  sbaa__TargetObject__c?: string | null;
  sbaa__ConditionsMet__c?: string | null;
  sbaa__AdvancedCondition__c?: string | null;
}
export const APPROVAL_RULE_FIELDS = [
  ...AUDIT,
  'Name',
  'sbaa__Active__c',
  'sbaa__ApprovalChain__c',
  'sbaa__ApprovalStep__c',
  'sbaa__Approver__c',
  'sbaa__ApproverField__c',
  'sbaa__TargetObject__c',
  'sbaa__ConditionsMet__c',
  'sbaa__AdvancedCondition__c',
];

export interface ApprovalConditionRec {
  Id: string;
  sbaa__ApprovalRule__c: string;
  sbaa__Index__c?: number | null;
  sbaa__TestedField__c?: string | null;
  sbaa__Operator__c?: string | null;
  sbaa__FilterValue__c?: string | null;
  sbaa__TestedVariable__c?: string | null;
}
export const APPROVAL_CONDITION_FIELDS = [
  'Id',
  'sbaa__ApprovalRule__c',
  'sbaa__Index__c',
  'sbaa__TestedField__c',
  'sbaa__Operator__c',
  'sbaa__FilterValue__c',
  'sbaa__TestedVariable__c',
];

export interface NamedRec extends Audited {
  Name: string;
}
export const NAMED_FIELDS = [...AUDIT, 'Name'];

export interface ApproverRec extends Audited {
  Name: string;
  sbaa__User__c?: string | null;
  sbaa__GroupId__c?: string | null;
}
export const APPROVER_FIELDS = [...AUDIT, 'Name', 'sbaa__User__c', 'sbaa__GroupId__c'];

export interface ApprovalHistoryRec {
  Id: string;
  sbaa__Status__c?: string | null;
  sbaa__Rule__c?: string | null;
  CreatedDate: string;
  LastModifiedDate: string;
}
export const APPROVAL_HISTORY_FIELDS = [
  'Id',
  'sbaa__Status__c',
  'sbaa__Rule__c',
  'CreatedDate',
  'LastModifiedDate',
];

export interface ProcessInstanceRec {
  Id: string;
  Status: string;
  CreatedDate: string;
  CompletedDate?: string | null;
  ProcessDefinitionId: string;
}
export const PROCESS_INSTANCE_FIELDS = [
  'Id',
  'Status',
  'CreatedDate',
  'CompletedDate',
  'ProcessDefinitionId',
];

export interface ProcessDefinitionRec {
  Id: string;
  Name: string;
  DeveloperName: string;
  Type: string;
  TableEnumOrId: string;
  State: string;
  LastModifiedDate?: string;
}
export const PROCESS_DEFINITION_FIELDS = [
  'Id',
  'Name',
  'DeveloperName',
  'Type',
  'TableEnumOrId',
  'State',
  'LastModifiedDate',
];

export interface TemplateSectionRec {
  Id: string;
  SBQQ__Template__c?: string | null;
  SBQQ__Content__c?: string | null;
}
export const TEMPLATE_SECTION_FIELDS = ['Id', 'SBQQ__Template__c', 'SBQQ__Content__c'];

export interface TemplateContentRec extends Audited {
  Name: string;
  SBQQ__Type__c?: string | null;
}
export const TEMPLATE_CONTENT_FIELDS = [...AUDIT, 'Name', 'SBQQ__Type__c'];

export interface LineColumnRec extends Audited {
  Name: string;
  SBQQ__Template__c?: string | null;
  SBQQ__FieldName__c?: string | null;
}
export const LINE_COLUMN_FIELDS = [...AUDIT, 'Name', 'SBQQ__Template__c', 'SBQQ__FieldName__c'];

export interface TermConditionRec {
  Id: string;
  SBQQ__QuoteTerm__c?: string | null;
  SBQQ__Field__c?: string | null;
  SBQQ__Operator__c?: string | null;
  SBQQ__Value__c?: string | null;
  SBQQ__TestedVariable__c?: string | null;
  SBQQ__Index__c?: number | null;
}
export const TERM_CONDITION_FIELDS = [
  'Id',
  'SBQQ__QuoteTerm__c',
  'SBQQ__Field__c',
  'SBQQ__Operator__c',
  'SBQQ__Value__c',
  'SBQQ__TestedVariable__c',
  'SBQQ__Index__c',
];

export interface CustomScriptRec extends Audited {
  Name: string;
  SBQQ__Code__c?: string | null;
  SBQQ__QuoteFields__c?: string | null;
  SBQQ__QuoteLineFields__c?: string | null;
  SBQQ__GroupFields__c?: string | null;
}
export const CUSTOM_SCRIPT_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Code__c',
  'SBQQ__QuoteFields__c',
  'SBQQ__QuoteLineFields__c',
  'SBQQ__GroupFields__c',
];

export interface CustomActionRec extends Audited {
  Name: string;
  SBQQ__Type__c?: string | null;
  SBQQ__Location__c?: string | null;
  SBQQ__Page__c?: string | null;
  SBQQ__Active__c?: boolean | null;
}
export const CUSTOM_ACTION_FIELDS = [
  ...AUDIT,
  'Name',
  'SBQQ__Type__c',
  'SBQQ__Location__c',
  'SBQQ__Page__c',
  'SBQQ__Active__c',
];

export interface ApexTriggerRec {
  Id: string;
  Name: string;
  TableEnumOrId: string;
  NamespacePrefix?: string | null;
  Status?: string | null;
  Body?: string | null;
  LastModifiedDate?: string;
}
export const APEX_TRIGGER_FIELDS = [
  'Id',
  'Name',
  'TableEnumOrId',
  'NamespacePrefix',
  'Status',
  'Body',
  'LastModifiedDate',
];

export interface WebLinkRec {
  Id: string;
  Name: string;
  PageOrSobjectType?: string | null;
  NamespacePrefix?: string | null;
}
export const WEBLINK_FIELDS = ['Id', 'Name', 'PageOrSobjectType', 'NamespacePrefix'];

export interface LayoutRec {
  Id: string;
  Name: string;
  TableEnumOrId?: string | null;
  NamespacePrefix?: string | null;
}
export const LAYOUT_FIELDS = ['Id', 'Name', 'TableEnumOrId', 'NamespacePrefix'];

export interface FlexiPageRec {
  Id: string;
  DeveloperName: string;
  EntityDefinitionId?: string | null;
  NamespacePrefix?: string | null;
  Type?: string | null;
}
export const FLEXIPAGE_FIELDS = [
  'Id',
  'DeveloperName',
  'EntityDefinitionId',
  'NamespacePrefix',
  'Type',
];

export interface ValidationRuleRec {
  Id: string;
  ValidationName: string;
  NamespacePrefix?: string | null;
  Active?: boolean | null;
  EntityDefinition?: { QualifiedApiName?: string | null } | null;
}
export const VALIDATION_RULE_FIELDS = [
  'Id',
  'ValidationName',
  'NamespacePrefix',
  'Active',
  'EntityDefinition.QualifiedApiName',
];

export interface FieldDefinitionRec {
  QualifiedApiName: string;
  Label?: string | null;
  DataType?: string | null;
  NamespacePrefix?: string | null;
}
export const FIELD_DEFINITION_FIELDS = ['QualifiedApiName', 'Label', 'DataType', 'NamespacePrefix'];

export const SBQQ_OBJECT_PREFIXES = ['SBQQ__', 'sbaa__'];
export function isCpqObject(apiName: string | null | undefined): boolean {
  return !!apiName && SBQQ_OBJECT_PREFIXES.some((p) => apiName.startsWith(p));
}

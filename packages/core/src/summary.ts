import type { Classification } from './classify/index.js';
import type { Extraction } from './extract/index.js';
import type { BucketId } from './types.js';

const n = (v: number): string => v.toLocaleString('en-US');
const plural = (v: number, one: string, many = `${one}s`): string =>
  `${n(v)} ${v === 1 ? one : many}`;

export interface SummaryInput {
  ex: Extraction;
  cl: Classification;
  rowCount: (rowId: string) => number;
  bucketAlive: (id: BucketId) => number | null;
  mechanisms: number;
}

/** One line per bucket, in the admin's vocabulary, counts first. */
export function summaryLines(id: BucketId, s: SummaryInput): string[] {
  const { ex, cl, rowCount } = s;
  const f = cl.facts;
  const years =
    ex.windowMonths === 12 ? 'the last 12 months' : `the trailing ${ex.windowMonths} months`;
  switch (id) {
    case 'catalog': {
      const cur = f.multiCurrency
        ? `${f.currencies.length} currencies enabled.`
        : 'single currency.';
      return [
        `${plural(ex.product2.count, 'active product')} across ${plural(ex.pricebook2.count, 'price book')}, ${cur}`,
        `${n(f.productsNeverQuoted)} never appeared on a quote line in ${years}.`,
      ];
    }
    case 'configuration': {
      const dormant = ex.productFeature.records.filter(
        (r) => !r.LastModifiedDate || r.LastModifiedDate < ex.since,
      ).length;
      const filters = rowCount('cfg.filterRules');
      return [
        `${plural(f.bundles, 'bundle')}, ${plural(f.featureCount, 'bundle option')}, deepest ${plural(f.nestingDepth, 'level')}.`,
        `${n(dormant)} not configured since ${ex.since.slice(0, 4)}. ${n(filters)} use dynamic option sets.`,
      ];
    }
    case 'discovery':
      return [
        `${plural(f.attributeCount, 'configuration attribute')}, ${plural(ex.quoteProcess.count, 'guided selling process', 'guided selling processes')}, ${plural(ex.processInput.count, 'process input')}.`,
        `${plural(rowCount('disc.priceRulesDefaulting'), 'price rule')} exist only to default a field.`,
      ];
    case 'price': {
      const qcp = ex.customScript.count;
      return [
        `${n(s.mechanisms)} distinct ${s.mechanisms === 1 ? 'way' : 'ways'} a price reaches a line.`,
        qcp
          ? `${n(qcp)} of the calculation path${qcp === 1 ? ' runs' : 's run'} through a Quote Calculator Plugin.`
          : 'None of them run through a Quote Calculator Plugin.',
      ];
    }
    case 'discounting': {
      const above = rowCount('dsc.quoteScope') + rowCount('dsc.groupScope');
      return [
        `${plural(ex.discountSchedule.count, 'discount schedule')}, ${plural(f.discountTierCount, 'tier')}, ${plural(ex.contractedPrice.count, 'contracted price')}.`,
        `${n(above)} schedule${above === 1 ? '' : 's'} aggregate above the line rather than on it.`,
      ];
    }
    case 'guardrails': {
      const rules =
        rowCount('grd.validation') +
        rowCount('grd.alert') +
        rowCount('grd.quoteScope') +
        rowCount('grd.platformValidation');
      const floors = rowCount('grd.floorCeiling');
      const alive = s.bucketAlive('guardrails');
      return [
        `${plural(rules, 'rule')} that stop or warn a rep.${alive != null ? ` ${n(alive)} touched in ${years}.` : ''}`,
        `${plural(floors, 'margin floor or ceiling')} ${floors === 1 ? 'is' : 'are'} computed by a price rule a validation rule then tests.`,
      ];
    }
    case 'approvals': {
      const cycle =
        f.medianApprovalCycleDays != null
          ? ` Median cycle ${f.medianApprovalCycleDays.toFixed(1)} days.`
          : '';
      const engines = f.advancedApprovalsInstalled
        ? f.nativeApprovalProcesses
          ? `Advanced Approvals and ${plural(f.nativeApprovalProcesses, 'native approval process', 'native approval processes')} are both live.`
          : 'Advanced Approvals is the only engine in use.'
        : f.nativeApprovalProcesses
          ? `Advanced Approvals is not installed. ${plural(f.nativeApprovalProcesses, 'native approval process', 'native approval processes')} on Quote or Opportunity.`
          : 'Advanced Approvals is not installed and no native approval process runs on Quote or Opportunity.';
      return [
        `${plural(ex.approvalRule.count, 'approval rule')}, ${plural(ex.approvalChain.count, 'chain')}, ${plural(f.approverCount, 'approver')}.${cycle}`,
        engines,
      ];
    }
    case 'output': {
      const stale = ex.quoteTemplate.records.filter(
        (r) => !r.LastModifiedDate || r.LastModifiedDate < ex.since,
      ).length;
      return [
        `${plural(ex.quoteTemplate.count, 'template')}, ${plural(f.templateSectionCount, 'section')}, ${plural(ex.lineColumn.count, 'line column')}, ${plural(ex.quoteTerm.count, 'quote term')}.`,
        `${n(stale)} template${stale === 1 ? ' has' : 's have'} not been touched since ${ex.since.slice(0, 4)}.`,
      ];
    }
    case 'lifecycle': {
      const share =
        f.amendRenewShareLastYear != null && f.lastYear != null
          ? `${Math.round(f.amendRenewShareLastYear * 100)}% of ${f.lastYear}'s quotes were renewals or amendments.`
          : 'No quotes dated last year, so the renewal share cannot be measured.';
      return [
        `${plural(ex.contractActive, 'active contract')}, ${plural(f.subscriptionCount, 'subscription')}.`,
        share,
      ];
    }
    case 'code':
      return [
        `${plural(ex.customScript.count, 'Quote Calculator Plugin')}, ${plural(ex.apexTrigger.count, 'trigger')}, ${plural(ex.customAction.count, 'custom action')}, ${plural(rowCount('code.ui'), 'UI customisation')}.`,
        'Named and flagged for review. Not interpreted.',
      ];
  }
}

export function bucketNote(id: BucketId, s: SummaryInput): string {
  const { ex, cl } = s;
  const f = cl.facts;
  switch (id) {
    case 'catalog':
      return 'Counts come from aggregate queries. PricebookEntry records are never retrieved — a product with no price in a currency is a catalogue data problem, not a migration finding.';
    case 'configuration': {
      const nested = s.rowCount('cfg.optionsNested');
      return nested
        ? `Nesting has no target — Quotivity bundles are one level deep, so ${n(nested)} option product${nested === 1 ? '' : 's'} ha${nested === 1 ? 's' : 've'} to be flattened or split.`
        : 'No nested bundles. Every option product is a leaf, which is the shape Quotivity bundles expect.';
    }
    case 'discovery':
      return 'Attributes split by whether the answer is pushed onto product options — that decides which of the two destinations applies.';
    case 'price':
      return `This bucket counts mechanisms, not records. ${s.mechanisms > 6 ? `${n(s.mechanisms)} is high — most orgs run three or four.` : 'Most orgs run three or four.'}`;
    case 'discounting':
      return `${plural(f.discountTierCount, 'tier')} are read but not counted as constructs — they belong to their schedule. Tier bounds are half-open in CPQ and stay that way on import.`;
    case 'guardrails': {
      const seeded = ex.validationRule.records.length;
      return `Platform validation rules on CPQ objects are counted only when admin-authored (${n(seeded)} here). Package-owned rules are excluded by namespace.`;
    }
    case 'approvals':
      return f.advancedApprovalsInstalled && f.nativeApprovalProcesses
        ? 'Both engines are running. A SOQL-only inventory would have missed the native processes entirely.'
        : 'Native approval processes are read from ProcessDefinition, so a native-only org is not reported as zero.';
    case 'output':
      return 'Templates are authored fresh rather than imported — same document, no import file. That is true of a move to Revenue Cloud Advanced too.';
    case 'lifecycle':
      return f.amendRenewShareLastYear != null && f.amendRenewShareLastYear >= 0.5
        ? 'Renewals and amendments are the majority of quoting volume here, so this bucket carries more weight than its record count suggests.'
        : 'Contracts and subscriptions carry to HubSpot Contracts; orders and assets have no target.';
    case 'code': {
      const seeded = Object.entries(ex.seeded)
        .filter(([o]) => /CustomAction|CustomScript/.test(o))
        .map(([, c]) => c)
        .reduce((a, b) => a + b, 0);
      const names = Object.keys(f.qcpHooks);
      const qcpNote = names.length
        ? ` ${names.join(', ')} — ${names.length > 3 ? 'several means pricing outgrew the rules engine years ago, itself a finding.' : 'most orgs have zero to three.'}`
        : '';
      return `Package-owned records are excluded: ${n(seeded)} custom actions and scripts shipped with CPQ, plus every namespaced trigger, button, layout and record page.${qcpNote}`;
    }
  }
}

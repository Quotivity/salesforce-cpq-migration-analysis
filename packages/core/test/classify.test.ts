import { describe, expect, it } from 'vitest';
import { classifyAll } from '../src/classify/index.js';
import { RULE_ROWS, ruleRow } from '../src/classify/rules.js';
import { extractAll } from '../src/extract/index.js';
import { assembleReport } from '../src/report/assemble.js';
import { BUCKETS } from '../src/types.js';
import { acmeStore, NOW } from './fixtures/acme.js';
import { EmulatedConnection } from './fixtures/soqlEmulator.js';

async function run() {
  const conn = new EmulatedConnection(acmeStore());
  const ex = await extractAll(conn, { now: NOW, windowMonths: 24 });
  const cl = classifyAll(ex);
  const report = assembleReport(ex, cl, {
    version: '0.1.0-test',
    runId: 'abcd',
    org: {
      name: conn.orgName,
      username: conn.username,
      instanceUrl: conn.instanceUrl,
      orgId: conn.orgId,
    },
    now: NOW,
  });
  return { conn, ex, cl, report };
}

const primaryCount = (cl: Awaited<ReturnType<typeof run>>['cl'], rowId: string) =>
  cl.records.filter((r) => r.primary.rowId === rowId).length +
  cl.tallies.filter((t) => t.rowId === rowId).reduce((a, t) => a + t.count, 0);
const secondaryCount = (cl: Awaited<ReturnType<typeof run>>['cl'], rowId: string) =>
  cl.records.filter((r) => r.secondary.some((s) => s.rowId === rowId)).length;

describe('classifier — every discriminator row', () => {
  it('catalog rows', async () => {
    const { cl } = await run();
    expect(primaryCount(cl, 'cat.products')).toBe(9); // active only
    expect(primaryCount(cl, 'cat.pricebooks')).toBe(2);
    expect(primaryCount(cl, 'cat.currencies')).toBe(2); // GBP inactive
    expect(primaryCount(cl, 'cat.dcrStatic')).toBe(1); // USD
    expect(primaryCount(cl, 'cat.dcrTable')).toBe(1); // EUR, three periods
  });

  it('configuration rows', async () => {
    const { cl } = await run();
    expect(primaryCount(cl, 'cfg.featurePickOne')).toBe(1);
    expect(primaryCount(cl, 'cfg.featurePickMany')).toBe(1);
    expect(primaryCount(cl, 'cfg.featureCap')).toBe(1);
    expect(primaryCount(cl, 'cfg.features')).toBe(1);
    expect(primaryCount(cl, 'cfg.optionsNested')).toBe(1);
    expect(primaryCount(cl, 'cfg.optionsPlain')).toBe(3);
    expect(primaryCount(cl, 'cfg.configRules')).toBe(1);
    expect(primaryCount(cl, 'cfg.constraintExclusion')).toBe(1);
    expect(primaryCount(cl, 'cfg.constraintDepSatisfied')).toBe(1);
    expect(primaryCount(cl, 'cfg.constraintDepOther')).toBe(1);
    expect(primaryCount(cl, 'cfg.selectionRules')).toBe(1);
    expect(primaryCount(cl, 'cfg.filterRules')).toBe(1);
    expect(primaryCount(cl, 'cfg.actionSwap')).toBe(1);
    expect(primaryCount(cl, 'cfg.actionRemoveNoReplacement')).toBe(1);
    expect(primaryCount(cl, 'cfg.lookupProductRule')).toBe(1);
    expect(primaryCount(cl, 'cfg.priceRuleConfigurator')).toBe(1);
    expect(cl.facts.bundles).toBe(2);
    expect(cl.facts.nestingDepth).toBe(2);
  });

  it('reads the configurator event field only for configurator-scoped price rules', async () => {
    const { cl } = await run();
    const configurator = cl.records.find((r) => r.id === 'PRC5');
    expect(configurator?.details).toContain('Configurator · Edit');
    const calculator = cl.records.find((r) => r.id === 'PRC1');
    expect(calculator?.details).toContain('Calculator · On Calculate');
  });

  it('discovery and price rows', async () => {
    const { cl } = await run();
    expect(primaryCount(cl, 'disc.attributesGuided')).toBe(1);
    expect(primaryCount(cl, 'disc.attributesOnOptions')).toBe(1);
    expect(primaryCount(cl, 'disc.quoteProcesses')).toBe(1);
    expect(primaryCount(cl, 'disc.processInputs')).toBe(2);
    expect(primaryCount(cl, 'disc.priceRulesDefaulting')).toBe(1);
    expect(secondaryCount(cl, 'price.costPlus')).toBe(1);
    expect(secondaryCount(cl, 'price.percentOfTotal')).toBe(1);
    expect(secondaryCount(cl, 'price.block')).toBe(1);
    expect(secondaryCount(cl, 'price.usage')).toBe(1);
    expect(secondaryCount(cl, 'price.subscriptionBundled')).toBe(1);
    expect(secondaryCount(cl, 'price.subscriptionUnbundled')).toBe(1);
    expect(primaryCount(cl, 'price.attributeDriven')).toBe(1);
    expect(primaryCount(cl, 'price.priceRulesPrice')).toBe(1);
    expect(primaryCount(cl, 'price.actionsOverLimit')).toBe(2);
    expect(primaryCount(cl, 'price.actionsQuoteRollup')).toBe(1);
    expect(primaryCount(cl, 'price.actionsQuoteArbitrary')).toBe(1);
    expect(primaryCount(cl, 'price.mdqSame')).toBe(1);
    expect(primaryCount(cl, 'price.mdqDiffering')).toBe(1);
    expect(primaryCount(cl, 'price.lookupPriceRule')).toBe(1);
    const over = cl.records.filter((r) => r.primary.rowId === 'price.actionsOverLimit');
    expect(over.flatMap((r) => r.details).join(' ')).toMatch(
      /AND\(\) takes 2 to 5 arguments; this one has 6/,
    );
    expect(over.flatMap((r) => r.details).join(' ')).toMatch(
      /ROUND\(\) is not in the calculated pricing grammar/,
    );
  });

  it('summary variables follow the rule that consumes them', async () => {
    const { cl } = await run();
    const sv = (id: string) => cl.records.find((r) => r.id === id);
    expect(sv('SV1')?.primary).toEqual({ rowId: 'sv.plain', bucket: 'price' });
    expect(sv('SV2')?.primary).toEqual({ rowId: 'sv.constraint', bucket: 'guardrails' });
    expect(sv('SV3')?.primary.rowId).toBe('sv.composite');
    expect(sv('SV3')?.alive).toBe(false); // unreferenced → dead
    expect(sv('SV4')?.primary).toEqual({ rowId: 'sv.productOption', bucket: 'guardrails' });
    expect(sv('SV5')?.primary).toEqual({ rowId: 'sv.asset', bucket: 'output' });
    expect(cl.facts.deadSummaryVariables).toBe(1);
  });

  it('discounting, guardrails, approvals, output, lifecycle, code rows', async () => {
    const { cl } = await run();
    expect(primaryCount(cl, 'dsc.perLine')).toBe(1);
    expect(primaryCount(cl, 'dsc.quoteScope')).toBe(1);
    expect(primaryCount(cl, 'dsc.groupScope')).toBe(1);
    expect(primaryCount(cl, 'dsc.slab')).toBe(1);
    expect(primaryCount(cl, 'dsc.contractedPrices')).toBe(3);
    expect(primaryCount(cl, 'dsc.priceRulesDiscount')).toBe(1);
    expect(cl.facts.contractedPriceAccounts).toBe(2);
    expect(primaryCount(cl, 'grd.validation')).toBe(2); // PR1, PR7
    expect(primaryCount(cl, 'grd.alert')).toBe(1);
    expect(primaryCount(cl, 'grd.quoteScope')).toBe(1);
    expect(primaryCount(cl, 'grd.floorCeiling')).toBe(1);
    expect(secondaryCount(cl, 'grd.customLogic')).toBe(3); // PR3, PR7, PRC3
    expect(primaryCount(cl, 'grd.platformValidation')).toBe(1);
    expect(secondaryCount(cl, 'grd.productFlags')).toBe(2);
    expect(secondaryCount(cl, 'grd.groupGated')).toBe(3); // DS3, PR3, AR1
    expect(cl.facts.ruleConditionProblems).toEqual([
      { rule: 'Broken custom logic', problem: 'references conditions 4 that do not exist' },
    ]);
    expect(primaryCount(cl, 'apr.rules')).toBe(1);
    expect(primaryCount(cl, 'apr.derivedApprover')).toBe(1);
    expect(primaryCount(cl, 'apr.chains')).toBe(1);
    expect(primaryCount(cl, 'apr.trackedFields')).toBe(1);
    expect(primaryCount(cl, 'apr.variables')).toBe(1);
    expect(primaryCount(cl, 'apr.native')).toBe(1); // Case process excluded
    expect(cl.facts.approvalRulesFired).toBe(1);
    expect(cl.facts.medianApprovalCycleDays).toBe(2); // 1, 2, 3 days → median 2
    expect(primaryCount(cl, 'out.templates')).toBe(2);
    expect(primaryCount(cl, 'out.lineColumns')).toBe(2);
    expect(primaryCount(cl, 'out.terms')).toBe(1);
    expect(primaryCount(cl, 'out.termConditions')).toBe(1);
    expect(primaryCount(cl, 'out.groups')).toBe(7);
    expect(primaryCount(cl, 'life.contracts')).toBe(4);
    expect(primaryCount(cl, 'life.amendRenew')).toBe(4);
    expect(primaryCount(cl, 'life.ordersAssets')).toBe(5);
    expect(primaryCount(cl, 'code.qcp')).toBe(2);
    expect(primaryCount(cl, 'code.triggers')).toBe(1);
    expect(primaryCount(cl, 'code.customActions')).toBe(1); // two seeded
    expect(primaryCount(cl, 'code.ui')).toBe(3);
    expect(cl.facts.qcpHooks.QCP_MarginFloorAcrossQuote).toEqual([
      'onBeforePriceRules',
      'onAfterCalculate',
    ]);
  });

  it('residue holds only records no discriminator matched', async () => {
    const { cl } = await run();
    expect(cl.residue.map((r) => r.id).sort()).toEqual(['C4', 'LQ3', 'PR6', 'PRC7']);
  });
});

describe('invariants', () => {
  it('every rule row is referenced by a classifier or a tally', async () => {
    const { cl } = await run();
    const seen = new Set<string>();
    for (const r of cl.records) {
      seen.add(r.primary.rowId);
      for (const s of r.secondary) seen.add(s.rowId);
    }
    for (const t of cl.tallies) seen.add(t.rowId);
    const missing = RULE_ROWS.map((r) => r.id).filter((id) => !seen.has(id));
    expect(missing).toEqual([]);
  });

  it('bucket totals sum to object totals (records counted once)', async () => {
    const { cl, report } = await run();
    const primaries = cl.records.length + cl.tallies.reduce((a, t) => a + t.count, 0);
    const exists = report.buckets
      .filter((b) => !b.countsMechanisms)
      .reduce((a, b) => a + b.exists, 0);
    const priceRecords =
      cl.records.filter((r) => r.primary.bucket === 'price').length +
      cl.tallies.filter((t) => t.bucket === 'price').reduce((a, t) => a + t.count, 0);
    expect(exists + priceRecords).toBe(primaries);
    for (const o of cl.objects) expect(o.classified + o.residue).toBeLessThanOrEqual(o.retrieved);
  });

  it('review is its own figure and never inside needs attention', async () => {
    const { report } = await run();
    for (const b of report.buckets) {
      const reviewRows = b.rows.filter(
        (r) => r.verdict === 'Further review' && r.count > 0 && !r.crossListed,
      );
      if (reviewRows.length === 0) expect(b.review).toBeUndefined();
      else expect(b.review).toBeGreaterThan(0);
      const attention = b.rows
        .filter((r) => (r.verdict === 'Degraded' || r.verdict === 'No target') && !r.crossListed)
        .reduce((a, r) => a + r.count, 0);
      if (!b.countsMechanisms) expect(b.needsAttention).toBe(attention);
    }
    const code = report.buckets.find((b) => b.id === 'code');
    expect(code?.needsAttention).toBe(0);
    expect(code?.review).toBe(7);
    expect(code?.alive).toBeNull();
  });

  it('mapping distribution matches the spec: 21 clear, 6 degraded, 4 no target, 3 review', async () => {
    const { report } = await run();
    const counts = Object.fromEntries(report.verdictScale.map((v) => [v.label, v.count]));
    expect(counts).toEqual({ 'Clear path': 21, Degraded: 6, 'No target': 4 });
    expect(report.reviewCount).toBe(3);
    expect(report.mapping).toHaveLength(34);
    for (const rule of RULE_ROWS)
      expect(report.mapping.some((m) => m.id === ruleRow(rule.id).mapping)).toBe(true);
  });

  it('every bucket renders, with price counting mechanisms', async () => {
    const { report } = await run();
    expect(report.buckets.map((b) => b.id)).toEqual(BUCKETS.map((b) => b.id));
    const price = report.buckets.find((b) => b.id === 'price');
    expect(price?.countsMechanisms).toBe(true);
    expect(price?.exists).toBe(price?.rows.filter((r) => r.count > 0).length);
    expect(price?.summary[0]).toMatch(/distinct ways a price reaches a line/);
  });
});

describe('report assembly', () => {
  it('excludes package-seeded records and reports them separately', async () => {
    const { report, ex } = await run();
    expect(ex.seeded).toEqual({ SBQQ__CustomAction__c: 2 });
    expect(report.seeded).toEqual([{ object: 'SBQQ__CustomAction__c', count: 2 }]);
    expect(ex.customAction.count).toBe(1);
  });

  it('uses the business date for quote volume and prints which', async () => {
    const { report, ex } = await run();
    expect(report.quoteDateField).toBe('SBQQ__StartDate__c');
    expect(ex.quotesInWindow).toBe(10);
    expect(report.volume.quotesByYear).toEqual([
      { year: 2024, total: 3, amendRenew: 0 },
      { year: 2025, total: 6, amendRenew: 4 },
      { year: 2026, total: 2, amendRenew: 0 },
    ]);
    const lifecycle = report.buckets.find((b) => b.id === 'lifecycle');
    expect(lifecycle?.summary[1]).toBe("67% of 2025's quotes were renewals or amendments.");
  });

  it('builds the prerequisites list with code-written fields flagged for review', async () => {
    const { report } = await run();
    const byField = Object.fromEntries(report.prerequisites.map((p) => [p.field, p]));
    expect(Object.keys(byField).sort()).toEqual([
      'Custom_Col__c',
      'Custom_Total__c',
      'Margin__c',
      'Partner_Tier__c',
      'Quote_External_Rate__c',
      'Quote_Margin_Percent__c',
      'Region__c',
      'Tier__c',
    ]);
    expect(byField.Quote_External_Rate__c?.review).toBe(true);
    expect(byField.Quote_External_Rate__c?.need).toMatch(
      /written by QCP QCP_MarginFloorAcrossQuote/,
    );
    expect(byField.Quote_Margin_Percent__c?.review).toBe(true);
    expect(byField.Margin__c?.review).toBe(false);
    expect(byField.Margin__c?.need).toMatch(/validation rules/);
  });

  it('names the review rows with both outcomes', async () => {
    const { report } = await run();
    expect(report.review.map((r) => r.subject)).toEqual([
      'Lookup queries on a product rule — 1',
      'Lookup queries on a price rule — 1',
      'Quote Calculator Plugins, triggers and UI — 7',
    ]);
    for (const r of report.review) {
      expect(r.reason).toBe('Unread');
      expect(r.outA.length).toBeGreaterThan(10);
      expect(r.outB.length).toBeGreaterThan(10);
    }
    expect(report.review[2]?.names).toContain('QCP_MarginFloorAcrossQuote');
  });

  it('prints the window next to alive, and the file name from org and date', async () => {
    const { report } = await run();
    expect(report.window).toEqual({
      months: 24,
      since: '2024-09-12T12:00:00.000Z',
      label: '24 months',
    });
    expect(report.fileName).toBe('quotivity-cpq-inventory-acme-prod-2026-09-12');
    expect(report.highlights).toMatch(
      /^In this org: 1 bundle option not configured since 2024, 1 approval rule that has not fired/,
    );
    expect(report.residue).toEqual({ count: 4, pct: 4.7 });
  });

  it('marks cross-listed rows and never counts them twice', async () => {
    const { report } = await run();
    const code = report.buckets.find((b) => b.id === 'code');
    const lookup = code?.rows.find((r) => r.rowId === 'cfg.lookupProductRule');
    expect(lookup?.crossListed).toEqual({
      countedIn: 'configuration',
      countedInName: 'Configuration',
    });
    expect(code?.exists).toBe(7);
    const guardrails = report.buckets.find((b) => b.id === 'guardrails');
    const flags = guardrails?.rows.find((r) => r.rowId === 'grd.productFlags');
    expect(flags?.count).toBe(2);
    expect(flags?.crossListed?.countedIn).toBe('catalog');
  });

  it('handles an org without Advanced Approvals or multi-currency without reporting zero', async () => {
    const store = acmeStore();
    for (const k of Object.keys(store))
      if (k.startsWith('sbaa__') || k === 'CurrencyType' || k === 'DatedConversionRate')
        delete store[k];
    const conn = new EmulatedConnection(store);
    const ex = await extractAll(conn, { now: NOW });
    expect(ex.approvalRule.status).toBe('absent');
    expect(ex.currencyType.status).toBe('absent');
    const cl = classifyAll(ex);
    expect(cl.facts.advancedApprovalsInstalled).toBe(false);
    expect(cl.facts.multiCurrency).toBe(false);
    const report = assembleReport(ex, cl, {
      version: 't',
      runId: 'r',
      org: { name: 'x', username: 'u', instanceUrl: 'i', orgId: 'o' },
      now: NOW,
    });
    const approvals = report.buckets.find((b) => b.id === 'approvals');
    expect(approvals?.summary[1]).toMatch(
      /Advanced Approvals is not installed\. 1 native approval process/,
    );
    expect(report.buckets.find((b) => b.id === 'catalog')?.summary[0]).toMatch(/single currency/);
  });

  it('reports an object that fails after retries as unread, never as zero', async () => {
    const conn = new EmulatedConnection(acmeStore());
    conn.failing.add('SBQQ__QuoteTemplate__c');
    const ex = await extractAll(conn, { now: NOW });
    expect(ex.quoteTemplate.status).toBe('unread');
    expect(ex.unread).toEqual([
      { object: 'SBQQ__QuoteTemplate__c', reason: expect.stringMatching(/transport failure/) },
    ]);
    const attempts = conn.queries.filter((q) => /FROM SBQQ__QuoteTemplate__c/.test(q)).length;
    expect(attempts).toBe(3);
    const report = assembleReport(ex, classifyAll(ex), {
      version: 't',
      runId: 'r',
      org: { name: 'x', username: 'u', instanceUrl: 'i', orgId: 'o' },
      now: NOW,
    });
    expect(report.buckets.find((b) => b.id === 'output')?.unread).toEqual([
      'SBQQ__QuoteTemplate__c',
    ]);
  }, 20_000);
});

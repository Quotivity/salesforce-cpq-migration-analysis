import { expect, test } from '@playwright/test';

const HUBSPOT = /api\.hsforms\.com/;
const PORTAL = '243933280';
const GATE = '78c7c119-3bf5-49d9-8c31-6122cfda26b3';
const MEETING = '7a3e9649-209b-415d-81d0-bf6fe002e105';
const controlPort = Number(process.env.CPQ_E2E_PORT ?? 3590) + 1;

interface FormBody {
  fields: { name: string; value: string }[];
}

async function fillGate(page: import('@playwright/test').Page) {
  await page.getByLabel('First name*').fill('Acme');
  await page.getByLabel('Last name*').fill('Admin');
  await page.getByLabel('Email*').fill('admin@acme.com');
}

test.describe('CPQ Inventory report', () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`http://127.0.0.1:${controlPort}/reset`);
  });

  test('gate → scan → inventory → analysis → close, with the two outbound requests only', async ({
    page,
    context,
  }) => {
    const outbound: string[] = [];
    const bodies: FormBody[] = [];
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (HUBSPOT.test(url)) {
        outbound.push(url);
        bodies.push(route.request().postDataJSON() as FormBody);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{"inlineMessage":"ok"}',
        });
      }
      if (!/^http:\/\/127\.0\.0\.1:\d+\//.test(url)) outbound.push(url);
      return route.continue();
    });

    await page.goto('/');
    await expect(page.getByText('This report is being served from')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /considering a move to HubSpot/ }),
    ).toBeVisible();

    // Four landing slides.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByRole('heading', { name: /HubSpot covers the CRM completely/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByRole('heading', { name: /Quotivity is the quoting layer/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText('Your data never leaves your machine.')).toBeVisible();
    await page.getByRole('button', { name: 'Start Analysis' }).click();

    // Hard gate: no name and email, no analysis.
    await expect(
      page.getByRole('heading', { name: 'Where should the analysis go?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Start the Analysis' }).click();
    await expect(page.getByText('Enter your first name')).toBeVisible();
    await expect(page.getByText('Enter your last name')).toBeVisible();
    await expect(page.getByText('Enter valid email address')).toBeVisible();
    await fillGate(page);
    await page.getByLabel('Email*').fill('not-an-email');
    await page.getByRole('button', { name: 'Start the Analysis' }).click();
    await expect(page.getByText('Enter valid email address')).toBeVisible();
    const state = await (await page.request.get('/api/state')).json();
    expect(state.status).toBe('idle');
    expect(outbound).toEqual([]);

    await page.getByLabel('Email*').fill('admin@acme.com');
    await page.getByRole('button', { name: 'Start the Analysis' }).click();

    // Scanning shows progress, then unlocks stage 1.
    await expect(page.getByRole('heading', { name: 'Reading your org' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What is in your org' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Alive measured over the trailing')).toBeVisible();
    await expect(page.locator('.card')).toHaveCount(10);
    await expect(page.getByRole('button', { name: 'Inventory' })).toHaveClass(/active/);

    await page.getByRole('button', { name: 'Expand every breakdown' }).click();
    await expect(page.locator('.breakdown')).toHaveCount(10);
    await expect(page.getByText('Filter rules — dynamic option sets')).toBeVisible();

    await page.getByRole('button', { name: 'See Where It Lands' }).click();
    await expect(page.getByRole('heading', { name: 'Where each piece lands' })).toBeVisible();
    await expect(page.locator('.tile')).toHaveCount(3);
    await expect(page.locator('.map-row')).toHaveCount(34);
    await expect(page.getByText('Requires further review')).toBeVisible();
    await expect(page.locator('.review-row')).toHaveCount(3);

    await page.getByRole('button', { name: 'Next: Share This Analysis' }).click();
    await expect(page.getByRole('heading', { name: /Share this analysis/ })).toBeVisible();
    await expect(page.getByText('quotivity-cpq-inventory-acme-prod-2026-09-12.pdf')).toBeVisible();

    // Share = the meeting-request form, in a modal opened by the button. The message is required.
    await page.getByRole('button', { name: 'Schedule a Free Consultation' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Send and Schedule' }).click();
    await expect(
      page.getByText('Tell us a little about your configuration or migration'),
    ).toBeVisible();
    expect(outbound).toHaveLength(1);
    await page
      .getByLabel(/Tell us about your configuration/)
      .fill('Three QCPs and a lot of contracted pricing.');
    await page.getByLabel('Migration timing').selectOption('3-to-6');
    await page.getByRole('button', { name: 'Send and Schedule' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Sent. Pick a time that suits you.')).toBeVisible();

    // Exactly the two HubSpot form posts left the machine: the gate and the meeting request.
    expect(outbound).toEqual([
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL}/${GATE}`,
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL}/${MEETING}`,
    ]);
    const gate = bodies[0] as FormBody;
    expect(gate.fields.map((f) => f.name)).toEqual([
      'firstname',
      'lastname',
      'email',
      'cpq_inventory_version',
      'cpq_inventory_run_id',
      'lead_source',
    ]);
    expect(gate.fields.slice(0, 3).map((f) => f.value)).toEqual([
      'Acme',
      'Admin',
      'admin@acme.com',
    ]);
    const meeting = bodies[1] as FormBody;
    const summary =
      meeting.fields.find((f) => f.name === 'salesforce_cpq_migration_analysis_result')?.value ??
      '';
    expect(summary).toContain('STAGE 1 · INVENTORY');
    expect(summary).toContain('Clear path: 21');
    expect(meeting.fields.find((f) => f.name === 'message')?.value).toBe(
      'Three QCPs and a lot of contracted pricing.',
    );
    expect(meeting.fields.find((f) => f.name === 'migration_timing')?.value).toBe('3-to-6');
    expect(summary).not.toContain('Platform Bundle'); // never a product name
    expect(summary).not.toContain('Globex'); // never a customer
  });

  test('print control opens the self-contained document, which prints itself and stays open', async ({
    page,
    context,
  }) => {
    await page.goto('/');
    await page.request.post('/api/run');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'What is in your org' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'Share' }).click();

    await context.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('button', { name: 'Print the Report as a PDF' }).click(),
    ]);
    await tab.waitForLoadState('load');
    expect(tab.url()).toMatch(/\/report\?print=1$/);
    await expect(tab).toHaveTitle('quotivity-cpq-inventory-acme-prod-2026-09-12');
    await expect(tab.locator('.print-ident')).toHaveCount(2);
    await expect(tab.locator('.dense-rows')).toHaveCount(10); // everything expanded
    await expect(tab.locator('.btn')).toHaveCount(0); // no controls
    await expect
      .poll(() => tab.evaluate(() => (window as unknown as { __printed: number }).__printed))
      .toBe(1);
    expect(tab.isClosed()).toBe(false);
    await expect(page.getByText('Opened in a new tab, with the print dialog up.')).toBeVisible();

    // The document is self-contained: no external script, stylesheet, or image references.
    const html = await tab.content();
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html).toMatch(/data:font\/ttf;base64,/);
    expect(html).toMatch(/<img[^>]+src="data:image\/png/);

    const pdf = await tab.pdf({ format: 'A4', printBackground: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
  });

  test('offline gate still runs the analysis and says so', async ({ page, context }) => {
    await context.route(HUBSPOT, (route) => route.abort('failed'));
    await page.goto('/');
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Start Analysis' }).click();
    await fillGate(page);
    await page.getByRole('button', { name: 'Start the Analysis' }).click();
    await expect(page.getByText('We could not register your email')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What is in your org' })).toBeVisible({
      timeout: 20_000,
    });
  });
});

import { useState } from 'react';
import { External } from '../components/Icons';

const CMP: { name: string; rows: { label: string; hs: true | false | 'partial' }[] }[] = [
  {
    name: 'CRM',
    rows: [
      { label: 'Sales — contacts, accounts, opportunities, tasks, sequences', hs: true },
      { label: 'Service — help desk, knowledge base', hs: true },
      { label: 'Marketing — email, ad tracking, landing pages', hs: true },
      { label: 'AI & agents — prospecting, customers, AEO, administration', hs: true },
    ],
  },
  {
    name: 'CPQ',
    rows: [
      { label: 'Complex pricing', hs: false },
      { label: 'Guided selling', hs: false },
      { label: 'Product configurator', hs: false },
      { label: 'Customizable templates', hs: 'partial' },
    ],
  },
];

const PRIVACY = [
  {
    ok: true,
    text: 'Queries are read-only, through the connection the Salesforce CLI already holds',
  },
  { ok: true, text: 'Results are written to disk and served to this browser from localhost only' },
  {
    ok: false,
    text: 'No Quotivity connected app, no OAuth grant, no credential written or transmitted',
  },
  {
    ok: false,
    text: 'Nothing about your configuration is sent unless you click the share button at the end',
  },
];

function HsMark({ hs }: { hs: true | false | 'partial' }) {
  const color = hs === true ? '#047251' : hs === 'partial' ? '#E0A11B' : '#C0392B';
  return (
    <div className="cmp-hs" style={{ color }}>
      {hs === true ? '✓' : hs === 'partial' ? '●' : '✕'}
    </div>
  );
}

function CmpTable({ withQuotivity }: { withQuotivity: boolean }) {
  return (
    <div className="cmp">
      <div className="cmp-head">
        <div className="cmp-label" style={{ minWidth: withQuotivity ? 170 : 180 }}>
          Capability
        </div>
        <div className="cmp-hs">HubSpot</div>
        {withQuotivity && <div className="cmp-q">+ Quotivity</div>}
      </div>
      {CMP.map((g) => (
        <div key={g.name}>
          <div className="cmp-group">{g.name}</div>
          {g.rows.map((r) => (
            <div key={r.label} className="cmp-row">
              <div className="cmp-label" style={{ minWidth: withQuotivity ? 170 : 180 }}>
                {r.label}
              </div>
              <HsMark hs={r.hs} />
              {withQuotivity && <div className="cmp-q">✓</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Landing({ onStart, sourceUrl }: { onStart: () => void; sourceUrl: string }) {
  const [step, setStep] = useState(1);
  const next = () => (step === 4 ? onStart() : setStep(step + 1));
  return (
    <div className="wrap landing">
      <div className="landing-inner">
        {step === 1 && (
          <div className="slide">
            <div className="eyebrow">CPQ Inventory &amp; Migration Analysis</div>
            <h1 className="hero">
              You're considering a move to HubSpot, but the CPQ gap is a concern.
            </h1>
            <div className="lede-17">
              <div>
                The CRM side is settled. HubSpot wins that comparison on its own merits and nobody
                needs a tool to tell them so.
              </div>
              <div>
                Quoting is where the decision stalls. Years of bundles, pricing rules, discount
                schedules, guardrails and approvals sit in Salesforce CPQ, and no one can say with
                confidence what happens to them.
              </div>
              <div>This tool answers that — against your own org, on your own machine.</div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="slide">
            <div className="eyebrow">Where HubSpot stops</div>
            <h1>HubSpot covers the CRM completely. Quoting is where it runs out.</h1>
            <div className="lede" style={{ marginBottom: 26 }}>
              Sales, service, marketing and AI are all there. Every capability a CPQ org depends on
              is not.
            </div>
            <CmpTable withQuotivity={false} />
          </div>
        )}
        {step === 3 && (
          <div className="slide">
            <div className="eyebrow">Where Quotivity picks it up</div>
            <h1>Quotivity is the quoting layer, built only for HubSpot.</h1>
            <div className="lede" style={{ marginBottom: 26 }}>
              Configurable products, calculated pricing, volume tiers, guardrails, approvals,
              templates and terms — built for teams using HubSpot, not bolted alongside it.
            </div>
            <CmpTable withQuotivity />
            <div className="muted-14" style={{ marginTop: 16 }}>
              Which leaves the real question: does <em>your</em> configuration fit that layer?
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="slide">
            <div className="eyebrow">What this tool does</div>
            <h1 className="h32-20">It reads your org and tells you where every piece lands.</h1>
            <div className="lede-grid">
              <div>
                Your Salesforce CPQ configuration is sorted into functional areas — what you sell,
                how it is configured, how a price reaches a line, what stops a rep, who approves,
                what the customer receives.
              </div>
              <div>
                Every construct is mapped to its Quotivity or HubSpot equivalent and given one
                verdict, on one question — does the behaviour survive? A clear path, degraded, or no
                target at all.
              </div>
              <div>
                It does not price the migration, estimate how long it takes, or compare licence
                costs.
              </div>
            </div>
            <div className="box-brand" style={{ marginTop: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0F2E22', marginBottom: 11 }}>
                Your data never leaves your machine. Run it, read it, and decide for yourself
                whether to talk to us.
              </div>
              <div className="checklist">
                {PRIVACY.map((p) => (
                  <div key={p.text}>
                    <span className={`mark ${p.ok ? 'yes' : 'no'}`}>{p.ok ? '✓' : '×'}</span>
                    <span>{p.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="muted-13" style={{ marginTop: 14 }}>
              Two outbound requests exist, both user-initiated: the email form on the next screen,
              and the share button at the end.{' '}
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'baseline', gap: 4 }}
              >
                The source is published
                <External size={11} lift />
              </a>{' '}
              — read it before you run it.
            </div>
          </div>
        )}

        <div className="landing-nav">
          <button type="button" className="btn" onClick={next}>
            {step === 4 ? 'Start Analysis' : 'Continue'}
          </button>
          {step > 1 && (
            <button
              type="button"
              className="btn-back"
              onClick={() => setStep(Math.max(1, step - 1))}
            >
              Back
            </button>
          )}
          <div className="spacer" style={{ minWidth: 20 }} />
          <div className="dots">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`Slide ${n} of 4`}
                className={step === n ? 'active' : ''}
                onClick={() => setStep(n)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

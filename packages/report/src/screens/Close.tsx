import type { ReportData } from '@quotivity/cpq-inventory-core';
import { useState } from 'react';
import { type MeetingDetails, MIGRATION_TIMING_OPTIONS } from '../api';

const SEND = [
  { ok: true, text: 'The rendered report — the ten buckets, the mapping, the verdicts' },
  { ok: true, text: 'The names of the custom scripts flagged for review' },
  { ok: true, text: 'Your message below and, if you choose one, your migration timing' },
  { ok: false, text: 'Not the query results underneath it' },
  { ok: false, text: 'No product names, prices, customers, code or org access' },
];

export function Close({
  report,
  email,
  offline,
  onShare,
}: {
  report: ReportData;
  email: string;
  offline: boolean;
  onShare: (details: MeetingDetails) => Promise<'sent' | 'offline'>;
}) {
  const [message, setMessage] = useState('');
  const [timing, setTiming] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [shared, setShared] = useState<'idle' | 'sending' | 'sent' | 'offline'>('idle');
  const [printed, setPrinted] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const printUrl = './report?print=1';

  const doPrint = () => {
    // Synchronously inside the click handler: a window opened from an async continuation loses its
    // user-gesture credit and the popup blocker eats it.
    const tab = window.open(printUrl, '_blank');
    if (!tab) {
      setBlocked(new URL(printUrl, window.location.href).toString());
      return;
    }
    setBlocked(null);
    setPrinted(true);
  };
  const doShare = async () => {
    if (shared === 'sending' || shared === 'sent') return;
    if (!message.trim()) {
      setMessageError(true);
      return;
    }
    setShared('sending');
    setShared(await onShare({ message: message.trim(), migrationTiming: timing || undefined }));
  };

  return (
    <div className="wrap close">
      <h1 className="h32-14">Share this analysis and schedule a free consultation</h1>
      <div className="lede">
        One action: it sends the report you just read and books the call in the same step. It sends
        the rendered report — not the query results underneath it. The print control is the
        alternative for anyone who would rather attach a PDF themselves.
      </div>

      {offline && (
        <div className="box-warn" style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#8A4A17', marginBottom: 5 }}>
            Your email could not be registered when the analysis started
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: '#5C4A38' }}>
            This machine could not reach Quotivity then. The button below tries again; if it cannot
            get through either, print the report to PDF and email it to us directly.
          </div>
        </div>
      )}

      <div className="share-form">
        <label htmlFor="q-message" className="label">
          Tell us about your configuration or migration*
        </label>
        <textarea
          id="q-message"
          className={`input textarea${messageError ? ' invalid' : ''}`}
          value={message}
          rows={5}
          placeholder="What prompted the analysis, what you saw in it that you did not expect, anything about your configuration or timing that a first call should start from."
          onChange={(e) => {
            setMessage(e.target.value);
            setMessageError(false);
          }}
          disabled={shared === 'sent'}
        />
        {messageError && (
          <div className="error-13">Tell us a little about your configuration or migration</div>
        )}

        <label htmlFor="q-timing" className="label" style={{ marginTop: 18 }}>
          Migration timing
        </label>
        <select
          id="q-timing"
          className="input select"
          value={timing}
          onChange={(e) => setTiming(e.target.value)}
          disabled={shared === 'sent'}
        >
          <option value="">Not decided yet</option>
          {MIGRATION_TIMING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <div style={{ marginTop: 9, fontSize: 13, color: '#6E7C73' }}>
          Optional. It helps us pick the right person for the call.
        </div>
      </div>

      <div className="box-plain xl" style={{ marginTop: 28 }}>
        <div className="send-title">What this button sends</div>
        <div className="checklist">
          {SEND.map((s) => (
            <div key={s.text}>
              <span className={`mark ${s.ok ? 'yes' : 'no'}`} style={{ fontWeight: 400 }}>
                {s.ok ? '✓' : '×'}
              </span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={doShare}
          disabled={shared === 'sending' || shared === 'sent'}
        >
          {shared === 'sent'
            ? 'Analysis Sent'
            : shared === 'sending'
              ? 'Sending…'
              : 'Schedule a Free Consultation'}
        </button>
        <button type="button" className="btn-outline" onClick={doPrint}>
          Print the Report as a PDF
        </button>
      </div>
      <div className="filename">{report.fileName}.pdf</div>
      <div className="muted-13" style={{ marginTop: 10 }}>
        Printing opens the full report in a new tab and hands it to your browser's print dialog —
        save it as a PDF and it attaches to an email like any other document. Served from localhost,
        so this is not one of the two outbound requests.
      </div>

      {blocked && (
        <div className="box-warn" style={{ marginTop: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#8A4A17', marginBottom: 5 }}>
            Your browser blocked the new tab
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: '#5C4A38' }}>
            Open the print document directly:{' '}
            <a href={blocked} target="_blank" rel="noopener noreferrer">
              {blocked}
            </a>
            . It prints itself once it has loaded.
          </div>
        </div>
      )}

      {shared === 'sent' && (
        <div className="box-brand" style={{ marginTop: 28 }}>
          <div className="confirm-title">Sent. Pick a time that suits you.</div>
          <div className="confirm-body">
            The report is with the Quotivity team and a booking link is on its way to{' '}
            {email || 'your address'}. The local copy stays on this machine until you delete it.
          </div>
        </div>
      )}
      {shared === 'offline' && (
        <div className="box-warn" style={{ marginTop: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#8A4A17', marginBottom: 5 }}>
            We could not reach Quotivity from this machine
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: '#5C4A38' }}>
            A proxy, a VPN or an egress rule, most likely. Nothing was sent. Print the report to PDF
            and email it to us directly — the PDF is the same document.
          </div>
        </div>
      )}
      {printed && (
        <div className="box-plain lg" style={{ marginTop: 28 }}>
          <div className="confirm-title">Opened in a new tab, with the print dialog up.</div>
          <div className="confirm-body">
            The tab stays open — print again or adjust the page range if you need to. Nothing was
            transmitted. Press Ctrl-C in the terminal when you are done and the server stops.
          </div>
        </div>
      )}

      <div className="footer">
        @quotivity/cpq-inventory v{report.version} · run {report.runId} · source published at{' '}
        {report.sourceUrl.replace(/^https?:\/\//, '')}
        <br />
        Server bound to localhost only · Ctrl-C in the terminal to stop
      </div>
    </div>
  );
}

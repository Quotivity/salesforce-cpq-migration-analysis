import { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Gate({
  onSubmit,
  privacyPolicyUrl,
  busy,
}: {
  onSubmit: (email: string) => void;
  privacyPolicyUrl: string;
  busy: boolean;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);
  const submit = () => {
    const v = email.trim();
    if (!EMAIL_RE.test(v)) return setError(true);
    onSubmit(v);
  };
  return (
    <div className="wrap gate">
      <h1 className="h28">Where should the analysis go?</h1>
      <div className="lede" style={{ marginBottom: 26 }}>
        Your Salesforce data stays on this machine. The only thing sent to Quotivity is your email
        address.
      </div>
      <div className="soft-14" style={{ marginBottom: 28 }}>
        Alongside it: the plugin version, a run identifier, and the lead source. No counts, no
        object names, nothing about your configuration.
      </div>

      <label htmlFor="q-email" className="label">
        Email*
      </label>
      <input
        id="q-email"
        type="email"
        className={`input${error ? ' invalid' : ''}`}
        value={email}
        placeholder="you@company.com"
        autoComplete="email"
        onChange={(e) => {
          setEmail(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {error && <div className="error-13">Enter valid email address</div>}
      <div style={{ marginTop: 9, fontSize: 13, color: '#6E7C73' }}>
        We take your company from the domain, so that is the only field.
      </div>

      <div style={{ marginTop: 22, fontSize: 13, lineHeight: 1.6, color: '#5C6B62' }}>
        By submitting, you agree to receive communications from Quotivity. Unsubscribe at any time.
        See our{' '}
        <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        .
      </div>

      <button
        type="button"
        className="btn"
        style={{ marginTop: 24 }}
        onClick={submit}
        disabled={busy}
      >
        {busy ? 'Registering…' : 'Start the Analysis'}
      </button>

      <div className="gate-foot muted-13">
        Nothing has been queried yet. The first SOQL call is made when you submit this form, not
        before — a reader of the source can check that.
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Identity } from '../api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function Gate({
  onSubmit,
  privacyPolicyUrl,
  busy,
}: {
  onSubmit: (who: Identity) => void;
  privacyPolicyUrl: string;
  busy: boolean;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ first?: boolean; last?: boolean; email?: boolean }>({});
  const submit = () => {
    const next = {
      first: !firstName.trim(),
      last: !lastName.trim(),
      email: !EMAIL_RE.test(email.trim()),
    };
    setErrors(next);
    if (next.first || next.last || next.email) return;
    onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() });
  };
  const onKey = (e: React.KeyboardEvent) => e.key === 'Enter' && submit();
  return (
    <div className="wrap gate">
      <h1 className="h28">Where should the analysis go?</h1>
      <div className="lede" style={{ marginBottom: 26 }}>
        Your Salesforce data stays on this machine. The only things sent to Quotivity are your name
        and email address.
      </div>
      <div className="soft-14" style={{ marginBottom: 28 }}>
        Alongside them: the plugin version, a run identifier, and the lead source. No counts, no
        object names, nothing about your configuration.
      </div>

      <div className="name-row">
        <div>
          <label htmlFor="q-first" className="label">
            First name*
          </label>
          <input
            id="q-first"
            type="text"
            className={`input${errors.first ? ' invalid' : ''}`}
            value={firstName}
            placeholder="Jordan"
            autoComplete="given-name"
            onChange={(e) => {
              setFirstName(e.target.value);
              setErrors((s) => ({ ...s, first: false }));
            }}
            onKeyDown={onKey}
          />
          {errors.first && <div className="error-13">Enter your first name</div>}
        </div>
        <div>
          <label htmlFor="q-last" className="label">
            Last name*
          </label>
          <input
            id="q-last"
            type="text"
            className={`input${errors.last ? ' invalid' : ''}`}
            value={lastName}
            placeholder="Lee"
            autoComplete="family-name"
            onChange={(e) => {
              setLastName(e.target.value);
              setErrors((s) => ({ ...s, last: false }));
            }}
            onKeyDown={onKey}
          />
          {errors.last && <div className="error-13">Enter your last name</div>}
        </div>
      </div>

      <label htmlFor="q-email" className="label" style={{ marginTop: 18 }}>
        Email*
      </label>
      <input
        id="q-email"
        type="email"
        className={`input${errors.email ? ' invalid' : ''}`}
        value={email}
        placeholder="you@company.com"
        autoComplete="email"
        onChange={(e) => {
          setEmail(e.target.value);
          setErrors((s) => ({ ...s, email: false }));
        }}
        onKeyDown={onKey}
      />
      {errors.email && <div className="error-13">Enter valid email address</div>}
      <div style={{ marginTop: 9, fontSize: 13, color: '#6E7C73' }}>
        We take your company from the domain, so there is no company field.
      </div>

      <div style={{ marginTop: 22, fontSize: 13, lineHeight: 1.6, color: '#5C6B62' }}>
        By submitting this form, you consent to Quotivity storing and processing your information to
        send you product updates, marketing, and related communications. We do not sell your data.
        You may withdraw consent or unsubscribe at any time using the link in any email, or by
        contacting <a href="mailto:privacy@quotivity.com">privacy@quotivity.com</a>. See our{' '}
        <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>{' '}
        for details.
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

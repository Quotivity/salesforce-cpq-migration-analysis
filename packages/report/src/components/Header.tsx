import wordmark from '../assets/q-wordmark-light.png?inline';
import { ArrowUp, External } from './Icons';

export type Stage = 'landing' | 'gate' | 'scanning' | 'inventory' | 'analysis' | 'close';

const RAIL: { id: Stage; label: string }[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'analysis', label: 'Migration analysis' },
  { id: 'close', label: 'Share' },
];

export function Header({
  stage,
  unlocked,
  onGo,
  learnMoreUrl,
}: {
  stage: Stage;
  unlocked: boolean;
  onGo: (s: Stage) => void;
  learnMoreUrl: string;
}) {
  return (
    <>
      <div className="banner">
        <div className="wrap">
          <ArrowUp />
          <div className="banner-text">
            This report is being served from <span className="banner-host">localhost</span> — your
            own machine. Nothing here has been uploaded anywhere.
          </div>
        </div>
      </div>
      <div className="header">
        <div className="wrap header-row">
          <div className="brand">
            <img src={wordmark} alt="Quotivity" />
            <span className="brand-sub">Salesforce CPQ to HubSpot Migration Analysis Tool</span>
          </div>
          <div className="spacer" />
          <a className="learn" href={learnMoreUrl} target="_blank" rel="noopener noreferrer">
            Learn more about Quotivity
            <External />
          </a>
        </div>
        {unlocked && (
          <div className="wrap rail">
            {RAIL.map((r) => (
              <button
                key={r.id}
                type="button"
                className={stage === r.id ? 'active' : ''}
                onClick={() => onGo(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

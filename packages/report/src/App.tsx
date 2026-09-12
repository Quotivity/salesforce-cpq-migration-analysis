import type { ProgressEvent, ReportData } from '@quotivity/cpq-inventory-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getReport,
  getShareSummary,
  getState,
  isPrintMode,
  type ServerState,
  startRun,
  submitGate,
  submitMeetingRequest,
  subscribeProgress,
} from './api';
import { Header, type Stage } from './components/Header';
import { PrintDocument } from './print/PrintDocument';
import { Analysis } from './screens/Analysis';
import { Close } from './screens/Close';
import { Gate } from './screens/Gate';
import { Inventory } from './screens/Inventory';
import { Landing } from './screens/Landing';
import { Scanning } from './screens/Scanning';

const FALLBACK_LEARN = 'https://quotivity.com';
const FALLBACK_SOURCE = 'https://github.com/quotivity/salesforce-cpq-migration-analysis';
const FALLBACK_PRIVACY = 'https://quotivity.com/privacy';

export function App() {
  if (isPrintMode() && window.__CPQ_REPORT__)
    return <PrintDocument report={window.__CPQ_REPORT__} />;
  return <Interactive />;
}

function Interactive() {
  const [stage, setStage] = useState<Stage>('landing');
  const [server, setServer] = useState<ServerState | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [offline, setOffline] = useState(false);
  const [runError, setRunError] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const unsubscribe = useRef<(() => void) | null>(null);

  const loadReport = useCallback(async () => {
    const r = await getReport();
    setReport(r);
    setStage('inventory');
  }, []);

  const watch = useCallback(() => {
    unsubscribe.current?.();
    unsubscribe.current = subscribeProgress({
      onEvent: (e) => setProgress((p) => [...p, e]),
      onDone: () =>
        void loadReport().catch((err: unknown) =>
          setRunError(err instanceof Error ? err.message : String(err)),
        ),
      onError: (detail) => setRunError(detail),
    });
  }, [loadReport]);

  // Resume where the server is: a reload after the run finished lands on the inventory.
  useEffect(() => {
    getState()
      .then(async (s) => {
        setServer(s);
        setProgress(s.progress);
        if (s.status === 'done') await loadReport();
        else if (s.status === 'running') {
          setStage('scanning');
          watch();
        } else if (s.status === 'error') {
          setStage('scanning');
          setRunError(s.error);
        }
      })
      .catch((err: unknown) => setFatal(err instanceof Error ? err.message : String(err)));
    return () => unsubscribe.current?.();
  }, [loadReport, watch]);

  const onGate = async (value: string) => {
    if (!server) return;
    setBusy(true);
    setEmail(value);
    const result = await submitGate(server.outbound, value, server.version, server.runId);
    setOffline(result === 'offline');
    setStage('scanning');
    setBusy(false);
    try {
      await startRun(); // the first SOQL call happens inside this request
      watch();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    }
  };

  const onShare = async (): Promise<'sent' | 'offline'> => {
    if (!server) return 'offline';
    try {
      const summary = await getShareSummary();
      return await submitMeetingRequest(
        server.outbound,
        email,
        server.version,
        server.runId,
        summary,
      );
    } catch {
      return 'offline';
    }
  };

  const unlocked =
    report != null && (stage === 'inventory' || stage === 'analysis' || stage === 'close');
  const outbound = server?.outbound;

  return (
    <div className="page">
      <Header
        stage={stage}
        unlocked={unlocked}
        onGo={setStage}
        learnMoreUrl={outbound?.learnMoreUrl ?? FALLBACK_LEARN}
      />
      {fatal && (
        <div className="wrap stage">
          <div className="box-error">
            <div style={{ fontSize: 14, fontWeight: 600, color: '#B23A2E', marginBottom: 5 }}>
              The local server did not answer
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: '#3C4A42' }}>
              {fatal}. Is the terminal command still running?
            </div>
          </div>
        </div>
      )}
      {!fatal && stage === 'landing' && (
        <Landing
          onStart={() => setStage('gate')}
          sourceUrl={outbound?.sourceUrl ?? FALLBACK_SOURCE}
        />
      )}
      {!fatal && stage === 'gate' && (
        <Gate
          onSubmit={(v) => void onGate(v)}
          privacyPolicyUrl={outbound?.privacyPolicyUrl ?? FALLBACK_PRIVACY}
          busy={busy || !server}
        />
      )}
      {!fatal && stage === 'scanning' && (
        <Scanning progress={progress} offline={offline} error={runError} />
      )}
      {!fatal && stage === 'inventory' && report && (
        <Inventory report={report} onNext={() => setStage('analysis')} />
      )}
      {!fatal && stage === 'analysis' && report && (
        <Analysis report={report} onNext={() => setStage('close')} />
      )}
      {!fatal && stage === 'close' && report && (
        <Close report={report} email={email} offline={offline} onShare={onShare} />
      )}
    </div>
  );
}

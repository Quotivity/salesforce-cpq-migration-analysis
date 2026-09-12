import type { OutboundConfig, ProgressEvent, ReportData } from '@quotivity/cpq-inventory-core';

export interface ServerState {
  status: 'idle' | 'running' | 'done' | 'error';
  error?: string;
  progress: ProgressEvent[];
  org: { name: string; username: string };
  version: string;
  runId: string;
  outbound: OutboundConfig;
  assets: boolean;
}

declare global {
  interface Window {
    __CPQ_REPORT__?: ReportData;
    __CPQ_PRINT__?: boolean;
  }
}

export const isPrintMode = (): boolean => !!window.__CPQ_PRINT__ && !!window.__CPQ_REPORT__;

export async function getState(): Promise<ServerState> {
  const res = await fetch('/api/state', { cache: 'no-store' });
  if (!res.ok) throw new Error(`state ${res.status}`);
  return (await res.json()) as ServerState;
}

export async function getReport(): Promise<ReportData> {
  const res = await fetch('/api/report.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`report ${res.status}`);
  return (await res.json()) as ReportData;
}

export async function getShareSummary(): Promise<string> {
  const res = await fetch('/api/share-summary', { cache: 'no-store' });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return ((await res.json()) as { summary: string }).summary;
}

/** The first SOQL call happens inside this request handler on the server — never before. */
export async function startRun(): Promise<void> {
  const res = await fetch('/api/run', { method: 'POST' });
  if (!res.ok && res.status !== 202) throw new Error(`run ${res.status}`);
}

export function subscribeProgress(handlers: {
  onEvent: (e: ProgressEvent) => void;
  onDone: () => void;
  onError: (detail: string) => void;
}): () => void {
  const source = new EventSource('/api/progress');
  source.onmessage = (m) => handlers.onEvent(JSON.parse(m.data) as ProgressEvent);
  source.addEventListener('done', () => {
    source.close();
    handlers.onDone();
  });
  source.addEventListener('error', (ev) => {
    const detail = (ev as MessageEvent).data
      ? (JSON.parse((ev as MessageEvent).data) as { detail?: string }).detail
      : undefined;
    if (detail) {
      source.close();
      handlers.onError(detail);
    }
  });
  return () => source.close();
}

/**
 * HubSpot Forms API v3 submission. Field names must match the internal names on the two HubSpot
 * forms; they are kept here in one place. The gate carries the email, plugin version, run id and
 * lead source only. The meeting form adds the report summary.
 */
export const HUBSPOT_FIELDS = {
  email: 'email',
  version: 'cpq_inventory_version',
  runId: 'cpq_inventory_run_id',
  leadSource: 'lead_source',
} as const;

interface HubSpotFormBody {
  fields: { name: string; value: string }[];
  context: { pageUri: string; pageName: string };
  legalConsentOptions?: unknown;
}

async function submitHubSpotForm(
  portalId: string,
  formGuid: string,
  fields: { name: string; value: string }[],
  pageName: string,
): Promise<'sent' | 'offline'> {
  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formGuid}`;
  const body: HubSpotFormBody = {
    fields,
    context: { pageUri: 'https://quotivity.com/cpq-inventory', pageName },
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      mode: 'cors',
    });
    return res.ok ? 'sent' : 'offline';
  } catch {
    return 'offline';
  }
}

export function submitGate(
  outbound: OutboundConfig,
  email: string,
  version: string,
  runId: string,
): Promise<'sent' | 'offline'> {
  if (!outbound.configured) return Promise.resolve('offline');
  return submitHubSpotForm(
    outbound.portalId,
    outbound.gateFormGuid,
    [
      { name: HUBSPOT_FIELDS.email, value: email },
      { name: HUBSPOT_FIELDS.version, value: version },
      { name: HUBSPOT_FIELDS.runId, value: runId },
      { name: HUBSPOT_FIELDS.leadSource, value: outbound.leadSource },
    ],
    'CPQ Inventory — email gate',
  );
}

export function submitMeetingRequest(
  outbound: OutboundConfig,
  email: string,
  version: string,
  runId: string,
  summary: string,
): Promise<'sent' | 'offline'> {
  if (!outbound.configured) return Promise.resolve('offline');
  return submitHubSpotForm(
    outbound.portalId,
    outbound.meetingFormGuid,
    [
      { name: HUBSPOT_FIELDS.email, value: email },
      { name: HUBSPOT_FIELDS.version, value: version },
      { name: HUBSPOT_FIELDS.runId, value: runId },
      { name: HUBSPOT_FIELDS.leadSource, value: outbound.leadSource },
      { name: outbound.meetingSummaryField, value: summary },
    ],
    'CPQ Inventory — share and schedule',
  );
}

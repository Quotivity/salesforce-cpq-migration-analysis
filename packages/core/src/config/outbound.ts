/**
 * The only two outbound requests the tool makes, both user-initiated, both HubSpot form
 * submissions made from the browser. Portal ID and form GUIDs are public and compiled in.
 */
export const HUBSPOT_PORTAL_ID = '243933280';
/** Email gate — email capture form. Carries name, email, plugin version, run id, lead source. */
export const HUBSPOT_GATE_FORM_GUID = '78c7c119-3bf5-49d9-8c31-6122cfda26b3';
/** Close screen — meeting request form. Carries the same plus the rendered report summary. */
export const HUBSPOT_MEETING_FORM_GUID = '7a3e9649-209b-415d-81d0-bf6fe002e105';
/** Internal name of the contact property on the meeting form that receives the report summary. */
export const HUBSPOT_MEETING_SUMMARY_FIELD = 'salesforce_cpq_migration_analysis_result';
export const LEAD_SOURCE = 'cpq-inventory-tool';
export const SOURCE_URL = 'https://github.com/quotivity/salesforce-cpq-migration-analysis';
export const PRIVACY_POLICY_URL = 'https://quotivity.com/privacy';
export const LEARN_MORE_URL = 'https://quotivity.com';

/** HubSpot multi-line text fields hold at most 65,536 characters. */
export const HUBSPOT_MULTILINE_LIMIT = 65_536;

export function hubspotFormUrl(formGuid: string): string {
  return `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${formGuid}`;
}

export interface OutboundConfig {
  portalId: string;
  gateFormGuid: string;
  meetingFormGuid: string;
  meetingSummaryField: string;
  leadSource: string;
  sourceUrl: string;
  privacyPolicyUrl: string;
  learnMoreUrl: string;
  configured: boolean;
}

export function outboundConfig(): OutboundConfig {
  const configured = ![HUBSPOT_PORTAL_ID, HUBSPOT_GATE_FORM_GUID, HUBSPOT_MEETING_FORM_GUID].some(
    (v) => v.startsWith('REPLACE_WITH_'),
  );
  return {
    portalId: HUBSPOT_PORTAL_ID,
    gateFormGuid: HUBSPOT_GATE_FORM_GUID,
    meetingFormGuid: HUBSPOT_MEETING_FORM_GUID,
    meetingSummaryField: HUBSPOT_MEETING_SUMMARY_FIELD,
    leadSource: LEAD_SOURCE,
    sourceUrl: SOURCE_URL,
    privacyPolicyUrl: PRIVACY_POLICY_URL,
    learnMoreUrl: LEARN_MORE_URL,
    configured,
  };
}

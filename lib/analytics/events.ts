// Central analytics event map. Names are stable identifiers; tracking is
// non-invasive and only active when an analytics provider is configured.

export const ANALYTICS_EVENTS = {
  briefing_click: "briefing_click",
  data_room_request_click: "data_room_request_click",
  qassas_demo_click: "qassas_demo_click",
  contact_submit: "contact_submit",
  document_view_attempt: "document_view_attempt",
  signed_url_approved: "signed_url_approved",
  signed_url_denied: "signed_url_denied",
  admin_approve: "admin_approve",
  admin_decline: "admin_decline",
  access_level_change: "access_level_change",
} as const;

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type AnalyticsProps = Record<string, string | number | boolean | null>;

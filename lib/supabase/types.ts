// Shared types for the Akanil institutional access backend.
// Hand-maintained to mirror supabase/migrations/0001_init.sql. These can be
// replaced by generated types (`supabase gen types typescript`) once the
// project is linked.

export type AccessLevel =
  | "public"
  | "institutional_brief"
  | "nda_data_room"
  | "technical_review"
  | "partner_internal";

export type RequestStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "declined"
  | "closed";

export type NdaStatus =
  | "pending"
  | "sent"
  | "signed"
  | "approved"
  | "expired"
  | "revoked";

export const NDA_STATUSES: { value: NdaStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "approved", label: "Approved" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
];

export type AdminRole =
  | "super_admin"
  | "platform_admin"
  | "data_room_manager"
  | "content_manager"
  | "reviewer"
  | "viewer";

export const ADMIN_ROLES: { value: AdminRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "platform_admin", label: "Platform Admin" },
  { value: "data_room_manager", label: "Data Room Manager" },
  { value: "content_manager", label: "Content Manager" },
  { value: "reviewer", label: "Reviewer" },
  { value: "viewer", label: "Viewer" },
];

export type SensitivityLevel =
  | "public"
  | "internal"
  | "confidential"
  | "restricted"
  | "secret";

export type DocumentStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "published"
  | "archived";

export const SENSITIVITY_LEVELS: { value: SensitivityLevel; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "internal", label: "Internal" },
  { value: "confidential", label: "Confidential" },
  { value: "restricted", label: "Restricted" },
  { value: "secret", label: "Secret" },
];

export const DOCUMENT_STATUSES: { value: DocumentStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

// Windows a document can belong to (mirrors the public ecosystem).
export const DOCUMENT_WINDOWS = [
  "Akanil",
  "Atlas Mining",
  "HYRION",
  "ZYNTRA Deeptech",
  "QASSAS",
  "Amusnaw AI",
  "Sustainability",
  "General",
] as const;

export const REQUEST_STATUSES: RequestStatus[] = [
  "pending",
  "in_review",
  "approved",
  "declined",
  "closed",
];

// Human labels for the five Data Room layers (08 §6 / step 4).
export const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "public", label: "Public Layer" },
  { value: "institutional_brief", label: "Institutional Brief Layer" },
  { value: "nda_data_room", label: "NDA Data Room Layer" },
  { value: "technical_review", label: "Technical Review Layer" },
  { value: "partner_internal", label: "Partner / Internal Layer" },
];

export interface AccessRequest {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
  role: string | null;
  country: string | null;
  area_of_interest: string | null;
  requested_window: string | null;
  requested_level: AccessLevel | null;
  message: string | null;
  status: RequestStatus;
  nda_required: boolean;
  nda_acknowledged: boolean;
  source: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface BriefingRequest {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
  role: string | null;
  requested_topic: string | null;
  related_window: string | null;
  message: string | null;
  status: RequestStatus;
  source: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface QassasDemoRequest {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
  role: string | null;
  country: string | null;
  use_case: string | null;
  requested_access_level: string | null;
  status: RequestStatus;
  source: string | null;
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ContactMessage {
  id: string;
  full_name: string;
  email: string;
  organization: string | null;
  role: string | null;
  reason: string | null;
  message: string | null;
  status: RequestStatus;
  source: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface Organization {
  id: string;
  name: string;
  type: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  nda_status: NdaStatus;
  nda_required: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  auth_user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  admin_role: AdminRole | null;
  nda_status: NdaStatus;
  country: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WindowPermission {
  id: string;
  profile_id: string;
  window: string;
  access_level: AccessLevel;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
}

export interface DocumentAccessLog {
  id: string;
  document_id: string;
  user_id: string | null;
  organization_id: string | null;
  accessed_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export interface DocumentRecord {
  id: string;
  title: string;
  description: string | null;
  window: string | null;
  document_type: string | null;
  access_level: AccessLevel;
  sensitivity_level: SensitivityLevel;
  status: DocumentStatus;
  owner: string | null;
  review_date: string | null;
  expiry_date: string | null;
  approved_by: string | null;
  related_entity: string | null;
  tags: string[];
  storage_path: string | null; // never exposed to clients
  language: string | null;
  version: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor: string | null;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
}

// Maps a request `source` (set by the public forms) to its destination table.
export const SOURCE_TO_TABLE: Record<string, string> = {
  dataroom: "access_requests",
  briefing: "briefing_requests",
  contact: "contact_messages",
  qassas: "qassas_demo_requests",
};

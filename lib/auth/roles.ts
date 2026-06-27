import type {
  AdminRole,
  AccessLevel,
  NdaStatus,
} from "@/lib/supabase/types";

// Ranked admin roles. Higher rank => more capability.
export const ROLE_RANK: Record<AdminRole, number> = {
  super_admin: 100,
  platform_admin: 90,
  data_room_manager: 70,
  content_manager: 60,
  reviewer: 40,
  viewer: 10,
};

// Ranked access levels = Data Room layers. A permission grants access to its
// level and everything below it.
export const LEVEL_RANK: Record<AccessLevel, number> = {
  public: 0,
  institutional_brief: 1,
  nda_data_room: 2,
  technical_review: 3,
  partner_internal: 4,
};

export function roleAtLeast(role: AdminRole | null, min: AdminRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

// Capability helpers — the single source of truth for admin permissions.
export const can = {
  viewAdmin: (r: AdminRole | null) => roleAtLeast(r, "viewer"),
  reviewRequests: (r: AdminRole | null) => roleAtLeast(r, "reviewer"),
  manageContent: (r: AdminRole | null) => roleAtLeast(r, "content_manager"),
  manageDocuments: (r: AdminRole | null) => roleAtLeast(r, "data_room_manager"),
  manageNda: (r: AdminRole | null) => roleAtLeast(r, "data_room_manager"),
  assignAccess: (r: AdminRole | null) => roleAtLeast(r, "data_room_manager"),
  manageDataRoom: (r: AdminRole | null) => roleAtLeast(r, "data_room_manager"),
  administerPlatform: (r: AdminRole | null) => roleAtLeast(r, "platform_admin"),
};

// Data Room access roles bypass per-window permission checks.
export function isDataRoomBypassRole(role: AdminRole | null): boolean {
  return roleAtLeast(role, "data_room_manager");
}

export function ndaSatisfied(status: NdaStatus | null | undefined): boolean {
  return status === "approved";
}

// Whether an access level requires an approved NDA.
export function levelRequiresNda(level: AccessLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK.nda_data_room;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: "unauthenticated" | "no_window_permission" | "nda_required" | "ok";
}

/**
 * Authorize a document download/view. Pure function — all inputs are resolved
 * server-side before calling. `grantedLevel` is the highest access level the
 * user holds for the document's window (null if none).
 */
export function authorizeDocumentAccess(params: {
  role: AdminRole | null;
  ndaStatus: NdaStatus | null;
  documentLevel: AccessLevel;
  grantedLevel: AccessLevel | null;
  authenticated: boolean;
}): AccessDecision {
  const { role, ndaStatus, documentLevel, grantedLevel, authenticated } = params;

  // Public documents are always viewable.
  if (documentLevel === "public") return { allowed: true, reason: "ok" };

  if (!authenticated) return { allowed: false, reason: "unauthenticated" };

  // Admin data-room roles bypass per-window permissions but still respect NDA
  // gating unless they are platform-level administrators.
  const bypass = isDataRoomBypassRole(role);

  if (!bypass) {
    if (grantedLevel === null) return { allowed: false, reason: "no_window_permission" };
    if (LEVEL_RANK[grantedLevel] < LEVEL_RANK[documentLevel]) {
      return { allowed: false, reason: "no_window_permission" };
    }
  }

  if (
    levelRequiresNda(documentLevel) &&
    !roleAtLeast(role, "platform_admin") &&
    !ndaSatisfied(ndaStatus)
  ) {
    return { allowed: false, reason: "nda_required" };
  }

  return { allowed: true, reason: "ok" };
}

import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { LEVEL_RANK, isDataRoomBypassRole } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/session";
import type { AccessLevel } from "@/lib/supabase/types";

// Data Room windows (slug ↔ document `window` label).
export const DATA_ROOM_WINDOWS = [
  { slug: "akanil", label: "Akanil" },
  { slug: "atlas-mining", label: "Atlas Mining" },
  { slug: "hyrion", label: "HYRION" },
  { slug: "zyntra", label: "ZYNTRA Deeptech" },
  { slug: "qassas", label: "QASSAS" },
  { slug: "amusnaw-ai", label: "Amusnaw AI" },
  { slug: "sustainability", label: "Sustainability" },
  { slug: "general", label: "General" },
] as const;

export function windowBySlug(slug: string) {
  return DATA_ROOM_WINDOWS.find((w) => w.slug === slug) ?? null;
}

// Safe document shape for the client — NEVER includes storage_path.
export interface SafeDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string | null;
  access_level: AccessLevel;
  version: string | null;
  language: string | null;
  updated_at: string;
  hasFile: boolean;
}

/** Highest access level the user holds for a window (null if none). */
export async function getGrantedLevel(
  profileId: string | null,
  windowLabel: string
): Promise<AccessLevel | null> {
  if (!profileId || !isSupabaseConfigured()) return null;

  const { data } = await getServiceClient()
    .from("window_permissions")
    .select("access_level, expires_at")
    .eq("profile_id", profileId)
    .eq("window", windowLabel);

  if (!data || data.length === 0) return null;

  const now = Date.now();
  let best: AccessLevel | null = null;
  for (const row of data) {
    if (row.expires_at && new Date(row.expires_at).getTime() < now) continue;
    const lvl = row.access_level as AccessLevel;
    if (best === null || LEVEL_RANK[lvl] > LEVEL_RANK[best]) best = lvl;
  }
  return best;
}

/**
 * Documents in a window the user is allowed to SEE in the index. Listing is
 * limited to the user's granted level (admins with a data-room role see all
 * active docs). Storage paths are stripped. Downloading each file still goes
 * through the authorized signed-URL action.
 */
export async function listAccessibleDocuments(
  windowLabel: string,
  user: CurrentUser,
  grantedLevel: AccessLevel | null
): Promise<SafeDocument[]> {
  if (!isSupabaseConfigured()) return [];

  const { data } = await getServiceClient()
    .from("documents")
    .select(
      "id, title, description, document_type, access_level, version, language, updated_at, storage_path, is_active"
    )
    .eq("window", windowLabel)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (!data) return [];
  const bypass = isDataRoomBypassRole(user.role);

  return data
    .filter((d) => {
      if (d.access_level === "public") return true;
      if (bypass) return true;
      if (!grantedLevel) return false;
      return LEVEL_RANK[d.access_level as AccessLevel] <= LEVEL_RANK[grantedLevel];
    })
    .map((d) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      document_type: d.document_type,
      access_level: d.access_level as AccessLevel,
      version: d.version,
      language: d.language,
      updated_at: d.updated_at,
      hasFile: Boolean(d.storage_path), // never leak the path itself
    }));
}

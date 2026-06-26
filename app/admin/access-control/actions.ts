"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import {
  getServiceClient,
  isSupabaseConfigured,
  writeAuditLog,
} from "@/lib/supabase/server";
import {
  ADMIN_ROLES,
  NDA_STATUSES,
  ACCESS_LEVELS,
  type AdminRole,
  type NdaStatus,
  type AccessLevel,
} from "@/lib/supabase/types";

const PATH = "/admin/access-control";
const roleValues = new Set(ADMIN_ROLES.map((r) => r.value));
const ndaValues = new Set(NDA_STATUSES.map((s) => s.value));
const levelValues = new Set(ACCESS_LEVELS.map((l) => l.value));

async function requireCap(check: (r: AdminRole | null) => boolean) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!check(user.role) || !isSupabaseConfigured()) {
    redirect(PATH);
  }
  return user;
}

export async function setRoleAction(formData: FormData) {
  const user = await requireCap(can.administerPlatform);
  const profileId = String(formData.get("profileId") || "");
  const role = String(formData.get("admin_role") || "") as AdminRole;
  if (!profileId || !roleValues.has(role)) return;

  const { error } = await getServiceClient()
    .from("profiles")
    .update({ admin_role: role })
    .eq("id", profileId);
  if (error) return console.error("[akanil] setRole failed", error);

  await writeAuditLog({
    actor: user.email,
    action_type: "role_assigned",
    target_type: "profiles",
    target_id: profileId,
    metadata: { admin_role: role },
  });
  revalidatePath(PATH);
}

export async function setProfileNdaAction(formData: FormData) {
  const user = await requireCap(can.manageNda);
  const profileId = String(formData.get("profileId") || "");
  const status = String(formData.get("nda_status") || "") as NdaStatus;
  if (!profileId || !ndaValues.has(status)) return;

  const { error } = await getServiceClient()
    .from("profiles")
    .update({ nda_status: status })
    .eq("id", profileId);
  if (error) return console.error("[akanil] setProfileNda failed", error);

  await writeAuditLog({
    actor: user.email,
    action_type: "nda_status_updated",
    target_type: "profiles",
    target_id: profileId,
    metadata: { nda_status: status },
  });
  revalidatePath(PATH);
}

export async function setOrgNdaAction(formData: FormData) {
  const user = await requireCap(can.manageNda);
  const orgId = String(formData.get("orgId") || "");
  const status = String(formData.get("nda_status") || "") as NdaStatus;
  if (!orgId || !ndaValues.has(status)) return;

  const { error } = await getServiceClient()
    .from("organizations")
    .update({ nda_status: status })
    .eq("id", orgId);
  if (error) return console.error("[akanil] setOrgNda failed", error);

  await writeAuditLog({
    actor: user.email,
    action_type: "org_nda_status_updated",
    target_type: "organizations",
    target_id: orgId,
    metadata: { nda_status: status },
  });
  revalidatePath(PATH);
}

export async function grantWindowAccessAction(formData: FormData) {
  const user = await requireCap(can.assignAccess);
  const profileId = String(formData.get("profileId") || "");
  const window = String(formData.get("window") || "");
  const level = String(formData.get("access_level") || "") as AccessLevel;
  if (!profileId || !window || !levelValues.has(level)) return;

  // Upsert-style: one grant per (profile, window) at the chosen level.
  const supabase = getServiceClient();
  await supabase
    .from("window_permissions")
    .delete()
    .eq("profile_id", profileId)
    .eq("window", window);

  const { error } = await supabase.from("window_permissions").insert({
    profile_id: profileId,
    window,
    access_level: level,
    granted_by: user.email,
  });
  if (error) return console.error("[akanil] grantWindowAccess failed", error);

  await writeAuditLog({
    actor: user.email,
    action_type: "window_access_granted",
    target_type: "window_permissions",
    target_id: profileId,
    metadata: { window, access_level: level },
  });
  revalidatePath(PATH);
}

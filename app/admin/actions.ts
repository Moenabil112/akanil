"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  checkCredentials,
  createSession,
  verifySession,
} from "@/lib/admin/auth";
import {
  getServiceClient,
  isSupabaseConfigured,
  writeAuditLog,
} from "@/lib/supabase/server";
import type { RequestStatus } from "@/lib/supabase/types";

const STATUS_TABLES = new Set([
  "access_requests",
  "briefing_requests",
  "qassas_demo_requests",
  "contact_messages",
]);

const VALID_STATUS = new Set<RequestStatus>([
  "pending",
  "in_review",
  "approved",
  "declined",
  "closed",
]);

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/admin");

  if (!checkCredentials(email, password)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  const token = await createSession(email);
  cookies().set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  await writeAuditLog({
    actor: email,
    action_type: "admin_login",
    target_type: "session",
  });

  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction() {
  cookies().delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export async function updateStatusAction(formData: FormData) {
  const session = await verifySession(cookies().get(ADMIN_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  const table = String(formData.get("table") || "");
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") as RequestStatus;
  const path = String(formData.get("path") || "/admin");

  if (!STATUS_TABLES.has(table) || !id || !VALID_STATUS.has(status)) {
    return;
  }
  if (!isSupabaseConfigured()) return;

  const supabase = getServiceClient();
  const patch: Record<string, unknown> = { status };
  if (table !== "qassas_demo_requests") {
    patch.reviewed_at = new Date().toISOString();
  }

  const { error } = await supabase.from(table).update(patch).eq("id", id);
  if (error) {
    console.error("[akanil] status update failed", error);
    return;
  }

  await writeAuditLog({
    actor: session.email,
    action_type: "status_update",
    target_type: table,
    target_id: id,
    metadata: { status },
  });

  revalidatePath(path);
}

import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin/auth";
import {
  getServiceClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { isAuthConfigured, getSupabaseAuthClient } from "./supabase-ssr";
import { can } from "./roles";
import type { AdminRole, NdaStatus } from "@/lib/supabase/types";

export interface CurrentUser {
  email: string;
  role: AdminRole | null;
  ndaStatus: NdaStatus | null;
  profileId: string | null;
  organizationId: string | null;
  authUserId: string | null;
  source: "supabase" | "dev";
}

/**
 * Resolve the current user from either a Supabase Auth session (when configured)
 * or, in development with no live Supabase, the HMAC admin gate fallback (which
 * grants a super_admin dev session so the console stays testable).
 */
export async function getSessionUser(): Promise<CurrentUser | null> {
  if (isAuthConfigured()) {
    const supabase = getSupabaseAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      let role: AdminRole | null = null;
      let ndaStatus: NdaStatus | null = null;
      let profileId: string | null = null;
      let organizationId: string | null = null;

      // Profile (role + NDA) requires the service client.
      if (isSupabaseConfigured()) {
        const { data: profile } = await getServiceClient()
          .from("profiles")
          .select("id, admin_role, nda_status, organization_id")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (profile) {
          role = profile.admin_role ?? null;
          ndaStatus = profile.nda_status ?? null;
          profileId = profile.id ?? null;
          organizationId = profile.organization_id ?? null;
        }
      }

      return {
        email: user.email ?? "",
        role,
        ndaStatus,
        profileId,
        organizationId,
        authUserId: user.id,
        source: "supabase",
      };
    }
    return null;
  }

  // Dev fallback: HMAC admin cookie => super_admin session.
  const dev = await verifySession(cookies().get(ADMIN_COOKIE)?.value);
  if (dev) {
    return {
      email: dev.email,
      role: "super_admin",
      ndaStatus: "approved",
      profileId: null,
      organizationId: null,
      authUserId: null,
      source: "dev",
    };
  }

  return null;
}

/** For admin pages: returns the user only if they may view the admin console. */
export async function getAdminUser(): Promise<CurrentUser | null> {
  const user = await getSessionUser();
  if (user && can.viewAdmin(user.role)) return user;
  return null;
}

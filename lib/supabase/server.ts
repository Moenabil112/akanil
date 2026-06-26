import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client using the service-role key.
 *
 * This bypasses RLS and must NEVER be imported into client components or
 * exposed to the browser. It backs the public request-intake API and the admin
 * dashboard. When Supabase env vars are absent (local/preview), callers should
 * branch on `isSupabaseConfigured()` and fall back gracefully.
 */

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getServiceClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cached;
}

/** Best-effort audit log writer. Never throws — auditing must not break flows. */
export async function writeAuditLog(entry: {
  actor?: string | null;
  action_type: string;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    await getServiceClient().from("audit_logs").insert({
      actor: entry.actor ?? null,
      action_type: entry.action_type,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      metadata: entry.metadata ?? null,
      notes: entry.notes ?? null,
    });
  } catch (err) {
    console.error("[akanil] audit log write failed", err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  getServiceClient,
  isSupabaseConfigured,
  writeAuditLog,
} from "@/lib/supabase/server";
import type { AccessLevel } from "@/lib/supabase/types";

/**
 * Access request / contact intake endpoint.
 *
 * Backs every institutional briefing, data room access, contact, and QASSAS
 * demo request. The handler validates input, persists it to the matching
 * Supabase table (when configured), records an audit entry, then dispatches an
 * admin notification. When Supabase / Resend env vars are absent (local dev),
 * the request is logged to the server console so the flow stays fully testable
 * without external services.
 */

interface RequestPayload {
  name?: string;
  email?: string;
  organization?: string;
  role?: string;
  requestType?: string;
  accessLevel?: string;
  window?: string;
  windowName?: string;
  message?: string;
  ndaAcknowledged?: string | boolean;
  source?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UI access-level labels → enum values (mirrors lib/supabase/types ACCESS_LEVELS).
const LEVEL_MAP: Record<string, AccessLevel> = {
  "Public Access": "public",
  "Public Layer": "public",
  "Institutional Brief Access": "institutional_brief",
  "Institutional Brief Layer": "institutional_brief",
  "NDA Data Room Access": "nda_data_room",
  "NDA Data Room Layer": "nda_data_room",
  "Technical Review Layer": "technical_review",
  "Partner / Internal Layer": "partner_internal",
};

export async function POST(req: NextRequest) {
  let payload: RequestPayload;
  try {
    payload = (await req.json()) as RequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = payload.name?.trim();
  const email = payload.email?.trim();
  const organization = payload.organization?.trim();

  if (!name || !email || !organization) {
    return NextResponse.json(
      { error: "Name, email, and organization are required." },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please provide a valid email address." },
      { status: 400 }
    );
  }

  const isQassas = (payload.requestType || "").toLowerCase().includes("qassas");
  const source = payload.source || "unknown";
  const window = payload.window?.trim() || payload.windowName?.trim() || null;
  const message = payload.message?.trim() || null;
  const role = payload.role?.trim() || null;

  // Determine destination table from the request type / form source.
  const table = isQassas
    ? "qassas_demo_requests"
    : source === "briefing"
      ? "briefing_requests"
      : source === "contact"
        ? "contact_messages"
        : "access_requests";

  let recordId: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      recordId = await persist(table, {
        name,
        email,
        organization,
        role,
        requestType: payload.requestType,
        accessLevel: payload.accessLevel,
        window,
        message,
        ndaAcknowledged: Boolean(payload.ndaAcknowledged),
        source,
      });
      await writeAuditLog({
        actor: email,
        action_type: "request_submitted",
        target_type: table,
        target_id: recordId,
        metadata: { requestType: payload.requestType ?? null, source },
      });
    } catch (err) {
      console.error("[akanil] failed to persist request", err);
      return NextResponse.json(
        { error: "We could not process your request right now. Please try again." },
        { status: 502 }
      );
    }
  }

  try {
    await notifyAdmin({
      table,
      recordId,
      name,
      email,
      organization,
      role,
      requestType: payload.requestType ?? null,
      accessLevel: payload.accessLevel ?? null,
      window,
      message,
      source,
    });
  } catch (err) {
    // Notification failure should not lose a persisted request.
    console.error("[akanil] failed to dispatch notification", err);
  }

  return NextResponse.json({ ok: true, id: recordId });
}

/** Insert into the correct table with the right column shape; returns the new id. */
async function persist(
  table: string,
  d: {
    name: string;
    email: string;
    organization: string;
    role: string | null;
    requestType?: string;
    accessLevel?: string;
    window: string | null;
    message: string | null;
    ndaAcknowledged: boolean;
    source: string;
  }
): Promise<string> {
  const supabase = getServiceClient();
  const level = d.accessLevel ? LEVEL_MAP[d.accessLevel] ?? null : null;

  let row: Record<string, unknown>;
  switch (table) {
    case "qassas_demo_requests":
      row = {
        full_name: d.name,
        email: d.email,
        organization: d.organization,
        role: d.role,
        use_case: d.message,
        source: d.source,
      };
      break;
    case "briefing_requests":
      row = {
        full_name: d.name,
        email: d.email,
        organization: d.organization,
        role: d.role,
        requested_topic: d.requestType,
        related_window: d.window,
        message: d.message,
        source: d.source,
      };
      break;
    case "contact_messages":
      row = {
        full_name: d.name,
        email: d.email,
        organization: d.organization,
        role: d.role,
        reason: d.requestType,
        message: d.message,
        source: d.source,
      };
      break;
    default: // access_requests
      row = {
        full_name: d.name,
        email: d.email,
        organization: d.organization,
        role: d.role,
        requested_window: d.window,
        requested_level: level,
        message: d.message,
        nda_required: level === "nda_data_room",
        nda_acknowledged: d.ndaAcknowledged,
        source: d.source,
      };
  }

  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function notifyAdmin(record: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;

  if (!apiKey || !to) {
    // Local / preview fallback: no email provider configured. See README known issues.
    console.info("[akanil] request received:", record);
    return;
  }

  const lines = Object.entries(record)
    .map(([k, v]) => `${k}: ${v ?? "—"}`)
    .join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Akanil Platform <notifications@akanil.com>",
      to: [to],
      subject: `New Akanil request — ${record.requestType ?? record.source}`,
      text: `A new institutional request was submitted via the Akanil platform.\n\n${lines}`,
    }),
  });

  // Best-effort email delivery log.
  if (isSupabaseConfigured()) {
    try {
      await getServiceClient().from("email_logs").insert({
        template_name: "admin_request_notification",
        recipient_email: to,
        related_request_id: (record.recordId as string) ?? null,
        status: res.ok ? "sent" : "error",
        error_message: res.ok ? null : `Resend ${res.status}`,
      });
    } catch {
      /* non-fatal */
    }
  }

  if (!res.ok) throw new Error(`Resend responded with ${res.status}`);
}

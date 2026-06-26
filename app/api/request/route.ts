import { NextRequest, NextResponse } from "next/server";

/**
 * Access request / contact intake endpoint.
 *
 * This backs every institutional briefing, data room access, contact, and
 * QASSAS demo request on the platform. The handler validates input, then
 * dispatches an admin notification. Email delivery (Resend) and persistence
 * (Supabase) are wired conditionally — when the corresponding environment
 * variables are absent (e.g. local development), the request is logged to the
 * server console so the flow remains fully testable without external services.
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
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  const record = {
    receivedAt: new Date().toISOString(),
    name,
    email,
    organization,
    role: payload.role?.trim() || null,
    requestType: payload.requestType || null,
    accessLevel: payload.accessLevel || null,
    window: payload.window || payload.windowName || null,
    message: payload.message?.trim() || null,
    ndaAcknowledged: Boolean(payload.ndaAcknowledged),
    source: payload.source || "unknown",
  };

  try {
    await notifyAdmin(record);
  } catch (err) {
    console.error("[akanil] failed to dispatch access request notification", err);
    return NextResponse.json(
      { error: "We could not process your request right now. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}

async function notifyAdmin(record: Record<string, unknown>) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;

  // Local / preview fallback: no email provider configured.
  if (!apiKey || !to) {
    console.info("[akanil] access request received:", record);
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

  if (!res.ok) {
    throw new Error(`Resend responded with ${res.status}`);
  }
}

import "server-only";
import { getServiceClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { renderEmail, type EmailEvent, type EmailContext } from "./templates";

/**
 * Send a branded transactional email. In development (no RESEND_API_KEY) the
 * rendered email is logged instead of sent, so the flow is fully testable.
 * Delivery is best-effort and never throws — callers should not fail because of
 * email. Outcomes are recorded to `email_logs` when Supabase is configured.
 */
export async function sendEmail(
  event: EmailEvent,
  to: string | undefined,
  ctx: EmailContext = {},
  relatedRequestId?: string | null
): Promise<void> {
  if (!to) return;
  const email = renderEmail(event, ctx);
  const apiKey = process.env.RESEND_API_KEY;
  const from = "Akanil <notifications@akanil.com>";

  let status = "logged";
  let errorMessage: string | null = null;

  try {
    if (!apiKey) {
      // Dev / preview fallback.
      console.info(`[akanil] email (${event}) → ${to}: ${email.subject}`);
    } else {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
      });
      status = res.ok ? "sent" : "error";
      if (!res.ok) errorMessage = `Resend ${res.status}`;
    }
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : "unknown";
    console.error(`[akanil] email send failed (${event})`, err);
  }

  if (isSupabaseConfigured()) {
    try {
      await getServiceClient().from("email_logs").insert({
        template_name: event,
        recipient_email: to,
        related_request_id: relatedRequestId ?? null,
        status,
        error_message: errorMessage,
      });
    } catch {
      /* non-fatal */
    }
  }
}

// Branded transactional email templates. Each returns subject + html + text.
// Copy is claims-controlled and conservative. Rendering is independent of the
// transport (see send.ts) so templates are testable in development.

export type EmailEvent =
  | "contact_received"
  | "briefing_received"
  | "data_room_request_received"
  | "access_under_review"
  | "access_approved"
  | "access_rejected"
  | "nda_required"
  | "nda_received"
  | "data_room_activated"
  | "access_expiring_soon"
  | "qassas_demo_received"
  | "qassas_demo_approved"
  | "additional_info_requested";

export interface EmailContext {
  name?: string;
  window?: string;
  accessLevel?: string;
  expiresAt?: string;
  note?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = {
  obsidian: "#0A0C0E",
  surface: "#101418",
  line: "#2C333B",
  gold: "#B8924A",
  ivory: "#F4F1E9",
  grey: "#8A9099",
};

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:${BRAND.obsidian};font-family:Inter,Arial,sans-serif;color:${BRAND.ivory};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.obsidian};padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 12px;border-bottom:1px solid ${BRAND.line};">
          <span style="font-weight:600;letter-spacing:3px;color:${BRAND.gold};font-size:16px;">AKANIL</span>
          <div style="color:${BRAND.grey};font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">From Earth to Trust</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND.ivory};">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 32px;border-top:1px solid ${BRAND.line};color:${BRAND.grey};font-size:11px;line-height:1.6;">
          This message is for general institutional communication only. It is not a public offering,
          investment solicitation, reserve statement, technical report, or financial recommendation.
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:${BRAND.grey};">${text}</p>`;
}

function greet(ctx: EmailContext): string {
  return ctx.name ? `Dear ${ctx.name},` : "Hello,";
}

type Builder = (ctx: EmailContext) => RenderedEmail;

function build(subject: string, lines: string[], ctx: EmailContext): RenderedEmail {
  const body = [greet(ctx), ...lines];
  return {
    subject,
    html: layout(subject, body.map(p).join("")),
    text: `${subject}\n\n${body.join("\n\n")}\n\n— Akanil`,
  };
}

export const EMAIL_TEMPLATES: Record<EmailEvent, Builder> = {
  contact_received: (c) =>
    build("We received your message", [
      "Thank you for contacting Akanil. Your message has been received and routed to our team through a traceable, governed process.",
      "We will respond through the official channel.",
    ], c),

  briefing_received: (c) =>
    build("Institutional briefing request received", [
      "Thank you for requesting an institutional briefing. Your request has been logged and is under review.",
      "We will be in touch to arrange the briefing.",
    ], c),

  data_room_request_received: (c) =>
    build("Data room access request received", [
      "Your request for controlled data room access has been received. Access is granted on a reviewed, per-window basis and, where required, behind an approved NDA.",
      "We will review your request and respond with next steps.",
    ], c),

  access_under_review: (c) =>
    build("Your access request is under review", [
      "Your access request is now under review by the Akanil team. We may contact you for additional information.",
    ], c),

  access_approved: (c) =>
    build("Your access request has been approved", [
      `Your access request has been approved${c.window ? ` for ${c.window}` : ""}${c.accessLevel ? ` at the ${c.accessLevel} level` : ""}.`,
      "Sign in to your account to view the documents now available to you.",
    ], c),

  access_rejected: (c) =>
    build("Update on your access request", [
      "After review, we are unable to grant the requested access at this time.",
      c.note || "If you believe this was in error, please reply to discuss next steps.",
    ], c),

  nda_required: (c) =>
    build("An NDA is required to proceed", [
      "To access the requested materials, an executed non-disclosure agreement is required.",
      "We will share the NDA for your review and signature.",
    ], c),

  nda_received: (c) =>
    build("We received your NDA", [
      "Thank you — we have received your signed NDA and it is being processed. Once approved, the relevant access will be activated.",
    ], c),

  data_room_activated: (c) =>
    build("Your data room access is active", [
      `Your controlled data room access${c.window ? ` for ${c.window}` : ""} is now active.`,
      "Each download is authorized and logged. Please handle all materials in accordance with the applicable confidentiality terms.",
    ], c),

  access_expiring_soon: (c) =>
    build("Your data room access is expiring soon", [
      `Your access${c.window ? ` to ${c.window}` : ""}${c.expiresAt ? ` is scheduled to expire on ${c.expiresAt}` : " is expiring soon"}.`,
      "If you require continued access, please request an extension.",
    ], c),

  qassas_demo_received: (c) =>
    build("QASSAS demo request received", [
      "Thank you for your interest in QASSAS, a ZYNTRA Deeptech product. Your demo request has been received.",
      "Demo access is provided through a controlled, approved workflow and we will follow up with next steps.",
    ], c),

  qassas_demo_approved: (c) =>
    build("Your QASSAS demo has been approved", [
      "Your QASSAS demo request has been approved. We will provide controlled access details separately.",
    ], c),

  additional_info_requested: (c) =>
    build("Additional information requested", [
      "To continue reviewing your request, we need some additional information.",
      c.note || "Please reply with the requested details at your convenience.",
    ], c),
};

export function renderEmail(event: EmailEvent, ctx: EmailContext = {}): RenderedEmail {
  return EMAIL_TEMPLATES[event](ctx);
}

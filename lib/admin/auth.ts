// Lightweight admin session for the Phase 2A review dashboard.
//
// A signed (HMAC-SHA256) cookie gates /admin. Login checks a shared password
// (ADMIN_DASHBOARD_PASSWORD) and, if configured, an allow-list of emails
// (ADMIN_ALLOWED_EMAILS). This is intentionally minimal — full Supabase Auth +
// role-based access control replaces it in Phase 3. Uses Web Crypto so the same
// verify path runs in both the Edge middleware and Node server actions.

export const ADMIN_COOKIE = "akanil_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function secret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_DASHBOARD_PASSWORD ||
    "akanil-dev-secret-change-me"
  );
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return b64url(sig);
}

export interface AdminSession {
  email: string;
  exp: number;
}

export async function createSession(email: string): Promise<string> {
  const payload: AdminSession = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

export async function verifySession(
  token: string | undefined
): Promise<AdminSession | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  // Constant-ish time compare.
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++)
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const session = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(body))
    ) as AdminSession;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_DASHBOARD_PASSWORD);
}

/** Validates login credentials against env config. */
export function checkCredentials(email: string, password: string): boolean {
  const expected = process.env.ADMIN_DASHBOARD_PASSWORD;
  if (!expected || password !== expected) return false;

  const allow = (process.env.ADMIN_ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length > 0 && !allow.includes(email.trim().toLowerCase())) {
    return false;
  }
  return true;
}

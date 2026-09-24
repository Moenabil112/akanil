const TOKEN_KEY = "qassas.workbench.access_token";
const TOKEN_EXP_KEY = "qassas.workbench.access_token_expires_at";
const PKCE_VERIFIER_KEY = "qassas.workbench.pkce_verifier";
const OIDC_STATE_KEY = "qassas.workbench.oidc_state";

function base64Url(bytes) {
  const binary = Array.from(new Uint8Array(bytes), (byte) =>
    String.fromCharCode(byte),
  ).join("");
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function randomString(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

async function sha256(value) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

export async function startLogin(config) {
  const verifier = randomString(48);
  const challenge = base64Url(await sha256(verifier));
  const state = randomString(24);

  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OIDC_STATE_KEY, state);

  const url = new URL(
    config.oidcIssuer.replace(/\/$/, "") + "/protocol/openid-connect/auth",
  );
  url.searchParams.set("client_id", config.oidcClientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.oidcScope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  window.location.assign(url.toString());
}

export async function handleCallback(config) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const returnedState = params.get("state");
  const error = params.get("error");

  if (error) {
    clearSession();
    throw new Error(params.get("error_description") || error);
  }

  if (!code) return false;

  const expectedState = sessionStorage.getItem(OIDC_STATE_KEY);
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!expectedState || returnedState !== expectedState || !verifier) {
    clearSession();
    throw new Error("OIDC state/PKCE verification failed");
  }

  const tokenUrl =
    config.oidcIssuer.replace(/\/$/, "") + "/protocol/openid-connect/token";
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.oidcClientId,
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    clearSession();
    throw new Error("OIDC token exchange failed");
  }

  const token = await response.json();
  const expiresAt = Date.now() + Number(token.expires_in || 300) * 1000;

  sessionStorage.setItem(TOKEN_KEY, token.access_token);
  sessionStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OIDC_STATE_KEY);

  history.replaceState({}, document.title, config.redirectUri);
  return true;
}

export function getAccessToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || "0");
  if (!token || !expiresAt || Date.now() >= expiresAt - 15000) {
    clearSession();
    return null;
  }
  return token;
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXP_KEY);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  sessionStorage.removeItem(OIDC_STATE_KEY);
}

export function actorFromToken(token) {
  try {
    const [, payload] = token.split(".");
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    return {
      subject: claims.sub || "",
      displayName:
        claims.name ||
        claims.preferred_username ||
        claims.email ||
        "Authenticated user",
    };
  } catch {
    return { subject: "", displayName: "Authenticated user" };
  }
}

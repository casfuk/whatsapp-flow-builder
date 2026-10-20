/**
 * Admin session tokens.
 *
 * A session is an HMAC-SHA256 signed token stored in an HttpOnly cookie:
 *   base64url(JSON payload) + "." + base64url(signature)
 * It is verified on the server for every request (see proxy.ts), so the
 * browser can neither read nor forge it. Rotating SESSION_SECRET logs out
 * every session immediately.
 *
 * Uses Web Crypto only, so it runs in the proxy and in route handlers.
 */

export const SESSION_COOKIE = "fc_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const INTERNAL_AUTH_HEADER = "x-funnelchat-internal";

type SessionPayload = { sub: "admin"; iat: number; exp: number };

const encoder = new TextEncoder();

function getSessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  // Refuse weak or missing secrets: no secret means nobody can log in
  return secret && secret.length >= 32 ? secret : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

export function constantTimeEqual(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const x = typeof a === "string" ? encoder.encode(a) : a;
  const y = typeof b === "string" ? encoder.encode(b) : b;
  // Lengths of HMAC outputs are public, so only the contents need constant time
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  const iat = Math.floor(now / 1000);
  const payload: SessionPayload = { sub: "admin", iat, exp: iat + SESSION_MAX_AGE_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = toBase64Url(await hmac(secret, `session.${body}`));
  return `${body}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now()): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret || !token) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return false;
  try {
    const expected = await hmac(secret, `session.${body}`);
    if (!constantTimeEqual(fromBase64Url(signature), expected)) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    return payload.sub === "admin" && typeof payload.exp === "number" && payload.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

/**
 * Token that lets the server call its own protected API routes
 * (e.g. the WhatsApp webhook calling /api/ai-agent). Derived from
 * SESSION_SECRET, never sent to the browser.
 */
export async function internalApiToken(): Promise<string | null> {
  const secret = getSessionSecret();
  if (!secret) return null;
  return toBase64Url(await hmac(secret, "internal-api.v1"));
}

export async function verifyInternalApiToken(token: string | null): Promise<boolean> {
  const expected = await internalApiToken();
  return !!expected && !!token && constantTimeEqual(token, expected);
}

/** Headers for server-to-server calls to this app's own protected API routes. */
export async function internalAuthHeaders(): Promise<Record<string, string>> {
  const token = await internalApiToken();
  return token ? { [INTERNAL_AUTH_HEADER]: token } : {};
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax keeps the session on top-level navigations back from Facebook OAuth,
    // while blocking it on cross-site POSTs (CSRF)
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

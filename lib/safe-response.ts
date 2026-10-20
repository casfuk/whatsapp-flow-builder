import { NextResponse } from "next/server";

/**
 * Secret-safe JSON responses.
 *
 * Every API route returns JSON through `safeJson` so that credentials
 * (WhatsApp/Meta access tokens, page tokens, app secrets, API keys...)
 * can never reach the browser, even if a route selects a full DB record.
 *
 * - Keys that hold credentials are removed and replaced with a boolean
 *   `has<Key>` flag (e.g. `accessToken` -> `hasAccessToken`).
 * - String values that look like credentials, or that contain the value of
 *   a secret environment variable, are replaced with "[redacted]".
 */

const REDACTED = "[redacted]";

// Matched case-insensitively after removing "_" and "-"
const SECRET_KEYS = new Set([
  "accesstoken",
  "pageaccesstoken",
  "refreshtoken",
  "usertoken",
  "sessionstate",
  "appsecret",
  "clientsecret",
  "verifytoken",
  "apikey",
  "password",
  "secret",
  "cronsecret",
  "authorization",
]);

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /EAA[A-Za-z0-9]{20,}/g, // Meta / WhatsApp access tokens
  /sk-[A-Za-z0-9_-]{20,}/g, // OpenAI API keys
  /postgres(?:ql)?:\/\/[^\s"']+/g, // Database connection strings
  /vercel_blob_rw_[A-Za-z0-9_]+/g, // Vercel Blob tokens
  /Bearer\s+[A-Za-z0-9._~+/=-]{8,}/g, // Authorization header values
  /(access_token=)[^&\s"']+/g, // Tokens in query strings
  /\b\d{6,}\|[A-Za-z0-9]{16,}\b/g, // Meta app tokens (APP_ID|APP_SECRET)
];

const SECRET_ENV_NAME = /(TOKEN|SECRET|KEY|PASSWORD|DATABASE_URL|POSTGRES_(URL|PRISMA_URL|URL_NON_POOLING|URL_NO_SSL|DATABASE_URL|DATABASE_URL_UNPOOLED))/;

function normalizeKey(key: string) {
  return key.replace(/[_-]/g, "").toLowerCase();
}

export function isSecretKey(key: string) {
  return SECRET_KEYS.has(normalizeKey(key));
}

function secretEnvValues(): string[] {
  return Object.entries(process.env)
    .filter(([name, value]) =>
      !name.startsWith("NEXT_PUBLIC_") &&
      SECRET_ENV_NAME.test(name) &&
      typeof value === "string" &&
      value.length >= 8
    )
    .map(([, value]) => value as string);
}

export function redactString(value: string, envSecrets = secretEnvValues()): string {
  let out = value;
  for (const secret of envSecrets) {
    if (out.includes(secret)) out = out.split(secret).join(REDACTED);
  }
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, (_match, prefix) =>
      typeof prefix === "string" ? `${prefix}${REDACTED}` : REDACTED
    );
  }
  return out;
}

function hasFlagName(key: string) {
  const clean = key.replace(/^[_-]+/, "");
  return `has${clean.charAt(0).toUpperCase()}${clean.slice(1)}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function redact(value: unknown, envSecrets: string[], seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value, envSecrets);
  if (Array.isArray(value)) {
    if (seen.has(value)) return undefined;
    seen.add(value);
    return value.map((item) => redact(item, envSecrets, seen));
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return undefined;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (isSecretKey(key)) {
        const flag = hasFlagName(key);
        if (!(flag in value)) out[flag] = child !== null && child !== undefined && child !== "";
        continue;
      }
      out[key] = redact(child, envSecrets, seen);
    }
    return out;
  }
  if (value instanceof Error) return { error: redactString(value.message, envSecrets) };
  // Dates, numbers, booleans, null... are left untouched (Dates serialize normally)
  return value;
}

/** Deep-copies `data`, removing credential fields and scrubbing secret-looking strings. */
export function redactSecrets<T>(data: T): T {
  return redact(data, secretEnvValues(), new WeakSet()) as T;
}

/** Drop-in replacement for `NextResponse.json` that never serializes secrets. */
export function safeJson<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(redactSecrets(body), init);
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Authentication for Meta (WhatsApp Cloud API / Facebook Page) webhooks.
 *
 * - GET: subscription verification with hub.verify_token
 * - POST: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(app secret, raw body)
 *
 * Both fail closed: if no token/secret is configured, requests are rejected.
 * Never log tokens, secrets or signatures.
 */

/** App secrets of every Meta app that may send us webhooks. */
export function metaAppSecrets(): string[] {
  const candidates = [
    process.env.META_APP_SECRET, // app subscribed to the WhatsApp Business Account
    process.env.FACEBOOK_APP_SECRET,
    process.env.FACEBOOK_WEBHOOK_APP_SECRET,
    process.env.FACEBOOK_OAUTH_APP_SECRET,
    process.env.FACEBOOK_CONSUMER_APP_SECRET,
  ];
  return [...new Set(candidates.filter((s): s is string => !!s && s.length > 0))];
}

export function isValidMetaSignature(rawBody: Uint8Array, signatureHeader: string | null, secrets = metaAppSecrets()): boolean {
  if (!signatureHeader || secrets.length === 0) return false;
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;
  const received = Buffer.from(match[1].toLowerCase(), "hex");
  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
}

type VerifiedBody<T> = { ok: true; body: T } | { ok: false; response: NextResponse };

/**
 * Reads the raw request bytes, checks Meta's signature on exactly those bytes,
 * and only then parses the JSON.
 */
// Existing webhook handlers treat Meta payloads as untyped JSON
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readVerifiedMetaJson<T = any>(request: NextRequest, logPrefix: string): Promise<VerifiedBody<T>> {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (!isValidMetaSignature(raw, request.headers.get("x-hub-signature-256"))) {
    console.warn(
      `${logPrefix} Rejected POST: invalid or missing X-Hub-Signature-256` +
        (metaAppSecrets().length === 0 ? " (no Meta app secret configured)" : "")
    );
    return { ok: false, response: NextResponse.json({ error: "Invalid signature" }, { status: 401 }) };
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(raw)) as T };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}

/** Handles Meta's GET subscription handshake. */
export function handleMetaVerification(request: NextRequest, expectedTokens: (string | undefined)[], logPrefix: string) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  const tokens = expectedTokens.filter((t): t is string => !!t && t.length > 0);

  const matches =
    !!token &&
    tokens.some((expected) => {
      const a = Buffer.from(token);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });

  // Never log token values - only whether verification passed
  console.log(`${logPrefix} Verification request: mode=${mode} tokenConfigured=${tokens.length > 0} match=${matches}`);

  if (mode === "subscribe" && matches) {
    return new NextResponse(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

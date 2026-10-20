import { describe, it, expect, afterEach } from "vitest";
import { redactSecrets, safeJson } from "@/lib/safe-response";

// Fake values shaped like real credentials (not real secrets)
const META_TOKEN = "EAA" + "x".repeat(180);
const OPENAI_KEY = "sk-" + "a".repeat(40);

describe("redactSecrets", () => {
  afterEach(() => {
    delete process.env.TEST_ONLY_SECRET_TOKEN;
  });

  it("removes credential fields and adds has* flags", () => {
    const out = redactSecrets({ id: "d1", accessToken: META_TOKEN, pageAccessToken: "", sessionState: null });
    expect(out).toEqual({ id: "d1", hasAccessToken: true, hasPageAccessToken: false, hasSessionState: false });
  });

  it("handles nested objects, arrays and snake_case keys", () => {
    const out = redactSecrets({
      devices: [{ name: "a", accessToken: META_TOKEN, nested: { app_secret: "abc12345", client_secret: "x" } }],
    });
    const text = JSON.stringify(out);
    expect(text).not.toContain(META_TOKEN);
    expect(text).not.toContain("abc12345");
    expect(out.devices[0]).toMatchObject({ name: "a", hasAccessToken: true });
  });

  it("does not override an explicit has* flag", () => {
    expect(redactSecrets({ accessToken: "", hasAccessToken: true })).toEqual({ hasAccessToken: true });
  });

  it("scrubs credential-looking strings inside other values", () => {
    const out = redactSecrets({
      error: `Graph error for https://graph.facebook.com/v21.0/123?access_token=${META_TOKEN}&x=1`,
      detail: `Bearer ${META_TOKEN}`,
      key: `using ${OPENAI_KEY}`,
      db: "postgresql://user:pass@host.neon.tech/db",
      appToken: "123456789012345|abcdefabcdefabcdefabcdef",
    });
    const text = JSON.stringify(out);
    for (const secret of [META_TOKEN, OPENAI_KEY, "user:pass", "abcdefabcdefabcdefabcdef"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("scrubs the value of any secret environment variable", () => {
    process.env.TEST_ONLY_SECRET_TOKEN = "plain-looking-value-123";
    const out = redactSecrets({ message: "token is plain-looking-value-123" });
    expect(JSON.stringify(out)).not.toContain("plain-looking-value-123");
  });

  it("keeps normal data intact", () => {
    const date = new Date("2025-01-01T00:00:00Z");
    const out = redactSecrets({ name: "Carmen", phoneNumber: "+34600000000", count: 3, ok: true, createdAt: date, list: [1, "a"] });
    expect(out).toEqual({ name: "Carmen", phoneNumber: "+34600000000", count: 3, ok: true, createdAt: date, list: [1, "a"] });
  });
});

describe("safeJson", () => {
  it("returns a JSON response without secrets and keeps the status", async () => {
    const res = safeJson({ accessToken: META_TOKEN }, { status: 201 });
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).not.toContain(META_TOKEN);
    expect(JSON.parse(text)).toEqual({ hasAccessToken: true });
  });
});

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

// Test-only values (not real secrets)
const SESSION_SECRET = "test-session-secret-".padEnd(64, "x");
const META_SECRET = "test-meta-app-secret-123";
const VERIFY_TOKEN = "test-verify-token-456";
const CRON_SECRET = "test-cron-secret-789";
const ADMIN_PASSWORD = "correct horse battery staple";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/followup-service", () => ({ processAllFollowups: vi.fn(async () => undefined) }));

const ROOT = path.resolve(__dirname, "..");
const ORIGIN = "https://funnelchat.test";

let proxy: typeof import("@/proxy").proxy;
let session: typeof import("@/lib/auth/session");

beforeAll(async () => {
  process.env.SESSION_SECRET = SESSION_SECRET;
  ({ proxy } = await import("@/proxy"));
  session = await import("@/lib/auth/session");
  const { hashPassword } = await import("@/lib/auth/password");
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(ADMIN_PASSWORD);
});

function request(pathname: string, init: { method?: string; cookie?: string; headers?: Record<string, string>; body?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("cookie", `${session.SESSION_COOKIE}=${init.cookie}`);
  return new NextRequest(`${ORIGIN}${pathname}`, { method: init.method ?? "GET", headers, body: init.body });
}

const passesThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

// ─── Route inventory ────────────────────────────────────────────────────────

function walk(dir: string, match: (f: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p, match) : match(p) ? [p] : [];
  });
}

const toUrlPath = (file: string, base: string) =>
  "/" +
  path
    .relative(base, path.dirname(file))
    .split(path.sep)
    .map((seg) => (seg.startsWith("[") ? "test-id" : seg))
    .join("/");

const apiRoutes = walk(path.join(ROOT, "app/api"), (f) => f.endsWith("route.ts")).flatMap((file) => {
  const src = fs.readFileSync(file, "utf8");
  const methods = [...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)].map((m) => m[1]);
  return methods.map((method) => ({ path: "/api" + toUrlPath(file, path.join(ROOT, "app/api")).replace(/^\/$/, ""), method }));
});

const pagePaths = [
  ...walk(path.join(ROOT, "app"), (f) => f.endsWith("page.tsx")).map((f) => toUrlPath(f, path.join(ROOT, "app")).replace(/^\/$/, "/") || "/"),
  ...walk(path.join(ROOT, "pages"), (f) => /\.tsx$/.test(f)).map((f) => "/" + path.relative(path.join(ROOT, "pages"), f).replace(/\.tsx$/, "").replace(/\/index$/, "")),
];

// The ONLY routes allowed without the admin session. Changing this list is a security decision.
const EXPECTED_PUBLIC = [
  "POST /api/auth/login",
  "POST /api/auth/logout",
  "GET /api/cleanup",
  "GET /api/cron/process-followups",
  "GET /api/redirect/test-id",
  "OPTIONS /api/v1/integrations/test-id/webhook",
  "POST /api/v1/integrations/test-id/webhook",
  "GET /api/v1/integrations/facebook/webhook",
  "POST /api/v1/integrations/facebook/webhook",
  "GET /api/webhook",
  "POST /api/webhook",
  "GET /api/webhooks/facebook-lead",
  "POST /api/webhooks/facebook-lead",
  "GET /api/webhooks/whatsapp",
  "POST /api/webhooks/whatsapp",
  "GET /api/whatsapp/webhook",
  "POST /api/whatsapp/webhook",
].sort();

describe("route inventory", () => {
  it("finds every API route and page", () => {
    expect(apiRoutes.length).toBeGreaterThan(80);
    expect(pagePaths.length).toBeGreaterThan(15);
  });

  it("only the expected API routes are public; every other route returns 401 anonymously", async () => {
    const publicRoutes: string[] = [];
    for (const r of apiRoutes) {
      const res = await proxy(request(r.path, { method: r.method }));
      if (passesThrough(res)) publicRoutes.push(`${r.method} ${r.path}`);
      else expect(res.status, `${r.method} ${r.path}`).toBe(401);
    }
    expect(publicRoutes.sort()).toEqual(EXPECTED_PUBLIC);
  });

  it("every page except /login redirects anonymous users to /login", async () => {
    for (const p of pagePaths.filter((p) => p !== "/login")) {
      const res = await proxy(request(p));
      expect(res.status, p).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname, p).toBe("/login");
    }
    expect(passesThrough(await proxy(request("/login")))).toBe(true);
  });
});

// ─── Anonymous access to key admin functionality ───────────────────────────

describe("anonymous requests are rejected with 401 JSON", () => {
  const cases: [string, string, string][] = [
    ["dashboard page", "GET", "/dashboard"],
    ["read chats", "GET", "/api/chats"],
    ["read chat messages", "GET", "/api/chats/abc/messages"],
    ["read contacts", "GET", "/api/contacts"],
    ["send WhatsApp (send)", "POST", "/api/whatsapp/send"],
    ["send WhatsApp (messages)", "POST", "/api/messages/send"],
    ["send WhatsApp (chat)", "POST", "/api/chats/abc/messages"],
    ["mass send", "POST", "/api/mass-sends"],
    ["create flow", "POST", "/api/flows"],
    ["edit flow", "PUT", "/api/flows/abc"],
    ["delete flow", "DELETE", "/api/flows/abc"],
    ["create AI agent", "POST", "/api/ai-agents"],
    ["edit AI agent", "PUT", "/api/ai-agents/abc"],
    ["delete AI agent", "DELETE", "/api/ai-agents/abc"],
    ["call AI agent", "POST", "/api/ai-agent"],
    ["change WhatsApp config", "PUT", "/api/whatsapp-config"],
    ["read WhatsApp config", "GET", "/api/whatsapp-config"],
    ["read devices", "GET", "/api/devices"],
    ["create device", "POST", "/api/devices"],
    ["edit device", "PATCH", "/api/devices/abc"],
    ["delete device", "DELETE", "/api/devices/abc"],
    ["upload file", "POST", "/api/upload"],
    ["read settings", "GET", "/api/settings"],
    ["change settings", "PUT", "/api/settings"],
    ["unauthenticated lead webhook that sends WhatsApp", "POST", "/api/webhooks/lead"],
  ];

  for (const [name, method, p] of cases) {
    it(name, async () => {
      const res = await proxy(request(p, { method }));
      if (p.startsWith("/api/")) {
        expect(res.status).toBe(401);
        expect(res.headers.get("content-type")).toContain("application/json");
        expect(await res.json()).toEqual({ error: "Unauthorized" });
      } else {
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("/login");
      }
    });
  }

  it("forged, tampered and expired sessions are rejected", async () => {
    const valid = await session.createSessionToken();
    const [body, sig] = valid.split(".");
    const tampered = `${body}.${sig.slice(0, -2)}${sig.endsWith("AA") ? "BB" : "AA"}`;
    const expired = await session.createSessionToken(Date.now() - 8 * 24 * 3600 * 1000);
    for (const cookie of ["garbage", tampered, expired, `${body}.`]) {
      expect((await proxy(request("/api/chats", { cookie }))).status).toBe(401);
    }
  });

  it("a session signed with a different secret is rejected", async () => {
    const token = await session.createSessionToken();
    process.env.SESSION_SECRET = "another-secret-".padEnd(64, "y");
    try {
      expect((await proxy(request("/api/chats", { cookie: token }))).status).toBe(401);
    } finally {
      process.env.SESSION_SECRET = SESSION_SECRET;
    }
  });

  it("the internal token only opens the internal AI route", async () => {
    const headers = await session.internalAuthHeaders();
    expect(passesThrough(await proxy(request("/api/ai-agent", { method: "POST", headers })))).toBe(true);
    expect((await proxy(request("/api/chats", { headers }))).status).toBe(401);
    expect((await proxy(request("/api/ai-agent", { method: "POST", headers: { [session.INTERNAL_AUTH_HEADER]: "wrong" } }))).status).toBe(401);
  });
});

// ─── Admin session ─────────────────────────────────────────────────────────

describe("valid admin session", () => {
  it("can access protected pages and API routes", async () => {
    const cookie = await session.createSessionToken();
    for (const [method, p] of [["GET", "/dashboard"], ["GET", "/api/chats"], ["POST", "/api/flows"], ["PUT", "/api/whatsapp-config"], ["DELETE", "/api/ai-agents/abc"], ["POST", "/api/whatsapp/send"]]) {
      expect(passesThrough(await proxy(request(p, { method, cookie }))), `${method} ${p}`).toBe(true);
    }
  });

  it("cross-site writes are blocked even with a session (CSRF)", async () => {
    const cookie = await session.createSessionToken();
    const res = await proxy(request("/api/flows", { method: "POST", cookie, headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
    const same = await proxy(request("/api/flows", { method: "POST", cookie, headers: { origin: ORIGIN } }));
    expect(passesThrough(same)).toBe(true);
  });

  it("logged-in users are sent from /login to the app", async () => {
    const res = await proxy(request("/login", { cookie: await session.createSessionToken() }));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });
});

// ─── Login / logout ────────────────────────────────────────────────────────

describe("login and logout", () => {
  const login = async (password: string, ip: string) => {
    const { POST } = await import("@/app/api/auth/login/route");
    return POST(request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ password }),
    }));
  };

  it("rejects a wrong password without setting a cookie", async () => {
    const res = await login("wrong", "10.0.0.1");
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("accepts the right password and sets a secure session cookie", async () => {
    const res = await login(ADMIN_PASSWORD, "10.0.0.2");
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${session.SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const token = cookie.split(";")[0].split("=")[1];
    expect(await session.verifySessionToken(token)).toBe(true);
    // Never echo secrets
    const body = await res.text();
    expect(body).not.toContain(token);
    expect(body).not.toContain(process.env.ADMIN_PASSWORD_HASH!);
  });

  it("marks the cookie Secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(session.sessionCookieOptions().secure).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("locks out an IP after repeated failures", async () => {
    for (let i = 0; i < 5; i++) await login("nope", "10.0.0.3");
    expect((await login(ADMIN_PASSWORD, "10.0.0.3")).status).toBe(429);
  }, 20000);

  it("logout clears the cookie", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const cookie = (await POST()).headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${session.SESSION_COOKIE}=;`));
    expect(cookie).toMatch(/Max-Age=0/i);
  });

  it("stores the password only as a salted scrypt hash", async () => {
    const { hashPassword, verifyPassword } = await import("@/lib/auth/password");
    const a = await hashPassword("pw-123456");
    const b = await hashPassword("pw-123456");
    expect(a).not.toContain("pw-123456");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("pw-123456", a)).toBe(true);
    expect(await verifyPassword("pw-1234567", a)).toBe(false);
    expect(await verifyPassword("pw-123456", undefined)).toBe(false);
  });
});

// ─── Meta webhooks ─────────────────────────────────────────────────────────

describe("Meta webhooks", () => {
  const sign = (raw: string, secret = META_SECRET) => "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  // Status update with non-ASCII text, so byte-exact verification matters
  const statusPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id: "x", status: "read", note: "ñandú ✓" }] } }] }] });

  beforeEach(() => {
    process.env.META_APP_SECRET = META_SECRET;
    process.env.WEBHOOK_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.FACEBOOK_VERIFY_TOKEN = VERIFY_TOKEN;
    process.env.WHATSAPP_CLOUD_API_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123";
  });
  afterEach(() => {
    delete process.env.META_APP_SECRET;
  });

  const post = async (raw: string, signature?: string) => {
    const { POST } = await import("@/app/api/webhooks/whatsapp/route");
    return POST(request("/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
      body: raw,
    }));
  };

  it("GET verification returns the challenge for the right token", async () => {
    const { GET } = await import("@/app/api/webhooks/whatsapp/route");
    const ok = await GET(request(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=4242`));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("4242");
    const bad = await GET(request(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=4242`));
    expect(bad.status).toBe(403);
  });

  it("GET verification fails closed when no verify token is configured", async () => {
    const { GET } = await import("@/app/api/webhooks/whatsapp/route");
    delete process.env.WEBHOOK_VERIFY_TOKEN;
    const res = await GET(request(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=&hub.challenge=1`));
    expect(res.status).toBe(403);
  });

  it("accepts a correctly signed POST", async () => {
    const res = await post(statusPayload, sign(statusPayload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects a missing, wrong, or re-serialized signature", async () => {
    expect((await post(statusPayload)).status).toBe(401);
    expect((await post(statusPayload, sign(statusPayload, "other-secret"))).status).toBe(401);
    expect((await post(statusPayload, "sha256=" + "0".repeat(64))).status).toBe(401);
    // Signature over re-serialized JSON must not validate the original bytes
    const reserialized = JSON.stringify(JSON.parse(statusPayload), null, 2);
    expect((await post(statusPayload, sign(reserialized))).status).toBe(401);
    // Tampered body with the original signature
    expect((await post(statusPayload.replace("read", "sent"), sign(statusPayload))).status).toBe(401);
  });

  it("rejects everything when no Meta app secret is configured", async () => {
    const saved = Object.fromEntries(["FACEBOOK_APP_SECRET", "FACEBOOK_WEBHOOK_APP_SECRET", "FACEBOOK_OAUTH_APP_SECRET", "FACEBOOK_CONSUMER_APP_SECRET"].map((k) => [k, process.env[k]]));
    for (const k of Object.keys(saved)) delete process.env[k];
    delete process.env.META_APP_SECRET;
    try {
      expect((await post(statusPayload, sign(statusPayload))).status).toBe(401);
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
    }
  });

  it("all Meta webhook routes enforce the signature on POST", async () => {
    const routes = [
      ["/api/webhooks/whatsapp", () => import("@/app/api/webhooks/whatsapp/route")],
      ["/api/whatsapp/webhook", () => import("@/app/api/whatsapp/webhook/route")],
      ["/api/webhook", () => import("@/app/api/webhook/route")],
      ["/api/v1/integrations/facebook/webhook", () => import("@/app/api/v1/integrations/facebook/webhook/route")],
      ["/api/webhooks/facebook-lead", () => import("@/app/api/webhooks/facebook-lead/route")],
    ] as const;
    for (const [p, load] of routes) {
      const { POST, GET } = await load();
      const res = await POST(request(p, { method: "POST", body: statusPayload, headers: { "content-type": "application/json" } }));
      expect(res.status, p).toBe(401);
      const verify = await GET(request(`${p}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=7`));
      expect(verify.status, p).toBe(200);
    }
  });

  it("never logs the app secret, verify token or signature", async () => {
    const logs: string[] = [];
    const spies = (["log", "warn", "error", "info"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => { logs.push(args.map(String).join(" ")); })
    );
    try {
      const signature = sign(statusPayload);
      await post(statusPayload, signature);
      await post(statusPayload, "sha256=" + "1".repeat(64));
      const { GET } = await import("@/app/api/webhooks/whatsapp/route");
      await GET(request(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`));
      const all = logs.join("\n");
      for (const secret of [META_SECRET, VERIFY_TOKEN, signature.slice(7)]) expect(all).not.toContain(secret);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});

// ─── Cron ──────────────────────────────────────────────────────────────────

describe("cron authentication", () => {
  const call = async (auth?: string) => {
    const { GET } = await import("@/app/api/cron/process-followups/route");
    return GET(request("/api/cron/process-followups", { headers: auth ? { authorization: auth } : {} }));
  };

  it("runs with the right bearer secret and rejects anything else", async () => {
    process.env.CRON_SECRET = CRON_SECRET;
    expect((await call(`Bearer ${CRON_SECRET}`)).status).toBe(200);
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await call("Bearer undefined")).status).toBe(401);
    expect((await call()).status).toBe(401);
  });
});

// ─── Secrets never leave the server ────────────────────────────────────────

describe("auth secrets never reach responses", () => {
  it("safeJson scrubs the session secret and password hash values", async () => {
    const { redactSecrets } = await import("@/lib/safe-response");
    const out = JSON.stringify(redactSecrets({ a: `x ${SESSION_SECRET} y`, b: process.env.ADMIN_PASSWORD_HASH, sessionToken: "z" }));
    expect(out).not.toContain(SESSION_SECRET);
    expect(out).not.toContain(process.env.ADMIN_PASSWORD_HASH!);
  });

  it("no client component references server-only auth secrets", () => {
    const client = walk(path.join(ROOT, "app"), (f) => f.endsWith(".tsx")).filter((f) => fs.readFileSync(f, "utf8").includes('"use client"'));
    const offenders = client.filter((f) => /SESSION_SECRET|ADMIN_PASSWORD_HASH|META_APP_SECRET|APP_SECRET|CRON_SECRET|lib\/auth\/(session|password)/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});

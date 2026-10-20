import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

// Fake credentials (not real secrets)
const DEVICE_TOKEN = "EAA" + "d".repeat(190);
const CONFIG_TOKEN = "EAA" + "c".repeat(190);
const SESSION_STATE = "session-state-" + "s".repeat(40);

const device = {
  id: "dev1",
  name: "Main",
  phoneNumber: "+34600000000",
  isConnected: true,
  color: "#6D5BFA",
  whatsappPhoneNumberId: "123456789012345",
  accessToken: DEVICE_TOKEN,
  businessAccountId: "999",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const config = {
  id: "cfg1",
  workspaceId: null,
  mode: "cloud_api",
  phoneNumber: "+34600000000",
  phoneNumberId: "123456789012345",
  wabaId: "999",
  accessToken: CONFIG_TOKEN,
  sessionId: null,
  sessionState: SESSION_STATE,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    device: {
      findMany: vi.fn(async () => [device]),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => device),
      update: vi.fn(async () => device),
    },
    whatsAppConfig: {
      findFirst: vi.fn(async () => config),
      create: vi.fn(async () => config),
      update: vi.fn(async () => config),
      upsert: vi.fn(async () => config),
    },
  },
}));

async function expectNoSecrets(res: Response) {
  const text = await res.text();
  for (const secret of [DEVICE_TOKEN, CONFIG_TOKEN, SESSION_STATE]) {
    expect(text).not.toContain(secret);
  }
  expect(text).not.toMatch(/"accessToken"|"sessionState"|"pageAccessToken"/);
  return JSON.parse(text);
}

const req = (url: string, method = "GET", body?: unknown) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "content-type": "application/json" } : undefined,
  });

describe("API routes never return credentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET /api/devices", async () => {
    const { GET } = await import("@/app/api/devices/route");
    const json = await expectNoSecrets(await GET());
    expect(json.devices[0].hasAccessToken).toBe(true);
  });

  it("POST /api/devices", async () => {
    const { POST } = await import("@/app/api/devices/route");
    const res = await POST(req("/api/devices", "POST", {
      name: "Main", whatsappPhoneNumberId: "123456789012345", accessToken: DEVICE_TOKEN,
    }));
    expect(res.status).toBe(201);
    expect((await expectNoSecrets(res)).hasAccessToken).toBe(true);
  });

  it("PATCH /api/devices/[id]", async () => {
    const { PATCH } = await import("@/app/api/devices/[id]/route");
    const res = await PATCH(req("/api/devices/dev1", "PATCH", { name: "New" }), { params: Promise.resolve({ id: "dev1" }) });
    expect((await expectNoSecrets(res)).hasAccessToken).toBe(true);
  });

  it("GET /api/whatsapp-config", async () => {
    const { GET } = await import("@/app/api/whatsapp-config/route");
    const json = await expectNoSecrets(await GET(req("/api/whatsapp-config")));
    expect(json).toMatchObject({ id: "cfg1", hasAccessToken: true, hasSessionState: true });
  });

  it("PUT /api/whatsapp-config", async () => {
    const { PUT } = await import("@/app/api/whatsapp-config/route");
    const res = await PUT(req("/api/whatsapp-config", "PUT", { id: "cfg1", mode: "cloud_api" }));
    expect((await expectNoSecrets(res)).hasAccessToken).toBe(true);
  });
});

// Guards that keep every current and future API route on the safe path
const ROOT = path.resolve(__dirname, "..");

function filesUnder(dir: string, match: (f: string) => boolean): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : filesUnder(p, match);
    return match(p) ? [p] : [];
  });
}

describe("source guards", () => {
  const routes = filesUnder(path.join(ROOT, "app/api"), (f) => f.endsWith("route.ts"));

  it("finds the API routes", () => {
    expect(routes.length).toBeGreaterThan(40);
  });

  it("no API route builds JSON responses without safeJson", () => {
    const offenders = routes.filter((f) => /\b(NextResponse|Response)\.json\(/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("no server code logs any part of a bearer token", () => {
    const sources = [
      ...filesUnder(path.join(ROOT, "app"), (f) => /\.(ts|tsx)$/.test(f)),
      ...filesUnder(path.join(ROOT, "lib"), (f) => /\.(ts|tsx)$/.test(f)),
    ];
    const offenders = sources.filter((f) => /Bearer \$\{[^}]*\.substring\(/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });

  it("client components never read accessToken from API data", () => {
    const pages = filesUnder(path.join(ROOT, "app"), (f) => f.endsWith(".tsx"));
    const offenders = pages.filter((f) => /\b(device|config|page|integration)\??\.(accessToken|pageAccessToken)\b/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(ROOT, f))).toEqual([]);
  });
});

import { NextRequest } from "next/server";
import { safeJson } from "@/lib/safe-response";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

// Best-effort brute-force throttle (per server instance)
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isLocked(ip: string, now: number) {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (now - entry.first > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string, now: number) {
  const entry = failures.get(ip);
  if (!entry || now - entry.first > WINDOW_MS) failures.set(ip, { count: 1, first: now });
  else entry.count++;
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  const ip = clientIp(request);

  if (isLocked(ip, now)) {
    return safeJson({ error: "Demasiados intentos. Inténtalo de nuevo más tarde." }, { status: 429 });
  }

  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!passwordHash || !process.env.SESSION_SECRET) {
    console.error("[Auth] Login is not configured (ADMIN_PASSWORD_HASH / SESSION_SECRET missing)");
    return safeJson({ error: "Login no configurado" }, { status: 503 });
  }

  let password = "";
  try {
    const body = await request.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    // fall through with empty password
  }

  if (!(await verifyPassword(password, passwordHash))) {
    recordFailure(ip, now);
    console.warn("[Auth] Failed admin login attempt");
    // Slow down guessing
    await new Promise((resolve) => setTimeout(resolve, 500));
    return safeJson({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  failures.delete(ip);
  const response = safeJson({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(now), sessionCookieOptions());
  console.log("[Auth] Admin logged in");
  return response;
}

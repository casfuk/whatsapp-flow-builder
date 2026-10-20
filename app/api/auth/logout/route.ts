import { safeJson } from "@/lib/safe-response";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const response = safeJson({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}

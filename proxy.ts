import { NextRequest, NextResponse } from "next/server";
import { findPublicRoute, INTERNAL_API_ROUTES } from "@/lib/auth/public-routes";
import {
  INTERNAL_AUTH_HEADER,
  SESSION_COOKIE,
  verifyInternalApiToken,
  verifySessionToken,
} from "@/lib/auth/session";

/**
 * Admin authentication for the whole app.
 *
 * Every page and API route requires a valid admin session, except the
 * routes in lib/auth/public-routes.ts (each authenticated by its own
 * mechanism, e.g. Meta signatures or the cron secret).
 * - Browsers without a session are redirected to /login.
 * - API requests without a session get 401 JSON.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function unauthorizedApi() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function isCrossSiteRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname === "/api" || pathname.startsWith("/api/");

  if (findPublicRoute(pathname, request.method)) {
    // Already logged in: skip the login page
    if (pathname === "/login" && (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    // CSRF defence in depth (the cookie is also SameSite=Lax)
    if (isApi && UNSAFE_METHODS.has(request.method) && isCrossSiteRequest(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Server-to-server calls from this app (e.g. webhook -> /api/ai-agent)
  if (
    isApi &&
    INTERNAL_API_ROUTES.some((r) => r.test(pathname)) &&
    (await verifyInternalApiToken(request.headers.get(INTERNAL_AUTH_HEADER)))
  ) {
    return NextResponse.next();
  }

  if (isApi) return unauthorizedApi();

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except Next.js build assets and static files in /public
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|ico|webp|avif|txt|xml|woff2?)$).*)"],
};

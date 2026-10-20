/**
 * Routes reachable WITHOUT the admin session.
 *
 * Everything else (every page and every /api route) requires a valid admin
 * session, enforced in proxy.ts. Each entry here names the mechanism that
 * authenticates it instead. Add entries deliberately - tests enumerate the
 * API routes and fail if an unexpected one becomes public.
 */

type PublicRoute = {
  pattern: RegExp;
  methods: string[];
  auth: string;
};

const META_WEBHOOK_AUTH = "Meta: GET hub.verify_token, POST X-Hub-Signature-256 (checked in route)";

export const PUBLIC_ROUTES: PublicRoute[] = [
  { pattern: /^\/login$/, methods: ["GET", "HEAD"], auth: "login page" },
  { pattern: /^\/api\/auth\/login$/, methods: ["POST"], auth: "admin password (rate limited)" },
  { pattern: /^\/api\/auth\/logout$/, methods: ["POST"], auth: "only clears the session cookie" },

  // Meta webhooks (WhatsApp Cloud API + Page/Lead Ads)
  { pattern: /^\/api\/webhooks\/whatsapp$/, methods: ["GET", "POST"], auth: META_WEBHOOK_AUTH },
  { pattern: /^\/api\/whatsapp\/webhook$/, methods: ["GET", "POST"], auth: META_WEBHOOK_AUTH },
  { pattern: /^\/api\/webhook$/, methods: ["GET", "POST"], auth: META_WEBHOOK_AUTH },
  { pattern: /^\/api\/v1\/integrations\/facebook\/webhook$/, methods: ["GET", "POST"], auth: META_WEBHOOK_AUTH },
  { pattern: /^\/api\/webhooks\/facebook-lead$/, methods: ["GET", "POST"], auth: META_WEBHOOK_AUTH },

  // Third-party lead webhooks (Elementor etc.): the unguessable trigger id is the credential
  { pattern: /^\/api\/v1\/integrations\/[^/]+\/webhook$/, methods: ["POST", "OPTIONS"], auth: "secret trigger id in URL" },

  // Scheduled jobs
  { pattern: /^\/api\/cron\/process-followups$/, methods: ["GET"], auth: "Authorization: Bearer CRON_SECRET (checked in route)" },
  { pattern: /^\/api\/cleanup$/, methods: ["GET"], auth: "CLEANUP_TOKEN (checked in route)" },

  // Whalink click-through: must work for anyone clicking a shared link
  { pattern: /^\/api\/redirect\/[^/]+$/, methods: ["GET", "HEAD"], auth: "public by design (redirect only)" },
];

export function findPublicRoute(pathname: string, method: string): PublicRoute | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_ROUTES.find((r) => r.pattern.test(path) && r.methods.includes(method.toUpperCase()));
}

/** Protected API routes the server itself calls (with the internal token). */
export const INTERNAL_API_ROUTES: RegExp[] = [/^\/api\/ai-agent$/];

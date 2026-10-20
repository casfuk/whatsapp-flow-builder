import { NextRequest } from "next/server";
import { safeJson } from "@/lib/safe-response";
import { handleMetaVerification, readVerifiedMetaJson } from "@/lib/meta-webhook";

// GET: Webhook verification
export async function GET(request: NextRequest) {
  return handleMetaVerification(request, [process.env.WEBHOOK_VERIFY_TOKEN, process.env.WHATSAPP_VERIFY_TOKEN], "[Generic Webhook]");
}

// POST: Receive webhook events
export async function POST(request: NextRequest) {
  // Reject anything not signed by Meta, checked on the raw body before parsing
  const verified = await readVerifiedMetaJson(request, "[Generic Webhook]");
  if (!verified.ok) return verified.response;

  let body: unknown = null;

  try {
    body = verified.body;
  } catch {
    body = null;
  }

  // TEMP: Webhook stub – no DB / flow logic yet
  console.log("Webhook received:", body);

  return safeJson({
    ok: true,
    message: "Webhook stub. Flow handling not implemented yet.",
  });
}

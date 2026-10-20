import { NextRequest, NextResponse } from "next/server";
import { safeJson } from "@/lib/safe-response";

// GET: Webhook verification
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Generic webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return safeJson({ error: "Verification failed" }, { status: 403 });
}

// POST: Receive webhook events
export async function POST(request: NextRequest) {
  let body: unknown = null;

  try {
    body = await request.json();
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

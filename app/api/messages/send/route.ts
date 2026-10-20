import { NextRequest } from "next/server";
import { getWhatsAppClient } from "@/lib/whatsapp/client";
import { safeJson } from "@/lib/safe-response";

export async function POST(request: NextRequest) {
  try {
    const { to, body, workspaceId } = await request.json();

    if (!to || !body) {
      return safeJson(
        { error: "Missing required fields: to, body" },
        { status: 400 }
      );
    }

    const client = await getWhatsAppClient(workspaceId);
    await client.sendTextMessage({ to, body });

    return safeJson({ success: true });
  } catch (error) {
    console.error("Failed to send message:", error);
    return safeJson(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}

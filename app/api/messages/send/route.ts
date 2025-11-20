import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppClient } from "@/lib/whatsapp/client";

export async function POST(request: NextRequest) {
  try {
    const { to, body, workspaceId } = await request.json();

    if (!to || !body) {
      return NextResponse.json(
        { error: "Missing required fields: to, body" },
        { status: 400 }
      );
    }

    const client = await getWhatsAppClient(workspaceId);
    await client.sendTextMessage({ to, body });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send message" },
      { status: 500 }
    );
  }
}

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;

    // Mark chat as read by setting unreadCount to 0
    const chat = await prisma.chat.update({
      where: { id: chatId },
      data: { unreadCount: 0 },
    });

    return safeJson({
      success: true,
      chat: {
        id: chat.id,
        unreadCount: chat.unreadCount,
      },
    });
  } catch (error) {
    console.error("Failed to mark chat as read:", error);
    return safeJson(
      { error: "Failed to mark chat as read" },
      { status: 500 }
    );
  }
}

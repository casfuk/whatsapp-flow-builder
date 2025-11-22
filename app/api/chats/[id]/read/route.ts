import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({
      success: true,
      chat: {
        id: chat.id,
        unreadCount: chat.unreadCount,
      },
    });
  } catch (error) {
    console.error("Failed to mark chat as read:", error);
    return NextResponse.json(
      { error: "Failed to mark chat as read" },
      { status: 500 }
    );
  }
}

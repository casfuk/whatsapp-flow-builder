import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: Clear all messages from a chat but keep the chat
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;

    console.log(`[POST /api/chats/${chatId}/clear] Clearing messages from chat`);

    // Delete all messages in this chat
    const deletedMessages = await prisma.message.deleteMany({
      where: { chatId },
    });

    console.log(`[POST /api/chats/${chatId}/clear] Deleted ${deletedMessages.count} messages`);

    // Update chat to reflect empty state
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessagePreview: "",
        lastMessageAt: new Date(),
        unreadCount: 0,
      },
    });

    console.log(`[POST /api/chats/${chatId}/clear] ✅ Chat cleared successfully`);

    return NextResponse.json({
      success: true,
      deletedMessages: deletedMessages.count,
    });
  } catch (error) {
    console.error(`[POST /api/chats/[id]/clear] Error:`, error);
    return NextResponse.json(
      { error: "Failed to clear chat" },
      { status: 500 }
    );
  }
}

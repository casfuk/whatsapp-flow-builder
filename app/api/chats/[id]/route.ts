import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// DELETE: Delete a chat and all its messages
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: chatId } = await params;

    console.log(`[DELETE /api/chats/${chatId}] Deleting chat and all messages`);

    // Delete all messages in this chat first
    const deletedMessages = await prisma.message.deleteMany({
      where: { chatId },
    });

    console.log(`[DELETE /api/chats/${chatId}] Deleted ${deletedMessages.count} messages`);

    // Delete the chat
    await prisma.chat.delete({
      where: { id: chatId },
    });

    console.log(`[DELETE /api/chats/${chatId}] ✅ Chat deleted successfully`);

    return NextResponse.json({
      success: true,
      deletedMessages: deletedMessages.count,
    });
  } catch (error) {
    console.error("[DELETE /api/chats/[id]] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}

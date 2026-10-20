import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

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

    return safeJson({
      success: true,
      deletedMessages: deletedMessages.count,
    });
  } catch (error) {
    console.error("[DELETE /api/chats/[id]] Error:", error);
    return safeJson(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}

const AI_STATE_SELECT = {
  id: true,
  phoneNumber: true,
  assignedAgentType: true,
  assignedAgentId: true,
  aiDisabled: true,
  aiContextStartedAt: true,
} as const;

async function withAgentName(chat: { assignedAgentId: string | null } & Record<string, unknown>) {
  const agent = chat.assignedAgentId
    ? await prisma.aiAgent.findUnique({ where: { id: chat.assignedAgentId }, select: { name: true } })
    : null;
  return { ...chat, agentName: agent?.name ?? null };
}

// GET: AI agent state of a chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = await prisma.chat.findUnique({ where: { id }, select: AI_STATE_SELECT });
  if (!chat) return safeJson({ error: "Chat not found" }, { status: 404 });
  return safeJson(await withAgentName(chat));
}

/**
 * PATCH: manually control the conversation's AI (admin)
 * Body: { agentId?: string | null, aiDisabled?: boolean, resetContext?: boolean }
 * - agentId: assign this agent (null = no AI agent)
 * - resetContext (default true): the agent starts a fresh context from now
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.agentId !== undefined) {
      if (body.agentId === null || body.agentId === "") {
        Object.assign(data, { assignedAgentType: null, assignedAgentId: null });
      } else {
        const agent = await prisma.aiAgent.findUnique({ where: { id: String(body.agentId) }, select: { id: true } });
        if (!agent) return safeJson({ error: "AI agent not found" }, { status: 400 });
        Object.assign(data, { assignedAgentType: "AI", assignedAgentId: agent.id, assignedToUserId: null });
        if (body.resetContext !== false) data.aiContextStartedAt = new Date();
      }
      Object.assign(data, { lastQuestionSentAt: null, lastQuestionAttempts: 0, lastQuestionMessageId: null });
    }
    if (body.aiDisabled !== undefined) data.aiDisabled = body.aiDisabled === true;

    const chat = await prisma.chat.update({ where: { id }, data, select: AI_STATE_SELECT });
    return safeJson(await withAgentName(chat));
  } catch (error) {
    console.error("[PATCH /api/chats/[id]] Error:", (error as Error)?.message);
    return safeJson({ error: "Failed to update chat" }, { status: 500 });
  }
}

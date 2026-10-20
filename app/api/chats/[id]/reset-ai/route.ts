import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

/**
 * POST /api/chats/[id]/reset-ai (admin only)
 * Starts a fresh AI context for this conversation: the AI agent no longer sees
 * earlier messages, follow-ups and any flow waiting for an answer are cleared.
 * The message history itself is kept for the inbox.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chat = await prisma.chat.update({
      where: { id },
      data: {
        aiContextStartedAt: new Date(),
        perAgentTurnCount: "{}",
        isResponding: false,
        lastQuestionSentAt: null,
        lastQuestionAttempts: 0,
        lastQuestionMessageId: null,
      },
      select: { id: true, phoneNumber: true },
    });
    const sessions = await prisma.sessionState.updateMany({
      where: { sessionId: { startsWith: chat.phoneNumber }, status: "active" },
      data: { status: "completed" },
    });
    console.log(`[Reset AI] Chat ${chat.id}: fresh AI context, ${sessions.count} waiting flow(s) closed`);
    return safeJson({ success: true, closedFlows: sessions.count });
  } catch (error) {
    console.error("[Reset AI] Error:", (error as Error)?.message);
    return safeJson({ error: "Failed to reset AI context" }, { status: 500 });
  }
}

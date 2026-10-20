import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";
import { fallbackMessageFor, generateAgentReply } from "@/lib/ai/agent-runtime";

// POST /api/ai-agent - Generate an AI agent reply (admin or internal use).
// Body: { agentId, userMessage?, sessionId? (chat id) }
export async function POST(request: NextRequest) {
  let agentId: string | undefined;
  try {
    const body = await request.json();
    agentId = body.agentId;
    const { userMessage, sessionId } = body;

    if (!agentId) {
      return safeJson({ error: "Missing required field: agentId" }, { status: 400 });
    }

    const result = await generateAgentReply({ agentId, chatId: sessionId || null, userMessage: userMessage || null });
    return safeJson({
      reply: result.reply,
      agentId: result.agentId,
      agentName: result.agentName,
      handoverData: result.handoverData,
    });
  } catch (error) {
    console.error("[AI Agent] Failed to process message:", (error as Error)?.message);
    const agent = agentId ? await prisma.aiAgent.findUnique({ where: { id: agentId } }).catch(() => null) : null;
    return safeJson(
      {
        error: "Failed to process AI agent message",
        details: error instanceof Error ? error.message : "Unknown error",
        reply: agent ? fallbackMessageFor(agent) : "Ahora mismo no puedo responder 😅",
      },
      { status: error instanceof Error && /not found|inactive/.test(error.message) ? 404 : 500 }
    );
  }
}

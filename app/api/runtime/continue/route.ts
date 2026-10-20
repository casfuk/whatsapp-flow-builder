import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RuntimeEngine } from "@/lib/runtime-engine";
import { safeJson } from "@/lib/safe-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flowKey, sessionId, messageText } = body;

    if (!sessionId || !messageText) {
      return safeJson(
        { error: "sessionId and messageText are required" },
        { status: 400 }
      );
    }

    // Get session state
    const sessionState = await RuntimeEngine.getSessionState(sessionId);
    if (!sessionState) {
      return safeJson(
        { error: "Session not found. Please start a new flow." },
        { status: 404 }
      );
    }

    if (sessionState.status === "completed") {
      return safeJson(
        { error: "Session has already completed" },
        { status: 400 }
      );
    }

    if (!sessionState.currentStepId) {
      return safeJson(
        { error: "No current step found for session" },
        { status: 400 }
      );
    }

    // Load the flow
    const flow = await prisma.flow.findUnique({
      where: { id: sessionState.flowId },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!flow) {
      return safeJson(
        { error: "Flow not found" },
        { status: 404 }
      );
    }

    // Restore variables from session
    const variables = JSON.parse(sessionState.variablesJson || "{}");

    // Create runtime engine instance
    const engine = new RuntimeEngine(flow, sessionId, variables);

    // Continue from the current question step with the answer
    const actions = await engine.continueFromQuestion(
      sessionState.currentStepId,
      messageText
    );

    return safeJson({
      success: true,
      sessionId,
      flowId: flow.id,
      flowKey: flow.key,
      actions,
      variables: engine.getVariables(),
    });
  } catch (error) {
    console.error("Runtime continue error:", error);
    return safeJson(
      { error: "Failed to continue flow execution" },
      { status: 500 }
    );
  }
}

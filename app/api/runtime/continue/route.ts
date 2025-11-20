import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RuntimeEngine } from "@/lib/runtime-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flowKey, sessionId, messageText } = body;

    if (!sessionId || !messageText) {
      return NextResponse.json(
        { error: "sessionId and messageText are required" },
        { status: 400 }
      );
    }

    // Get session state
    const sessionState = await RuntimeEngine.getSessionState(sessionId);
    if (!sessionState) {
      return NextResponse.json(
        { error: "Session not found. Please start a new flow." },
        { status: 404 }
      );
    }

    if (sessionState.status === "completed") {
      return NextResponse.json(
        { error: "Session has already completed" },
        { status: 400 }
      );
    }

    if (!sessionState.currentStepId) {
      return NextResponse.json(
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
      return NextResponse.json(
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

    return NextResponse.json({
      success: true,
      sessionId,
      flowId: flow.id,
      flowKey: flow.key,
      actions,
      variables: engine.getVariables(),
    });
  } catch (error) {
    console.error("Runtime continue error:", error);
    return NextResponse.json(
      { error: "Failed to continue flow execution" },
      { status: 500 }
    );
  }
}

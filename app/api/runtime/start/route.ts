import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RuntimeEngine } from "@/lib/runtime-engine";
import { safeJson } from "@/lib/safe-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flowKey, sessionId, name, email, phone, tags } = body;

    if (!flowKey || !sessionId) {
      return safeJson(
        { error: "flowKey and sessionId are required" },
        { status: 400 }
      );
    }

    // Load the flow
    const flow = await prisma.flow.findUnique({
      where: { key: flowKey },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!flow) {
      return safeJson(
        { error: `Flow with key "${flowKey}" not found` },
        { status: 404 }
      );
    }

    // Increment flow execution counter
    await prisma.flow.update({
      where: { id: flow.id },
      data: {
        executions: {
          increment: 1,
        },
      },
    });

    // Find the start step
    const startStep = flow.steps.find((s) => s.type === "start");
    if (!startStep) {
      return safeJson(
        { error: "Flow has no start step" },
        { status: 400 }
      );
    }

    // Prepare initial variables
    const initialVariables: Record<string, any> = {
      name: name || "",
      email: email || "",
      phone: phone || "",
      tags: tags || [],
    };

    // Create runtime engine instance
    const engine = new RuntimeEngine(flow, sessionId, initialVariables);

    // Execute from start step
    const actions = await engine.executeFromStep(startStep.id);

    return safeJson({
      success: true,
      sessionId,
      flowId: flow.id,
      flowKey: flow.key,
      actions,
      variables: engine.getVariables(),
    });
  } catch (error) {
    console.error("Runtime start error:", error);
    return safeJson(
      { error: "Failed to start flow execution" },
      { status: 500 }
    );
  }
}

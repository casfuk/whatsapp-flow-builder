import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/flows/[id]/duplicate
 * Duplicates a flow including all its steps and connections
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flowId } = await params;

    // Get the original flow with all its steps and connections
    const originalFlow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!originalFlow) {
      return NextResponse.json(
        { error: "Flow not found" },
        { status: 404 }
      );
    }

    // Generate unique key for the duplicate
    const timestamp = Date.now();
    const newKey = `${originalFlow.key}-copy-${timestamp}`;
    const newName = `${originalFlow.name} (Copia)`;

    // Create the duplicate flow (without steps and connections first)
    const duplicatedFlow = await prisma.flow.create({
      data: {
        name: newName,
        key: newKey,
        description: originalFlow.description,
        isActive: false, // Start as inactive
        executions: 0, // Reset executions count
      },
    });

    // Map old step IDs to new step IDs
    const stepIdMap = new Map<string, string>();

    // Duplicate all steps
    for (const step of originalFlow.steps) {
      const duplicatedStep = await prisma.flowStep.create({
        data: {
          flowId: duplicatedFlow.id,
          type: step.type,
          label: step.label,
          configJson: step.configJson,
          positionX: step.positionX,
          positionY: step.positionY,
        },
      });

      stepIdMap.set(step.id, duplicatedStep.id);

      // Update startStepId if this was the start step
      if (originalFlow.startStepId === step.id) {
        await prisma.flow.update({
          where: { id: duplicatedFlow.id },
          data: { startStepId: duplicatedStep.id },
        });
      }
    }

    // Duplicate all connections with new step IDs
    for (const connection of originalFlow.connections) {
      const newFromStepId = stepIdMap.get(connection.fromStepId);
      const newToStepId = stepIdMap.get(connection.toStepId);

      if (newFromStepId && newToStepId) {
        await prisma.flowConnection.create({
          data: {
            flowId: duplicatedFlow.id,
            fromStepId: newFromStepId,
            toStepId: newToStepId,
            conditionLabel: connection.conditionLabel,
            sourceHandle: connection.sourceHandle,
          },
        });
      }
    }

    // Fetch the complete duplicated flow with all relations
    const completeDuplicatedFlow = await prisma.flow.findUnique({
      where: { id: duplicatedFlow.id },
      include: {
        steps: true,
        connections: true,
      },
    });

    return NextResponse.json(completeDuplicatedFlow, { status: 201 });
  } catch (error) {
    console.error("Failed to duplicate flow:", error);
    return NextResponse.json(
      {
        error: "Failed to duplicate flow",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

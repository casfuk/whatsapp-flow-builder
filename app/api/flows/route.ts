import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const flows = await prisma.flow.findMany({
      include: {
        steps: true,
        connections: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json(flows);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch flows" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, isActive, nodes, edges } = body;

    // Generate a unique key from name (lowercase, no spaces, add timestamp for uniqueness)
    const baseKey = (name || "flow")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .substring(0, 50);
    const uniqueKey = `${baseKey}-${Date.now()}`;

    // Create flow with nodes and edges
    const flow = await prisma.$transaction(async (tx) => {
      const newFlow = await tx.flow.create({
        data: {
          name,
          key: uniqueKey,
          description: description || "",
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      // Create steps from nodes
      if (nodes && nodes.length > 0) {
        // Debug logging for question nodes
        nodes.forEach((node: any) => {
          if (node.type === "question_multiple" || node.type === "question_simple") {
            console.log(`[Flow Save] ${node.type} node (id: ${node.id}):`, {
              questionText: node.data.questionText,
              buttons: node.data.buttons,
              saveToFieldId: node.data.saveToFieldId,
              allData: node.data
            });
          }
        });

        await tx.flowStep.createMany({
          data: nodes.map((node: any) => ({
            id: node.id,
            flowId: newFlow.id,
            type: node.type || "default",
            label: node.data.label || node.type || "Step",
            configJson: JSON.stringify(node.data),
            positionX: Math.round(node.position.x),
            positionY: Math.round(node.position.y),
          })),
        });
      }

      // Create connections from edges
      if (edges && edges.length > 0) {
        await tx.flowConnection.createMany({
          data: edges.map((edge: any) => ({
            flowId: newFlow.id,
            fromStepId: edge.source,
            toStepId: edge.target,
            conditionLabel: edge.label || null,
            sourceHandle: edge.sourceHandle || null,
          })),
        });
      }

      return newFlow;
    });

    // Return complete flow with steps and connections
    const fullFlow = await prisma.flow.findUnique({
      where: { id: flow.id },
      include: {
        steps: true,
        connections: true,
      },
    });

    // Convert steps to React Flow nodes format
    const savedNodes = fullFlow!.steps.map((step) => {
      let config = {};
      try {
        config = JSON.parse(step.configJson);
      } catch (e) {
        console.error("Failed to parse step config:", e);
      }

      return {
        id: step.id,
        type: step.type,
        position: { x: step.positionX, y: step.positionY },
        data: {
          ...config,
          label: step.label,
        },
      };
    });

    // Convert connections to React Flow edges format
    const savedEdges = fullFlow!.connections.map((conn) => ({
      id: conn.id,
      source: conn.fromStepId,
      target: conn.toStepId,
      label: conn.conditionLabel || undefined,
      sourceHandle: conn.sourceHandle || undefined,
    }));

    return NextResponse.json(
      {
        ...fullFlow,
        nodes: savedNodes,
        edges: savedEdges,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create flow error:", error);
    return NextResponse.json(
      {
        error: "Failed to create flow",
        message: error.message || "Unknown error",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

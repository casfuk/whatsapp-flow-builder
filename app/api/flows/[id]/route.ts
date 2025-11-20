import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const flow = await prisma.flow.findUnique({
      where: { id },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!flow) {
      return NextResponse.json({ error: "Flow not found" }, { status: 404 });
    }

    // Convert steps to React Flow nodes format
    const nodes = flow.steps.map((step) => {
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
    const edges = flow.connections.map((conn) => ({
      id: conn.id,
      source: conn.fromStepId,
      target: conn.toStepId,
      label: conn.conditionLabel || undefined,
      sourceHandle: conn.sourceHandle || undefined,
    }));

    // Return flow with converted nodes and edges
    return NextResponse.json({
      ...flow,
      nodes,
      edges,
    });
  } catch (error) {
    console.error("Failed to fetch flow:", error);
    return NextResponse.json(
      { error: "Failed to fetch flow" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, isActive, nodes, edges } = body;

    // Update flow with nodes (steps) and edges (connections)
    const flow = await prisma.$transaction(async (tx) => {
      // Update flow metadata
      await tx.flow.update({
        where: { id },
        data: {
          name,
          description,
          isActive: isActive !== undefined ? isActive : false,
        },
      });

      // Delete existing connections and steps
      await tx.flowConnection.deleteMany({ where: { flowId: id } });
      await tx.flowStep.deleteMany({ where: { flowId: id } });

      // Create new steps from nodes
      if (nodes && nodes.length > 0) {
        await tx.flowStep.createMany({
          data: nodes.map((node: any) => ({
            id: node.id,
            flowId: id,
            type: node.type || "default",
            label: node.data.label || node.type || "Step",
            configJson: JSON.stringify(node.data),
            positionX: Math.round(node.position.x),
            positionY: Math.round(node.position.y),
          })),
        });
      }

      // Create new connections from edges
      if (edges && edges.length > 0) {
        await tx.flowConnection.createMany({
          data: edges.map((edge: any) => ({
            flowId: id,
            fromStepId: edge.source,
            toStepId: edge.target,
            conditionLabel: edge.label || null,
            sourceHandle: edge.sourceHandle || null,
          })),
        });
      }
    });

    // Return updated flow
    const fullFlow = await prisma.flow.findUnique({
      where: { id },
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

    return NextResponse.json({
      ...fullFlow,
      nodes: savedNodes,
      edges: savedEdges,
    });
  } catch (error: any) {
    console.error("Update flow error:", error);
    return NextResponse.json(
      {
        error: "Failed to update flow",
        message: error.message || "Unknown error",
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.flow.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete flow" },
      { status: 500 }
    );
  }
}

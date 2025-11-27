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
      // Don't use frontend node IDs as database IDs - let Prisma generate unique ones
      const nodeIdToStepIdMap = new Map<string, string>();

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

        // Create steps one by one to get their generated IDs and build mapping
        for (const node of nodes) {
          const createdStep = await tx.flowStep.create({
            data: {
              flowId: newFlow.id,
              type: node.type || "default",
              label: node.data.label || node.type || "Step",
              configJson: JSON.stringify({
                ...node.data,
                _nodeId: node.id // Store frontend node ID for reference
              }),
              positionX: Math.round(node.position.x),
              positionY: Math.round(node.position.y),
            },
          });
          nodeIdToStepIdMap.set(node.id, createdStep.id);
        }
      }

      // Create connections from edges using the mapped database IDs
      if (edges && edges.length > 0) {
        await tx.flowConnection.createMany({
          data: edges.map((edge: any) => ({
            flowId: newFlow.id,
            fromStepId: nodeIdToStepIdMap.get(edge.source) || edge.source,
            toStepId: nodeIdToStepIdMap.get(edge.target) || edge.target,
            conditionLabel: edge.label || null,
            sourceHandle: edge.sourceHandle || null,
          })),
        });
      }

      return newFlow;
    });

    // Handle third-party trigger creation
    console.log('[Flow POST] Checking for third-party trigger...');
    const startNode = nodes?.find((n: any) => n.type === 'start');
    if (startNode && startNode.data?.trigger?.type === 'third_party') {
      const trigger = startNode.data.trigger;
      console.log('[Flow POST] Found third_party trigger:', trigger);

      if (trigger.deviceId) {
        try {
          console.log('[Flow POST] Creating new ThirdPartyTrigger');
          const fieldMapping = trigger.fieldMappings
            ? JSON.stringify(trigger.fieldMappings)
            : JSON.stringify([]);
          const runOncePerContact = trigger.oncePerContact || false;

          const dbTrigger = await prisma.thirdPartyTrigger.create({
            data: {
              flowId: flow.id,
              deviceId: trigger.deviceId,
              type: trigger.type || 'facebook_lead',
              title: trigger.name || null,
              fieldMapping,
              runOncePerContact,
            },
          });

          console.log('[Flow POST] ThirdPartyTrigger created:', dbTrigger.id);

          // Find the created start step in the database
          const startStep = await prisma.flowStep.findFirst({
            where: {
              flowId: flow.id,
              type: 'start',
            },
          });

          if (startStep) {
            // Update the start node to include the triggerId
            await prisma.flowStep.update({
              where: { id: startStep.id },
              data: {
                configJson: JSON.stringify({
                  ...startNode.data,
                  _nodeId: startNode.id,
                  trigger: {
                    ...trigger,
                    thirdPartyTriggerId: dbTrigger.id,
                  },
                }),
              },
            });

            console.log('[Flow POST] Start node updated with thirdPartyTriggerId');
          }
        } catch (error) {
          console.error('[Flow POST] Error creating ThirdPartyTrigger:', error);
        }
      }
    }

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

    // Exclude raw steps and connections from response to avoid duplicates
    const { steps, connections, ...flowWithoutRawData } = fullFlow!;

    return NextResponse.json(
      {
        ...flowWithoutRawData,
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

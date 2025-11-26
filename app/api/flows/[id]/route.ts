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

    // Load third-party trigger ID for start nodes with third_party triggers
    console.log('[API GET] Checking for third-party triggers...');
    const startNode = nodes.find((n) => n.type === 'start');
    if (startNode && (startNode.data as any)?.trigger?.type === 'third_party') {
      try {
        const trigger = (startNode.data as any).trigger;
        const dbTrigger = await prisma.thirdPartyTrigger.findFirst({
          where: {
            flowId: flow.id,
            deviceId: trigger.deviceId,
          },
        });

        if (dbTrigger) {
          console.log('[API GET] Found ThirdPartyTrigger:', dbTrigger.id);
          (startNode.data as any).trigger.thirdPartyTriggerId = dbTrigger.id;
          // Parse and include field mappings
          try {
            const fieldMappings = JSON.parse(dbTrigger.fieldMapping);
            (startNode.data as any).trigger.fieldMappings = fieldMappings;
          } catch (error) {
            console.error('[API GET] Error parsing fieldMapping:', error);
            (startNode.data as any).trigger.fieldMappings = [];
          }
        }
      } catch (error) {
        console.error('[API GET] Error loading ThirdPartyTrigger:', error);
      }
    }

    // Migration: Fix multipleChoice nodes to have options for all their connections
    console.log('[API GET] Running multipleChoice migration...');
    const migratedNodes = nodes.map((node) => {
      if (node.type === 'multipleChoice') {
        // Find all connections from this node
        const nodeConnections = flow.connections.filter(
          (conn) => conn.fromStepId === node.id && conn.sourceHandle
        );

        // Get unique sourceHandles
        const sourceHandles = [...new Set(nodeConnections.map((conn) => conn.sourceHandle))];

        console.log(`[API GET Migration] MultipleChoice node ${node.id}:`, {
          existingOptions: (node.data as any).options || [],
          sourceHandlesInConnections: sourceHandles,
          connectionCount: nodeConnections.length
        });

        // Ensure node.data.options exists and includes all sourceHandles
        const nodeData = node.data as any;
        const existingOptions = nodeData.options || [];
        const existingOptionIds = new Set(existingOptions.map((opt: any) => opt.id));

        // Add missing options for any sourceHandles not in the options array
        const missingOptions = sourceHandles
          .filter((handle) => handle && !existingOptionIds.has(handle))
          .map((handle) => ({
            id: handle,
            title: "", // Empty title as placeholder
          }));

        if (missingOptions.length > 0) {
          console.log(`[API GET Migration] Adding ${missingOptions.length} missing options to node ${node.id}:`, missingOptions);
          nodeData.options = [...existingOptions, ...missingOptions];
        }

        console.log(`[API GET Migration] Final options for node ${node.id}:`, nodeData.options);
      }
      return node;
    });

    // Return flow with converted nodes and edges
    return NextResponse.json({
      ...flow,
      nodes: migratedNodes,
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

function validateFlow(nodes: any[], edges: any[]) {
  const errors: Array<{ stepId: string; message: string }> = [];

  // Build connections map
  const connectionsByFromStep = new Map<string, typeof edges>();
  for (const edge of edges) {
    const list = connectionsByFromStep.get(edge.source) ?? [];
    list.push(edge);
    connectionsByFromStep.set(edge.source, list);
  }

  for (const node of nodes) {
    if (node.type === "multipleChoice") {
      const options = node.data?.options || [];

      // Check for >3 options
      if (options.length > 3) {
        errors.push({
          stepId: node.id,
          message: "WhatsApp solo permite 3 opciones en una pregunta.",
        });
      }

      // Check for options without connections
      const stepConnections = connectionsByFromStep.get(node.id) ?? [];
      for (const opt of options) {
        const hasConnection = stepConnections.some(
          (edge) => edge.sourceHandle === opt.id
        );

        if (!hasConnection) {
          errors.push({
            stepId: node.id,
            message: `La opción "${opt.title || opt.id}" no tiene ningún paso conectado.`,
          });
        }
      }
    }
  }

  return errors;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`[API PUT /api/flows/${id}] Request received`);

    const body = await request.json();
    console.log('[API PUT] Request body:', JSON.stringify(body, null, 2));

    const { name, description, isActive, nodes, edges } = body;

    console.log('[API PUT] Parsed data:', {
      name,
      isActive,
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0
    });

    // Validate flow before saving
    const validationErrors = validateFlow(nodes || [], edges || []);
    if (validationErrors.length > 0) {
      console.log('[API PUT] Validation failed:', validationErrors);
      return NextResponse.json(
        { error: "Validation failed", errors: validationErrors },
        { status: 400 }
      );
    }

    // Update flow with nodes (steps) and edges (connections)
    const flow = await prisma.$transaction(async (tx) => {
      console.log('[API PUT] Starting transaction...');

      // Update flow metadata
      await tx.flow.update({
        where: { id },
        data: {
          name,
          description,
          isActive: isActive !== undefined ? isActive : false,
        },
      });
      console.log('[API PUT] Flow metadata updated');

      // Delete existing connections and steps
      await tx.flowConnection.deleteMany({ where: { flowId: id } });
      await tx.flowStep.deleteMany({ where: { flowId: id } });
      console.log('[API PUT] Deleted existing steps and connections');

      // Create new steps from nodes
      if (nodes && nodes.length > 0) {
        // Migration: Fix multipleChoice nodes to have options for all their connections
        console.log('[API PUT] Running multipleChoice migration...');
        const migratedNodes = nodes.map((node: any) => {
          if (node.type === 'multipleChoice') {
            // Find all edges from this node
            const nodeEdges = edges?.filter(
              (edge: any) => edge.source === node.id && edge.sourceHandle
            ) || [];

            // Get unique sourceHandles
            const sourceHandles = [...new Set(nodeEdges.map((edge: any) => edge.sourceHandle))];

            console.log(`[API PUT Migration] MultipleChoice node ${node.id}:`, {
              existingOptions: node.data?.options || [],
              sourceHandlesInEdges: sourceHandles,
              edgeCount: nodeEdges.length
            });

            // Ensure node.data.options exists and includes all sourceHandles
            const existingOptions = node.data?.options || [];
            const existingOptionIds = new Set(existingOptions.map((opt: any) => opt.id));

            // Add missing options for any sourceHandles not in the options array
            const missingOptions = sourceHandles
              .filter((handle) => handle && !existingOptionIds.has(handle))
              .map((handle) => ({
                id: handle,
                title: "", // Empty title as placeholder - user can fill this in
              }));

            if (missingOptions.length > 0) {
              console.log(`[API PUT Migration] Adding ${missingOptions.length} missing options to node ${node.id}:`, missingOptions);
              node.data.options = [...existingOptions, ...missingOptions];
            }

            console.log(`[API PUT Migration] Final options for node ${node.id}:`, node.data.options);
          }
          return node;
        });

        // Debug logging for question nodes
        const questionNodes = migratedNodes.filter((n: any) =>
          n.type === 'question_multiple' || n.type === 'question_simple'
        );

        console.log(`[API PUT] Found ${questionNodes.length} question node(s)`);
        questionNodes.forEach((node: any) => {
          console.log(`[API PUT] Question node ${node.id}:`, {
            type: node.type,
            questionText: node.data?.questionText,
            buttons: node.data?.buttons,
            saveToFieldId: node.data?.saveToFieldId,
            fullData: node.data
          });
        });

        const stepsData = migratedNodes.map((node: any) => ({
          id: node.id,
          flowId: id,
          type: node.type || "default",
          label: node.data.label || node.type || "Step",
          configJson: JSON.stringify(node.data),
          positionX: Math.round(node.position.x),
          positionY: Math.round(node.position.y),
        }));

        console.log('[API PUT] Creating', stepsData.length, 'steps...');
        await tx.flowStep.createMany({ data: stepsData });
        console.log('[API PUT] Steps created successfully');
      }

      // Create new connections from edges
      if (edges && edges.length > 0) {
        console.log('[API PUT] Creating', edges.length, 'connections...');
        await tx.flowConnection.createMany({
          data: edges.map((edge: any) => ({
            flowId: id,
            fromStepId: edge.source,
            toStepId: edge.target,
            conditionLabel: edge.label || null,
            sourceHandle: edge.sourceHandle || null,
          })),
        });
        console.log('[API PUT] Connections created successfully');
      }

      console.log('[API PUT] Transaction complete');
    });

    // Handle third-party trigger creation/update
    console.log('[API PUT] Checking for third-party trigger...');
    const startNode = nodes?.find((n: any) => n.type === 'start');
    if (startNode && startNode.data?.trigger?.type === 'third_party') {
      const trigger = startNode.data.trigger;
      console.log('[API PUT] Found third_party trigger:', trigger);

      if (trigger.deviceId) {
        try {
          // Check if we already have a ThirdPartyTrigger for this flow
          const existingTrigger = await prisma.thirdPartyTrigger.findFirst({
            where: {
              flowId: id,
              deviceId: trigger.deviceId,
            },
          });

          let dbTrigger;
          const fieldMapping = trigger.fieldMappings
            ? JSON.stringify(trigger.fieldMappings)
            : JSON.stringify([]);
          const runOncePerContact = trigger.oncePerContact || false;

          if (existingTrigger) {
            console.log('[API PUT] Updating existing ThirdPartyTrigger:', existingTrigger.id);
            dbTrigger = await prisma.thirdPartyTrigger.update({
              where: { id: existingTrigger.id },
              data: {
                type: trigger.type || 'facebook_lead',
                title: trigger.name || null,
                fieldMapping,
                runOncePerContact,
              },
            });
          } else {
            console.log('[API PUT] Creating new ThirdPartyTrigger');
            dbTrigger = await prisma.thirdPartyTrigger.create({
              data: {
                flowId: id,
                deviceId: trigger.deviceId,
                type: trigger.type || 'facebook_lead',
                title: trigger.name || null,
                fieldMapping,
                runOncePerContact,
              },
            });
          }

          console.log('[API PUT] ThirdPartyTrigger saved:', dbTrigger.id);

          // Update the start node in the database to include the triggerId
          await prisma.flowStep.update({
            where: { id: startNode.id },
            data: {
              configJson: JSON.stringify({
                ...startNode.data,
                trigger: {
                  ...trigger,
                  thirdPartyTriggerId: dbTrigger.id,
                },
              }),
            },
          });

          console.log('[API PUT] Start node updated with thirdPartyTriggerId');
        } catch (error) {
          console.error('[API PUT] Error creating/updating ThirdPartyTrigger:', error);
          // Don't fail the whole flow save, just log the error
        }
      }
    }

    // Return updated flow
    console.log('[API PUT] Fetching updated flow with steps and connections...');
    const fullFlow = await prisma.flow.findUnique({
      where: { id },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!fullFlow) {
      console.error('[API PUT] Flow not found after update!');
      return NextResponse.json(
        { error: "Flow not found after update" },
        { status: 404 }
      );
    }

    console.log('[API PUT] Flow fetched, converting to React Flow format...');

    // Convert steps to React Flow nodes format
    const savedNodes = fullFlow.steps.map((step) => {
      let config = {};
      try {
        config = JSON.parse(step.configJson);
      } catch (e) {
        console.error("[API PUT] Failed to parse step config:", e);
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
    const savedEdges = fullFlow.connections.map((conn) => ({
      id: conn.id,
      source: conn.fromStepId,
      target: conn.toStepId,
      label: conn.conditionLabel || undefined,
      sourceHandle: conn.sourceHandle || undefined,
    }));

    console.log('[API PUT] Returning response with', savedNodes.length, 'nodes and', savedEdges.length, 'edges');

    return NextResponse.json({
      ...fullFlow,
      nodes: savedNodes,
      edges: savedEdges,
    });
  } catch (error: any) {
    console.error("[API PUT] Update flow error:", error);
    console.error("[API PUT] Error stack:", error.stack);
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

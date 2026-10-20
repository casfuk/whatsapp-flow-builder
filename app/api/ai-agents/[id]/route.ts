import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { safeJson } from "@/lib/safe-response";
import { parseAgentInput } from "@/lib/ai/agent-config";

/**
 * GET /api/ai-agents/[id]
 * Get a specific AI agent by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`[AI Agents API] GET /api/ai-agents/${id}`);

    const agent = await prisma.aiAgent.findUnique({
      where: { id },
    });

    if (!agent) {
      return safeJson(
        {
          success: false,
          error: "AI agent not found",
        },
        { status: 404 }
      );
    }

    return safeJson({
      success: true,
      agent,
    });
  } catch (error) {
    console.error("[AI Agents API] Error fetching agent:", error);
    return safeJson(
      {
        success: false,
        error: "Failed to fetch AI agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/ai-agents/[id]
 * Update an existing AI agent
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    console.log(`[AI Agents API] PUT /api/ai-agents/${id}`, body);

    // Check if agent exists
    const existingAgent = await prisma.aiAgent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return safeJson(
        {
          success: false,
          error: "AI agent not found",
        },
        { status: 404 }
      );
    }

    const { data: updateData, errors } = parseAgentInput(body, { partial: true });
    if (errors.length > 0) {
      return safeJson({ success: false, error: errors.join(". ") }, { status: 400 });
    }

    // Update the agent
    const updatedAgent = await prisma.aiAgent.update({
      where: { id },
      data: updateData as Prisma.AiAgentUpdateInput,
    });

    console.log(`[AI Agents API] Updated agent: ${id}`);

    return safeJson({
      success: true,
      agent: updatedAgent,
      message: "AI agent updated successfully",
    });
  } catch (error) {
    console.error("[AI Agents API] Error updating agent:", error);
    return safeJson(
      {
        success: false,
        error: "Failed to update AI agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai-agents/[id]
 * Delete an AI agent (optional - for completeness)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`[AI Agents API] DELETE /api/ai-agents/${id}`);

    // Check if agent exists
    const existingAgent = await prisma.aiAgent.findUnique({
      where: { id },
    });

    if (!existingAgent) {
      return safeJson(
        {
          success: false,
          error: "AI agent not found",
        },
        { status: 404 }
      );
    }

    // Release conversations handled by this agent, then delete it
    await prisma.chat.updateMany({
      where: { assignedAgentId: id },
      data: { assignedAgentType: null, assignedAgentId: null, lastQuestionSentAt: null, lastQuestionAttempts: 0 },
    });
    await prisma.aiAgent.delete({
      where: { id },
    });

    console.log(`[AI Agents API] Deleted agent: ${id}`);

    return safeJson({
      success: true,
      message: "AI agent deleted successfully",
    });
  } catch (error) {
    console.error("[AI Agents API] Error deleting agent:", error);
    return safeJson(
      {
        success: false,
        error: "Failed to delete AI agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

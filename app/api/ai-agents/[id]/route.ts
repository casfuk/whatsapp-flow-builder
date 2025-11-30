import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      return NextResponse.json(
        {
          success: false,
          error: "AI agent not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error("[AI Agents API] Error fetching agent:", error);
    return NextResponse.json(
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
      return NextResponse.json(
        {
          success: false,
          error: "AI agent not found",
        },
        { status: 404 }
      );
    }

    // Validate maxTurns if provided
    if (body.maxTurns !== undefined) {
      if (body.maxTurns < 1 || body.maxTurns > 20) {
        return NextResponse.json(
          {
            success: false,
            error: "maxTurns must be between 1 and 20",
          },
          { status: 400 }
        );
      }
    }

    // Build update data object (only update provided fields)
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.tone !== undefined) updateData.tone = body.tone;
    if (body.goal !== undefined) updateData.goal = body.goal;
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
    if (body.maxTurns !== undefined) updateData.maxTurns = body.maxTurns;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Update the agent
    const updatedAgent = await prisma.aiAgent.update({
      where: { id },
      data: updateData,
    });

    console.log(`[AI Agents API] Updated agent: ${id}`);

    return NextResponse.json({
      success: true,
      agent: updatedAgent,
      message: "AI agent updated successfully",
    });
  } catch (error) {
    console.error("[AI Agents API] Error updating agent:", error);
    return NextResponse.json(
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
      return NextResponse.json(
        {
          success: false,
          error: "AI agent not found",
        },
        { status: 404 }
      );
    }

    // Delete the agent
    await prisma.aiAgent.delete({
      where: { id },
    });

    console.log(`[AI Agents API] Deleted agent: ${id}`);

    return NextResponse.json({
      success: true,
      message: "AI agent deleted successfully",
    });
  } catch (error) {
    console.error("[AI Agents API] Error deleting agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete AI agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

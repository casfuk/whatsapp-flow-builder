import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ai-agents/[id] - Get a specific AI agent
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const aiAgent = await prisma.aiAgent.findUnique({
      where: { id },
    });

    if (!aiAgent) {
      return NextResponse.json({ error: "AI agent not found" }, { status: 404 });
    }

    return NextResponse.json(aiAgent);
  } catch (error) {
    console.error("Failed to fetch AI agent:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI agent" },
      { status: 500 }
    );
  }
}

// PUT /api/ai-agents/[id] - Update an AI agent
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const {
      name,
      description,
      language,
      tone,
      goal,
      systemPrompt,
      maxTurns,
      isActive,
    } = body;

    const aiAgent = await prisma.aiAgent.update({
      where: { id },
      data: {
        name,
        description,
        language,
        tone,
        goal,
        systemPrompt,
        maxTurns,
        isActive,
      },
    });

    return NextResponse.json(aiAgent);
  } catch (error) {
    console.error("Failed to update AI agent:", error);
    return NextResponse.json(
      { error: "Failed to update AI agent" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai-agents/[id] - Delete an AI agent
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await prisma.aiAgent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete AI agent:", error);
    return NextResponse.json(
      { error: "Failed to delete AI agent" },
      { status: 500 }
    );
  }
}

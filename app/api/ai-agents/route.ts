import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/ai-agents
 * Get list of all AI agents
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[AI Agents API] GET /api/ai-agents - Fetching all agents");

    const agents = await prisma.aiAgent.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        language: true,
        tone: true,
        goal: true,
        systemPrompt: true,
        maxTurns: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`[AI Agents API] Found ${agents.length} agent(s)`);

    return NextResponse.json({
      success: true,
      agents,
      count: agents.length,
    });
  } catch (error) {
    console.error("[AI Agents API] Error fetching agents:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AI agents",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai-agents
 * Create a new AI agent
 */
export async function POST(request: NextRequest) {
  try {
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

    console.log("[AI Agents API] POST /api/ai-agents - Creating new agent:", name);

    // Validation
    if (!name || !systemPrompt) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name and systemPrompt are required",
        },
        { status: 400 }
      );
    }

    if (maxTurns && (maxTurns < 1 || maxTurns > 20)) {
      return NextResponse.json(
        {
          success: false,
          error: "maxTurns must be between 1 and 20",
        },
        { status: 400 }
      );
    }

    const agent = await prisma.aiAgent.create({
      data: {
        name,
        description: description || null,
        language: language || "es",
        tone: tone || "professional",
        goal: goal || null,
        systemPrompt,
        maxTurns: maxTurns || 20,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    console.log(`[AI Agents API] Created agent: ${agent.id}`);

    return NextResponse.json({
      success: true,
      agent,
    });
  } catch (error) {
    console.error("[AI Agents API] Error creating agent:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create AI agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

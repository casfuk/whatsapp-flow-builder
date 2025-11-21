import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/ai-agents - List all AI agents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";

    const aiAgents = await prisma.aiAgent.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(aiAgents);
  } catch (error) {
    console.error("Failed to fetch AI agents:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI agents" },
      { status: 500 }
    );
  }
}

// POST /api/ai-agents - Create a new AI agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      language = "es",
      tone = "professional",
      goal,
      systemPrompt,
      maxTurns = 10,
      createdById,
    } = body;

    // Validation
    if (!name || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: name, systemPrompt" },
        { status: 400 }
      );
    }

    const aiAgent = await prisma.aiAgent.create({
      data: {
        name,
        description,
        language,
        tone,
        goal,
        systemPrompt,
        maxTurns,
        createdById,
        isActive: true,
      },
    });

    return NextResponse.json(aiAgent, { status: 201 });
  } catch (error) {
    console.error("Failed to create AI agent:", error);
    return NextResponse.json(
      { error: "Failed to create AI agent" },
      { status: 500 }
    );
  }
}

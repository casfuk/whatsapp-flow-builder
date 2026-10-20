import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { safeJson } from "@/lib/safe-response";
import { parseAgentInput } from "@/lib/ai/agent-config";

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
    });

    console.log(`[AI Agents API] Found ${agents.length} agent(s)`);

    return safeJson({
      success: true,
      agents,
      count: agents.length,
    });
  } catch (error) {
    console.error("[AI Agents API] Error fetching agents:", error);
    return safeJson(
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
    const { data, errors } = parseAgentInput(body, { partial: false });
    if (errors.length > 0) {
      return safeJson({ success: false, error: errors.join(". ") }, { status: 400 });
    }

    const agent = await prisma.aiAgent.create({ data: data as Prisma.AiAgentCreateInput });

    return safeJson({
      success: true,
      agent,
    });
  } catch (error) {
    console.error("[AI Agents API] Error creating agent:", error);
    return safeJson(
      {
        success: false,
        error: "Failed to create AI agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

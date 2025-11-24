import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

// POST /api/ai-agent - Process message with AI agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, userMessage, sessionId } = body;

    console.log("[AI Agent] Request:", agentId, userMessage);

    // Validation
    if (!agentId || !userMessage) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, userMessage" },
        { status: 400 }
      );
    }

    // Fetch AI agent
    const aiAgent = await prisma.aiAgent.findUnique({
      where: { id: agentId },
    });

    if (!aiAgent) {
      console.error(`[AI Agent] Agent not found: ${agentId}`);
      return NextResponse.json(
        { error: "AI agent not found" },
        { status: 404 }
      );
    }

    if (!aiAgent.isActive) {
      console.error(`[AI Agent] Agent is inactive: ${agentId}`);
      return NextResponse.json(
        { error: "AI agent is inactive" },
        { status: 400 }
      );
    }

    console.log(`[AI Agent] Using agent: ${aiAgent.name}`);
    console.log(`[AI Agent] System prompt: ${aiAgent.systemPrompt.substring(0, 100)}...`);

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    if (!process.env.OPENAI_API_KEY) {
      console.error("[AI Agent] OPENAI_API_KEY not configured");
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Get conversation history if sessionId provided
    let messages: any[] = [
      {
        role: "system",
        content: aiAgent.systemPrompt,
      },
    ];

    if (sessionId) {
      // TODO: Fetch conversation history from database
      console.log(`[AI Agent] Session: ${sessionId}`);
    }

    // Add user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    console.log(`[AI Agent] Sending ${messages.length} messages to OpenAI...`);

    // Call OpenAI ChatCompletion
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta.";

    console.log(`[AI Agent] Response: ${reply.substring(0, 100)}...`);

    return NextResponse.json({
      reply,
      agentId,
      agentName: aiAgent.name,
    });
  } catch (error) {
    console.error("[AI Agent] Error processing message:", error);
    return NextResponse.json(
      { error: "Failed to process AI agent message", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

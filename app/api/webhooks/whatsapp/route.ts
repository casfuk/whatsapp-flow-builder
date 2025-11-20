import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FlowEngine } from "@/lib/runtime-engine";
import { sendWhatsAppMessage } from "@/lib/whatsapp-sender";

// GET: Webhook verification (required by Meta)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Verify token should match env variable or a configured value
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "funnelchat_verify_token";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

// POST: Handle incoming messages
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WhatsApp Cloud API webhook structure
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ status: "no messages" });
    }

    const message = messages[0];
    const from = message.from; // Phone number
    const messageText = message.text?.body || "";
    const messageType = message.type;

    console.log(`Received message from ${from}: ${messageText}`);

    // Only process text messages for now
    if (messageType !== "text") {
      return NextResponse.json({ status: "ignored" });
    }

    // Find all active flows with matching triggers
    const activeFlows = await prisma.flow.findMany({
      where: {
        isActive: true,
      },
      include: {
        steps: true,
        connections: true,
      },
    });

    for (const flow of activeFlows) {
      // Find start node
      const startNode = flow.steps.find((s) => s.type === "start");
      if (!startNode) continue;

      const startConfig = JSON.parse(startNode.configJson);
      const trigger = startConfig.trigger;

      if (!trigger) continue;

      // Check if trigger matches
      let shouldTrigger = false;

      if (trigger.type === "message_received") {
        // Check keywords if specified
        if (trigger.keywords && trigger.keywords.length > 0) {
          const messageLower = messageText.toLowerCase();
          shouldTrigger = trigger.keywords.some((keyword: string) => {
            const keywordLower = keyword.toLowerCase();
            if (trigger.matchMode === "exact") {
              return messageLower === keywordLower;
            } else if (trigger.matchMode === "starts_with") {
              return messageLower.startsWith(keywordLower);
            } else {
              // contains (default)
              return messageLower.includes(keywordLower);
            }
          });
        } else {
          // No keywords = trigger on any message
          shouldTrigger = true;
        }
      }

      if (shouldTrigger) {
        console.log(`Triggering flow: ${flow.name} for contact: ${from}`);

        // Execute the flow
        await executeFlow(flow.id, from, messageText);
      }
    }

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Execute a flow for a contact
 */
async function executeFlow(flowId: string, phoneNumber: string, initialMessage: string) {
  try {
    // Generate or get session ID
    const sessionId = `${phoneNumber}-${flowId}-${Date.now()}`;

    // Create execution context
    const context = {
      sessionId,
      flowId,
      variables: {
        phone: phoneNumber,
        message: initialMessage,
      },
    };

    // Load flow
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!flow) {
      console.error("Flow not found:", flowId);
      return;
    }

    // Initialize engine
    const engine = new FlowEngine(
      context,
      flow.steps,
      flow.connections
    );

    // Execute flow from start
    const actions = await engine.start();

    // Process actions
    for (const action of actions) {
      if (action.type === "send_whatsapp") {
        await sendWhatsAppMessage({
          to: action.to,
          message: action.text,
        });
      }
    }
  } catch (error) {
    console.error("Flow execution error:", error);
  }
}

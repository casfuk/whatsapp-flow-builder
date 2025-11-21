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

    console.log("[Webhook] Received payload:", JSON.stringify(body, null, 2));

    // WhatsApp Cloud API webhook structure
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      console.log("[Webhook] No messages in payload");
      return NextResponse.json({ status: "no messages" });
    }

    const message = messages[0];
    const from = message.from; // Phone number
    const messageText = message.text?.body || "";
    const messageType = message.type;
    const messageId = message.id;
    const contactName = value.contacts?.[0]?.profile?.name || null;

    console.log(`[Webhook] Received ${messageType} message from ${from}: "${messageText}"`);

    // Save or update contact
    const contact = await prisma.contact.upsert({
      where: { phoneNumber: from },
      create: {
        phoneNumber: from,
        name: contactName,
        source: "whatsapp",
        metadata: JSON.stringify({
          lastMessageAt: new Date().toISOString(),
          lastMessageId: messageId,
        }),
      },
      update: {
        name: contactName || undefined,
        metadata: JSON.stringify({
          lastMessageAt: new Date().toISOString(),
          lastMessageId: messageId,
        }),
        updatedAt: new Date(),
      },
    });

    console.log(`[Webhook] Contact ${from} (${contact.name || 'unnamed'}) saved/updated`);

    // Only process text messages for now
    if (messageType !== "text") {
      console.log(`[Webhook] Ignoring non-text message type: ${messageType}`);
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

    console.log(`[Webhook] Found ${activeFlows.length} active flows`);

    let triggeredCount = 0;

    for (const flow of activeFlows) {
      // Find start node
      const startNode = flow.steps.find((s) => s.type === "start");
      if (!startNode) {
        console.log(`[Webhook] Flow "${flow.name}" has no start node, skipping`);
        continue;
      }

      const startConfig = JSON.parse(startNode.configJson);
      const trigger = startConfig.trigger;

      if (!trigger || trigger.type === "none") {
        console.log(`[Webhook] Flow "${flow.name}" has no trigger configured, skipping`);
        continue;
      }

      // Only process message_received triggers
      if (trigger.type !== "message_received") {
        continue;
      }

      console.log(`[Webhook] Checking flow "${flow.name}" with trigger:`, trigger);

      // Check if trigger matches
      let shouldTrigger = false;

      // Check deviceId if specified (optional matching)
      if (trigger.deviceId && trigger.deviceId !== null) {
        // TODO: Get the deviceId from the webhook payload or metadata
        // For now, we'll skip deviceId matching
        console.log(`[Webhook] Flow "${flow.name}" has deviceId filter: ${trigger.deviceId} (not validated yet)`);
      }

      // Check oncePerContact
      if (trigger.oncePerContact) {
        // Check if this contact has already triggered this flow
        const existingExecution = await prisma.sessionState.findFirst({
          where: {
            flowId: flow.id,
            sessionId: {
              startsWith: from,
            },
          },
        });

        if (existingExecution) {
          console.log(`[Webhook] Flow "${flow.name}" already triggered for contact ${from} (oncePerContact=true), skipping`);
          continue;
        }
      }

      // Check keyword matching
      if (trigger.matchMode === "all") {
        // Match all messages (no keyword filter)
        shouldTrigger = true;
        console.log(`[Webhook] Flow "${flow.name}" matches all messages`);
      } else if (trigger.keywords && trigger.keywords.length > 0) {
        const messageLower = messageText.toLowerCase().trim();

        shouldTrigger = trigger.keywords.some((keyword: string) => {
          const keywordLower = keyword.toLowerCase().trim();

          if (trigger.matchMode === "exact") {
            const matches = messageLower === keywordLower;
            if (matches) {
              console.log(`[Webhook] Flow "${flow.name}" keyword exact match: "${keyword}"`);
            }
            return matches;
          } else {
            // contains (default)
            const matches = messageLower.includes(keywordLower);
            if (matches) {
              console.log(`[Webhook] Flow "${flow.name}" keyword contains match: "${keyword}"`);
            }
            return matches;
          }
        });
      } else {
        // No keywords specified but matchMode is not "all" = no trigger
        console.log(`[Webhook] Flow "${flow.name}" has no keywords and matchMode is not "all", skipping`);
        shouldTrigger = false;
      }

      if (shouldTrigger) {
        console.log(`[Webhook] ✓ Triggering flow: "${flow.name}" (ID: ${flow.id}) for contact: ${from}`);
        triggeredCount++;

        // Execute the flow
        await executeFlow(flow.id, from, messageText, contact.id);
      }
    }

    console.log(`[Webhook] Triggered ${triggeredCount} flow(s) for message from ${from}`);

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Execute a flow for a contact
 */
async function executeFlow(flowId: string, phoneNumber: string, initialMessage: string, contactId: string) {
  try {
    // Generate session ID
    const sessionId = `${phoneNumber}-${flowId}-${Date.now()}`;

    console.log(`[Flow Execution] Starting flow "${flowId}" for contact ${phoneNumber} (session: ${sessionId})`);

    // Save the incoming message to message log
    await prisma.messageLog.create({
      data: {
        phone: phoneNumber,
        message: initialMessage,
        status: "received",
      },
    });

    console.log(`[Flow Execution] Incoming message logged`);

    // Create execution context
    const context = {
      sessionId,
      flowId,
      variables: {
        phone: phoneNumber,
        message: initialMessage,
        contactId,
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
      console.error(`[Flow Execution] Flow not found: ${flowId}`);
      return;
    }

    // Find the start node
    const startNode = flow.steps.find((s: any) => s.type === "start");
    if (!startNode) {
      console.error(`[Flow Execution] No start node found in flow "${flow.name}"`);
      return;
    }

    // Initialize engine
    const engine = new FlowEngine(flow, context.sessionId, context.variables);

    console.log(`[Flow Execution] Executing flow from start node...`);

    // Execute flow from start
    const actions = await engine.executeFromStep(startNode.id);

    console.log(`[Flow Execution] Flow execution complete. Generated ${actions.length} action(s)`);

    // Process actions
    for (const action of actions) {
      if (action.type === "send_whatsapp") {
        console.log(`[Flow Execution] Sending WhatsApp message to ${action.to}: "${action.text}"`);

        await sendWhatsAppMessage({
          to: action.to,
          message: action.text,
        });

        // Log the outgoing message
        await prisma.messageLog.create({
          data: {
            phone: action.to,
            message: action.text,
            status: "sent",
          },
        });

        console.log(`[Flow Execution] Message sent and logged`);
      } else if (action.type === "assign_conversation") {
        console.log(`[Flow Execution] Action: assign_conversation (assigneeId: ${action.assigneeId})`);
        // Assignment is already handled in the runtime engine
      } else {
        console.log(`[Flow Execution] Action: ${action.type}`, action);
      }
    }

    console.log(`[Flow Execution] ✓ Flow "${flow.name}" executed successfully for ${phoneNumber}`);
  } catch (error) {
    console.error(`[Flow Execution] Error executing flow:`, error);
  }
}

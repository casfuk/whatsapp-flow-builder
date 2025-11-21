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

    console.log(`[Webhook] ========================================`);
    console.log(`[Webhook] Received ${messageType} message from ${from}`);
    console.log(`[Webhook] Message text: "${messageText}"`);
    console.log(`[Webhook] Message text (trimmed, lowercase): "${messageText.toLowerCase().trim()}"`);
    console.log(`[Webhook] Contact name: ${contactName || 'N/A'}`);

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

    console.log(`[Webhook] Found ${activeFlows.length} active flow(s)`);

    // Count message_received triggers
    let messageReceivedCount = 0;
    for (const f of activeFlows) {
      const sn = f.steps.find((s) => s.type === "start");
      if (sn) {
        const cfg = JSON.parse(sn.configJson);
        if (cfg.trigger && cfg.trigger.type === "message_received") {
          messageReceivedCount++;
        }
      }
    }
    console.log(`[Webhook] Found ${messageReceivedCount} flow(s) with message_received trigger`);

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

      console.log(`[Webhook] ----------------------------------------`);
      console.log(`[Webhook] Checking flow: "${flow.name}" (ID: ${flow.id})`);
      console.log(`[Webhook] Trigger config:`, JSON.stringify(trigger, null, 2));

      // Check if trigger matches
      let shouldTrigger = false;

      // Check deviceId if specified (optional matching)
      if (trigger.deviceId && trigger.deviceId !== null && trigger.deviceId !== "") {
        console.log(`[Webhook] Flow has deviceId filter: "${trigger.deviceId}"`);
        // TODO: Get the deviceId from the webhook payload or metadata
        // For now, we'll skip deviceId matching and log a warning
        console.log(`[Webhook] WARNING: deviceId filtering not yet implemented, proceeding without device check`);
      } else {
        console.log(`[Webhook] No deviceId filter (will match all devices)`);
      }

      // Check oncePerContact
      if (trigger.oncePerContact) {
        console.log(`[Webhook] Checking oncePerContact filter...`);
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
          console.log(`[Webhook] ✗ Flow already triggered for contact ${from} (oncePerContact=true), SKIPPING`);
          continue;
        } else {
          console.log(`[Webhook] ✓ oncePerContact check passed (no prior execution)`);
        }
      } else {
        console.log(`[Webhook] oncePerContact=false (flow can trigger multiple times)`);
      }

      // Check keyword matching
      console.log(`[Webhook] Keyword matching check...`);
      console.log(`[Webhook] matchMode: "${trigger.matchMode}"`);
      console.log(`[Webhook] keywords:`, trigger.keywords);

      if (trigger.matchMode === "all") {
        // Match all messages (no keyword filter)
        shouldTrigger = true;
        console.log(`[Webhook] ✓ matchMode is "all" - WILL TRIGGER`);
      } else if (trigger.keywords && trigger.keywords.length > 0) {
        const messageLower = messageText.toLowerCase().trim();
        console.log(`[Webhook] Checking ${trigger.keywords.length} keyword(s) against: "${messageLower}"`);

        shouldTrigger = trigger.keywords.some((keyword: string, index: number) => {
          const keywordLower = keyword.toLowerCase().trim();
          console.log(`[Webhook]   Keyword ${index + 1}/${trigger.keywords.length}: "${keyword}" (normalized: "${keywordLower}")`);

          if (trigger.matchMode === "exact") {
            const matches = messageLower === keywordLower;
            console.log(`[Webhook]   Mode: exact | Message: "${messageLower}" | Keyword: "${keywordLower}" | Match: ${matches ? '✓ YES' : '✗ NO'}`);
            return matches;
          } else {
            // contains (default)
            const matches = messageLower.includes(keywordLower);
            console.log(`[Webhook]   Mode: contains | Message: "${messageLower}" | Keyword: "${keywordLower}" | Match: ${matches ? '✓ YES' : '✗ NO'}`);
            return matches;
          }
        });

        console.log(`[Webhook] Final keyword match result: ${shouldTrigger ? '✓ MATCHED' : '✗ NO MATCH'}`);
      } else {
        // No keywords specified but matchMode is not "all" = no trigger
        console.log(`[Webhook] ✗ No keywords specified and matchMode is not "all" - WILL NOT TRIGGER`);
        shouldTrigger = false;
      }

      // TEMPORARY DEBUG: Uncomment the line below to force trigger and isolate execution logic
      // shouldTrigger = true; // TEMP: force trigger for all message_received flows
      // if (shouldTrigger) console.log(`[Webhook] ⚠️ FORCED TRIGGER (temporary debug mode)`);

      console.log(`[Webhook] shouldTrigger = ${shouldTrigger}`);

      if (shouldTrigger) {
        console.log(`[Webhook] ✓✓✓ TRIGGERING FLOW: "${flow.name}" (ID: ${flow.id}) for contact: ${from}`);
        triggeredCount++;

        // Execute the flow
        await executeFlow(flow.id, from, messageText, contact.id);
      } else {
        console.log(`[Webhook] ✗ NOT triggering flow: "${flow.name}"`);
      }
    }

    console.log(`[Webhook] ========================================`);
    console.log(`[Webhook] SUMMARY: Triggered ${triggeredCount} flow(s) for message from ${from}`);
    console.log(`[Webhook] ========================================`);

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

    console.log(`[Flow Execution] ========================================`);
    console.log(`[Flow Execution] STARTING FLOW EXECUTION`);
    console.log(`[Flow Execution] Flow ID: ${flowId}`);
    console.log(`[Flow Execution] Contact: ${phoneNumber} (contactId: ${contactId})`);
    console.log(`[Flow Execution] Session ID: ${sessionId}`);
    console.log(`[Flow Execution] Initial message: "${initialMessage}"`);

    // Save the incoming message to message log
    await prisma.messageLog.create({
      data: {
        phone: phoneNumber,
        message: initialMessage,
        status: "received",
      },
    });

    console.log(`[Flow Execution] ✓ Incoming message logged to messageLog`);

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

    console.log(`[Flow Execution] ✓ FlowEngine initialized`);
    console.log(`[Flow Execution] Executing flow from start node ID: ${startNode.id}...`);

    // Execute flow from start
    const actions = await engine.executeFromStep(startNode.id);

    console.log(`[Flow Execution] ✓ Flow execution complete. Generated ${actions.length} action(s)`);

    // Process actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`[Flow Execution] Processing action ${i + 1}/${actions.length}: ${action.type}`);

      if (action.type === "send_whatsapp") {
        console.log(`[Flow Execution]   → Sending WhatsApp message to ${action.to}`);
        console.log(`[Flow Execution]   → Message text: "${action.text}"`);

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

        console.log(`[Flow Execution]   ✓ Message sent and logged to messageLog`);
      } else if (action.type === "assign_conversation") {
        console.log(`[Flow Execution]   → Assigning conversation to: ${action.assigneeId || 'NULL'}`);
        // Assignment is already handled in the runtime engine
        console.log(`[Flow Execution]   ✓ Assignment already handled by runtime engine`);
      } else {
        console.log(`[Flow Execution]   → Action type: ${action.type}`);
        console.log(`[Flow Execution]   → Details:`, action);
      }
    }

    console.log(`[Flow Execution] ========================================`);
    console.log(`[Flow Execution] ✓✓✓ Flow "${flow.name}" executed successfully for ${phoneNumber}`);
    console.log(`[Flow Execution] ========================================`);
  } catch (error) {
    console.error(`[Flow Execution] Error executing flow:`, error);
  }
}

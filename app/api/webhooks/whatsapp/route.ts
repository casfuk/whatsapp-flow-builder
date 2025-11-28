import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FlowEngine } from "@/lib/runtime-engine";
import { sendWhatsAppMessage, sendOwnerNotification, sendNewLeadNotification } from "@/lib/whatsapp-sender";
import { sendAndPersistMessage } from "@/lib/whatsapp-message-service";
import { normalizePhoneNumber } from "@/lib/phone-utils";

// ═══════════════════════════════════════════════════════════════════════════
// 🧠 HUMAN-LIKE DELAY SIMULATION
// ═══════════════════════════════════════════════════════════════════════════
// Simulates human typing/thinking time before sending AI messages
// Makes conversations feel natural and not robotic
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate random delay between 3-10 seconds to simulate human behavior
 * @returns delay in milliseconds (3000-10000ms)
 */
function getHumanDelay(): number {
  const minDelay = 3000; // 3 seconds
  const maxDelay = 10000; // 10 seconds
  return minDelay + Math.random() * (maxDelay - minDelay);
}

/**
 * Wait for a random human-like delay
 */
async function simulateHumanDelay(): Promise<void> {
  const delay = getHumanDelay();
  console.log(`[Human Delay] ⏱️ Waiting ${(delay / 1000).toFixed(1)}s to simulate human typing...`);
  await new Promise(resolve => setTimeout(resolve, delay));
  console.log(`[Human Delay] ✅ Delay complete, sending message now`);
}

// GET: Webhook verification (required by Meta)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Verify token should match env variable or a configured value
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || "funnelchat_verify_token";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

// POST: Handle incoming messages
export async function POST(request: NextRequest) {
  console.log("[Webhook] *** NEW REQUEST TO /api/webhooks/whatsapp ***");

  // Check required environment variables
  if (!process.env.WHATSAPP_CLOUD_API_TOKEN) {
    console.error("[Webhook] CRITICAL: WHATSAPP_CLOUD_API_TOKEN is not set!");
    return NextResponse.json(
      { error: "WhatsApp API token not configured" },
      { status: 500 }
    );
  }
  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error("[Webhook] CRITICAL: WHATSAPP_PHONE_NUMBER_ID is not set!");
    return NextResponse.json(
      { error: "WhatsApp phone number ID not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    console.log("[Webhook] Raw body:", JSON.stringify(body, null, 2));

    // WhatsApp Cloud API webhook structure
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    // Handle status updates (read receipts, delivery confirmations, etc.)
    if (value?.statuses) {
      console.log("[Webhook] 📋 Status update received:", JSON.stringify(value.statuses, null, 2));
      return NextResponse.json({ ok: true });
    }

    // If no messages, this is some other type of webhook
    if (!messages || messages.length === 0) {
      console.log("[Webhook] ⚠️ Unknown payload without messages or statuses");
      return NextResponse.json({ ok: true });
    }

    const message = messages[0];
    const from = normalizePhoneNumber(message.from); // Phone number (normalized)
    const messageType = message.type;
    const messageId = message.id;
    const contactName = value.contacts?.[0]?.profile?.name || null;

    // Handle both text and interactive (button/list) messages
    let normalizedText: string | null = null;

    if (messageType === "text" && message.text?.body) {
      normalizedText = message.text.body;
    } else if (messageType === "interactive" && message.interactive) {
      if (message.interactive.type === "button_reply" && message.interactive.button_reply) {
        // Use ID for routing logic (flow engine needs this to match connections)
        // Title is stored in metadata for display purposes only
        normalizedText = message.interactive.button_reply.id;
        console.log(`[Webhook] Button clicked - ID: ${message.interactive.button_reply.id}, Title: ${message.interactive.button_reply.title}`);
      } else if (message.interactive.type === "list_reply" && message.interactive.list_reply) {
        // Use ID for routing logic
        normalizedText = message.interactive.list_reply.id;
        console.log(`[Webhook] List item selected - ID: ${message.interactive.list_reply.id}, Title: ${message.interactive.list_reply.title}`);
      }
    }

    if (!normalizedText) {
      console.log(`[Webhook] Unsupported message type: ${messageType}`);
      return NextResponse.json({ status: "unsupported type" });
    }

    const messageText = normalizedText; // ID for engine, title in metadata for UI

    // ═══════════════════════════════════════════════════════════════════════════
    // 🛡️ EMPTY MESSAGE VALIDATION: Ignore stickers, emojis, empty text
    // ═══════════════════════════════════════════════════════════════════════════
    // Prevents AI from responding to:
    // - Stickers, images, voice notes (already filtered by type above)
    // - Empty text messages
    // - Messages with only whitespace
    // - Single emoji reactions without text
    // ═══════════════════════════════════════════════════════════════════════════

    if (!messageText || messageText.trim() === "") {
      console.log("[Webhook] 🛡️ EMPTY MESSAGE: Ignoring empty/whitespace-only message");
      console.log("[Webhook] This prevents AI from responding to stickers, empty taps, etc.");
      return NextResponse.json({ status: "ignored (empty message)" });
    }

    console.log(`[Webhook] ========================================`);
    console.log(`[Webhook] Received ${messageType} message from ${from}`);
    console.log(`[Webhook] Incoming text: "${messageText}"`);
    console.log(`[Webhook] Message text (trimmed, lowercase): "${messageText.toLowerCase().trim()}"`);
    console.log(`[Webhook] Contact name: ${contactName || 'N/A'}`);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🛡️ LOOP PREVENTION: Ignore our own notification messages
    // ═══════════════════════════════════════════════════════════════════════════
    // Check if this is one of our own notification messages to prevent loops
    const isOurNotification =
      messageText?.startsWith("📩 Nueva conversación en FunnelChat") ||
      messageText?.startsWith("📩 Nuevo Handover de AI Agent") ||
      messageText?.startsWith("📩 Nuevo Handover de ClaudIA") ||
      messageText?.startsWith("📩 Nuevo Handover de MarIA");

    if (isOurNotification) {
      console.log("[Webhook] 🛡️ LOOP PREVENTION: This is our own notification message - IGNORING");
      console.log("[Webhook] Message starts with:", messageText.substring(0, 50));
      return NextResponse.json({ status: "ignored (our own notification)" });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔧 HIDDEN RESET COMMAND: Clear AI agent memory and restart conversation
    // ═══════════════════════════════════════════════════════════════════════════
    // Secret commands for testing/debugging (only you know these)
    const resetCommands = [
      "claudia reset",
      "reset chat",
      "borrar memoria",
      "restart ai",
      "maria reset",
      "reset claudia",
      "reset maria"
    ];

    const messageTextLower = messageText.toLowerCase().trim();
    const isResetCommand = resetCommands.some(cmd => messageTextLower === cmd);

    if (isResetCommand) {
      console.log("[Webhook] 🔧 RESET COMMAND DETECTED:", messageText);
      console.log("[Webhook] Clearing all conversation memory for:", from);

      try {
        // Find the chat for this contact
        const chat = await prisma.chat.findFirst({
          where: {
            phoneNumber: from,
          },
          select: { id: true },
        });

        if (chat) {
          // Delete all messages in this chat
          const deletedCount = await prisma.message.deleteMany({
            where: { chatId: chat.id },
          });

          console.log(`[Webhook] ✅ Deleted ${deletedCount.count} message(s) from chat ${chat.id}`);

          // Reset chat metadata
          await prisma.chat.update({
            where: { id: chat.id },
            data: {
              unreadCount: 0,
              lastMessagePreview: "Conversación reiniciada",
              lastMessageAt: new Date(),
            },
          });

          console.log("[Webhook] ✅ Chat metadata reset");

          // Delete any active session states
          const deletedSessions = await prisma.sessionState.deleteMany({
            where: {
              sessionId: {
                startsWith: from,
              },
            },
          });

          console.log(`[Webhook] ✅ Deleted ${deletedSessions.count} active session(s)`);

          // Send confirmation message
          await sendWhatsAppMessage({
            to: from,
            message: "Hecho 😊 Empezamos desde cero. ¿En qué puedo ayudarte?",
            type: "text",
          });

          console.log("[Webhook] ✅ Reset confirmation sent");
          console.log("[Webhook] 🔧 Memory cleared successfully for:", from);
        } else {
          console.log("[Webhook] ⚠️ No chat found for:", from);
          await sendWhatsAppMessage({
            to: from,
            message: "No hay conversación que borrar 😊",
            type: "text",
          });
        }

        return NextResponse.json({ status: "reset successful" });
      } catch (resetError) {
        console.error("[Webhook] ❌ Error during reset:", resetError);
        await sendWhatsAppMessage({
          to: from,
          message: "Error al reiniciar. Intenta de nuevo.",
          type: "text",
        });
        return NextResponse.json({ status: "reset failed" });
      }
    }

    // Extract profile picture URL if available
    const profilePicUrl = value.contacts?.[0]?.profile?.picture;

    // Get device ID from the webhook payload (WhatsApp Phone Number ID) - BEFORE contact
    const devicePhoneNumberId = value.metadata?.phone_number_id;

    // Find device by whatsappPhoneNumberId
    let device = null;
    if (devicePhoneNumberId) {
      device = await prisma.device.findFirst({
        where: { whatsappPhoneNumberId: devicePhoneNumberId },
      });
    }

    // If no device found, use the first connected device as fallback
    if (!device) {
      device = await prisma.device.findFirst({
        where: { isConnected: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const deviceId = device?.id || null;
    console.log(`[Webhook] Device for this webhook: ${deviceId || 'none'}`);

    // Save or update contact (using composite unique key: phone + deviceId)
    const contact = await prisma.contact.upsert({
      where: {
        phone_device: {
          phone: from,
          deviceId: deviceId || "",
        },
      },
      create: {
        phone: from,
        deviceId: deviceId,
        name: contactName,
        profileImageUrl: profilePicUrl || null,
        source: "whatsapp",
        metadata: JSON.stringify({
          lastMessageAt: new Date().toISOString(),
          lastMessageId: messageId,
        }),
      },
      update: {
        name: contactName || undefined,
        profileImageUrl: profilePicUrl || undefined,
        metadata: JSON.stringify({
          lastMessageAt: new Date().toISOString(),
          lastMessageId: messageId,
        }),
        updatedAt: new Date(),
      },
    });

    console.log(`[Webhook] Contact for this event: ${contact.id}, phone: ${contact.phone}, deviceId: ${contact.deviceId}, name: ${contact.name || 'unnamed'}`);


    // Save message to Chat system if device exists
    if (device) {
      console.log(`[Webhook] Saving message to Chat system (deviceId: ${device.id})`);

      try {
        // Find or create chat for this contact + device
        const chat = await prisma.chat.upsert({
          where: {
            phoneNumber_deviceId: {
              phoneNumber: from,
              deviceId: device.id,
            },
          },
          create: {
            phoneNumber: from,
            contactName: contactName,
            deviceId: device.id,
            lastMessagePreview: messageText,
            lastMessageAt: new Date(),
            unreadCount: 1,
            status: "open",
          },
          update: {
            contactName: contactName || undefined,
            lastMessagePreview: messageText,
            lastMessageAt: new Date(),
            unreadCount: {
              increment: 1,
            },
          },
        });

        console.log(`[Webhook] Chat upserted: ${chat.id}`);

        // Build metadata for the message
        const messageMetadata: any = {
          messageType: messageType,
          timestamp: new Date().toISOString(),
        };

        // Store additional context for interactive messages
        if (messageType === "interactive" && message.interactive) {
          if (message.interactive.type === "button_reply" && message.interactive.button_reply) {
            messageMetadata.interactiveType = "button_reply";
            messageMetadata.buttonId = message.interactive.button_reply.id;
            messageMetadata.buttonTitle = message.interactive.button_reply.title;
          } else if (message.interactive.type === "list_reply" && message.interactive.list_reply) {
            messageMetadata.interactiveType = "list_reply";
            messageMetadata.listItemId = message.interactive.list_reply.id;
            messageMetadata.listItemTitle = message.interactive.list_reply.title;
            messageMetadata.listItemDescription = message.interactive.list_reply.description;
          }
        }

        // Save the message
        await prisma.message.create({
          data: {
            chatId: chat.id,
            sender: "contact",
            text: messageText,
            status: "delivered",
            messageId: messageId,
            metadata: JSON.stringify(messageMetadata),
          },
        });

        console.log(`[Webhook] Message saved to database with metadata:`, messageMetadata);

        // ═══════════════════════════════════════════════════════════════════════════
        // ℹ️ NOTE: Owner/Lead notifications are now sent when FLOWS START
        // ═══════════════════════════════════════════════════════════════════════════
        // We no longer check "first message only" - notifications are sent every time
        // a flow is triggered (see sendNewLeadNotification below in flow execution).
        // This ensures David gets notified for ALL flow starts, not just first messages.
        // ═══════════════════════════════════════════════════════════════════════════

        // Check if this chat is assigned to an AI agent
        if (chat.assignedAgentType === "AI" && chat.assignedAgentId) {
          console.log(`[AI Agent] ========================================`);
          console.log(`[AI Agent] 🤖 Chat assigned to AI Agent: ${chat.assignedAgentId}`);
          console.log(`[AI Agent] 💬 Incoming user message: "${messageText}"`);

          try {
            // Load AI agent config
            const aiAgent = await prisma.aiAgent.findUnique({
              where: { id: chat.assignedAgentId },
            });

            if (!aiAgent) {
              console.error(`[AI Agent] ❌ ERROR: AI agent ${chat.assignedAgentId} not found in database`);
            } else {
              console.log(`[AI Agent] ✅ Using AI agent: ${aiAgent.name}`);
              console.log(`[AI Agent] 📋 Agent config - Language: ${aiAgent.language}, Tone: ${aiAgent.tone}`);
              console.log(`[AI Agent] 🎯 Agent goal: ${aiAgent.goal || "N/A"}`);

              // Call AI endpoint with the user's message
              console.log(`[AI Agent] 🔄 Calling /api/ai-agent endpoint...`);

              const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai-agent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agentId: aiAgent.id,
                  userMessage: messageText,
                  sessionId: chat.id,
                }),
              });

              console.log(`[AI Agent] 📡 AI API response status: ${aiResponse.status}`);

              if (!aiResponse.ok) {
                const errorText = await aiResponse.text();
                console.error(`[AI Agent] ❌ AI API error response:`, errorText);
                throw new Error(`AI API returned ${aiResponse.status}: ${errorText}`);
              }

              const aiData = await aiResponse.json();
              const aiMessage = aiData.reply || "Lo siento, no puedo responder en este momento.";

              console.log(`[AI Agent] 💡 AI generated response (${aiMessage.length} chars): "${aiMessage.substring(0, 100)}..."`);

              // ═══════════════════════════════════════════════════════════════════
              // 📨 SPLIT AI RESPONSE INTO MULTIPLE WHATSAPP MESSAGES BY PARAGRAPHS
              // ═══════════════════════════════════════════════════════════════════
              // Split by blank lines (one or more newlines) to create separate bubbles
              const messageParts = aiMessage
                .split(/\n{2,}/)           // Split by 2+ newlines (blank lines)
                .map((part: string) => part.trim())
                .filter(Boolean);          // Remove empty parts

              console.log(`[AI Agent] 📩 Split message into ${messageParts.length} part(s)`);

              // 🧠 SIMULATE HUMAN DELAY BEFORE SENDING (3-10 seconds)
              // This makes the conversation feel natural and not robotic
              await simulateHumanDelay();

              // Send each part as a separate WhatsApp message, in order
              for (let i = 0; i < messageParts.length; i++) {
                const part = messageParts[i];
                console.log(`[AI Agent] 📤 Sending part ${i + 1}/${messageParts.length} (${part.length} chars): "${part.substring(0, 50)}..."`);

                await sendAndPersistMessage({
                  deviceId: device.id,
                  toPhoneNumber: from,
                  type: "text",
                  payload: { text: { body: part } },
                  sender: "agent",
                  textPreview: part,
                  chatId: chat.id,
                });

                console.log(`[AI Agent] ✅ Part ${i + 1}/${messageParts.length} sent successfully`);

                // Small delay between messages to maintain order (50ms)
                if (i < messageParts.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
              }

              console.log(`[AI Agent] ✅ All ${messageParts.length} message part(s) sent successfully to ${from}`);
              console.log(`[AI Agent] ========================================`);
            }
          } catch (aiError: any) {
            console.error(`[AI Agent ERROR] ❌ Failed to generate/send AI response:`, aiError);
            console.error(`[AI Agent ERROR] Error message:`, aiError.message);
            console.error(`[AI Agent ERROR] Stack:`, aiError.stack);
          }
        }
      } catch (chatError) {
        console.error(`[Webhook] Error saving to Chat system:`, chatError);
      }
    }

    // Check if this is a reply to an existing session (button click)
    console.log(`[Webhook] Checking for existing session for phone: ${from}`);
    const existingSession = await prisma.sessionState.findFirst({
      where: {
        sessionId: {
          startsWith: from,
        },
        status: "active",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`[Webhook] Session query result: ${existingSession ? `Found (ID: ${existingSession.sessionId}, currentStepId: ${existingSession.currentStepId})` : 'Not found'}`);

    if (existingSession && existingSession.currentStepId) {
      console.log(`[Webhook] ✓ Found existing session: ${existingSession.sessionId}`);
      console.log(`[Webhook] ✓ Current step: ${existingSession.currentStepId}`);
      console.log(`[Webhook] ✓ User replied with: "${messageText}"`);

      // Check if message is a trigger keyword - if so, treat as new flow start, not reply
      const isTriggerKeyword = await checkIfTriggerKeyword(messageText);
      if (isTriggerKeyword) {
        console.log(`[Webhook] Message "${messageText}" is a trigger keyword - marking session as completed and starting new flow`);
        await prisma.sessionState.update({
          where: { sessionId: existingSession.sessionId },
          data: { status: "completed" },
        });
        // Fall through to flow trigger logic below
      } else {
        // Check if this session is assigned to an AI agent
      if (existingSession.assigneeType === "ai" && existingSession.assigneeId) {
        console.log(`[Webhook] Session assigned to AI agent: ${existingSession.assigneeId}`);

        try {
          // Call AI agent API endpoint
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai-agent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              agentId: existingSession.assigneeId,
              userMessage: messageText,
              sessionId: existingSession.sessionId,
            }),
          });

          if (!response.ok) {
            console.error(`[Webhook] AI agent API error: ${response.status}`);
            throw new Error(`AI agent API returned ${response.status}`);
          }

          const data = await response.json();
          const aiReply = data.reply;

          console.log(`[Webhook] AI agent response (${aiReply.length} chars): ${aiReply.substring(0, 100)}...`);

          // ═══════════════════════════════════════════════════════════════════
          // 📨 SPLIT AI RESPONSE INTO MULTIPLE WHATSAPP MESSAGES BY PARAGRAPHS
          // ═══════════════════════════════════════════════════════════════════
          const messageParts = aiReply
            .split(/\n{2,}/)           // Split by 2+ newlines (blank lines)
            .map((part: string) => part.trim())
            .filter(Boolean);          // Remove empty parts

          console.log(`[Webhook] 📩 Split message into ${messageParts.length} part(s)`);

          // 🧠 SIMULATE HUMAN DELAY BEFORE SENDING (3-10 seconds)
          await simulateHumanDelay();

          // Send each part as a separate WhatsApp message, in order
          for (let i = 0; i < messageParts.length; i++) {
            const part = messageParts[i];
            console.log(`[Webhook] 📤 Sending part ${i + 1}/${messageParts.length}: "${part.substring(0, 50)}..."`);

            await sendWhatsAppMessage({
              to: from,
              message: part,
            });

            // Log each message part
            await prisma.messageLog.create({
              data: {
                phone: from,
                message: part,
                status: "sent",
              },
            });

            console.log(`[Webhook] ✅ Part ${i + 1}/${messageParts.length} sent`);

            // Small delay between messages to maintain order (50ms)
            if (i < messageParts.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }

          console.log(`[Webhook] ✓ All ${messageParts.length} message part(s) sent from ${data.agentName}`);

          return NextResponse.json({ status: "ai agent replied" });
        } catch (err) {
          console.error(`[Webhook] Error processing AI agent message:`, err);
          return NextResponse.json({ status: "ai agent error" });
        }
      }

      // Load the flow
      const flow = await prisma.flow.findUnique({
        where: { id: existingSession.flowId },
        include: {
          steps: true,
          connections: true,
        },
      });

      if (!flow) {
        console.error(`[Webhook] Flow not found: ${existingSession.flowId}`);
        return NextResponse.json({ status: "flow not found" });
      }

        // Continue the flow from the current step
        await continueFlow(existingSession, flow, from, messageText, contact.id, deviceId);

        return NextResponse.json({ status: "session continued" });
      }
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

      console.log(`[Webhook] shouldTrigger: ${shouldTrigger}`);

      if (shouldTrigger) {
        console.log(`[Webhook] ✓✓✓ TRIGGERING FLOW: "${flow.name}" (ID: ${flow.id}) for contact: ${from}`);
        console.log(`[Webhook] ➜ Calling executeFlow with flowId=${flow.id}, phone=${from}, contactId=${contact.id}, deviceId=${deviceId}`);
        triggeredCount++;

        // 🚨 IMMEDIATE NOTIFICATION: New lead entering flow
        console.log(`[Webhook] 📤 Sending new lead notification to admin...`);
        sendNewLeadNotification({
          flowName: flow.name,
          phoneNumber: from,
          name: contactName,
          email: null, // Will be populated from custom fields if available
          source: "whatsapp",
        }).catch((err) => {
          console.error("[Webhook] ⚠️ Failed to send new lead notification:", err);
          // Don't fail the webhook if notification fails
        });

        // Execute the flow
        await executeFlow(flow.id, from, messageText, contact.id, deviceId);

        console.log(`[Webhook] ✓ Flow executed for flow ${flow.id}`);
      } else {
        console.log(`[Webhook] ✗ NOT triggering flow: "${flow.name}"`);
      }
    }

    console.log(`[Webhook] ========================================`);
    console.log(`[Webhook] SUMMARY: Triggered ${triggeredCount} flow(s) for message from ${from}`);
    console.log(`[Webhook] ========================================`);

    // 🤖 CHECK IF FLOW ASSIGNED CHAT TO AI AGENT (after flow execution)
    console.log(`[Webhook] 🔍 Checking if chat was assigned to AI agent by flow...`);

    if (device) {
      try {
        // Reload chat to get latest assignment (flow might have assigned it to AI)
        const chatAfterFlow = await prisma.chat.findFirst({
          where: {
            phoneNumber: from,
            deviceId: device.id,
          },
          select: {
            id: true,
            assignedAgentType: true,
            assignedAgentId: true,
          },
          orderBy: { createdAt: "desc" },
        });

        if (!chatAfterFlow) {
          console.log(`[AI Agent Post-Flow] ⚠️ No chat found after flow execution`);
        } else if (chatAfterFlow.assignedAgentType === "AI" && chatAfterFlow.assignedAgentId) {
          console.log(`[AI Agent Post-Flow] ========================================`);
          console.log(`[AI Agent Post-Flow] 🎯 FLOW ASSIGNED CHAT TO AI AGENT!`);
          console.log(`[AI Agent Post-Flow] 🤖 Agent ID: ${chatAfterFlow.assignedAgentId}`);
          console.log(`[AI Agent Post-Flow] 💬 User message: "${messageText}"`);

          try {
            // Load AI agent
            const aiAgent = await prisma.aiAgent.findUnique({
              where: { id: chatAfterFlow.assignedAgentId },
            });

            if (!aiAgent) {
              console.error(`[AI Agent Post-Flow] ❌ AI agent not found: ${chatAfterFlow.assignedAgentId}`);
            } else {
              console.log(`[AI Agent Post-Flow] ✅ Found AI agent: ${aiAgent.name}`);

              // Note: The initial greeting should have been sent by the flow execution
              // This block is for handling the case where user sent the trigger message
              // We only need to respond if this is a new message AFTER assignment

              // Count messages to see if this is the first user message after assignment
              const messageCount = await prisma.message.count({
                where: { chatId: chatAfterFlow.id },
              });

              console.log(`[AI Agent Post-Flow] 📊 Total messages in chat: ${messageCount}`);

              if (messageCount === 1) {
                // This is the first message (the trigger), initial greeting was already sent by flow
                console.log(`[AI Agent Post-Flow] ℹ️ This is the trigger message - initial greeting already sent by flow`);
              } else {
                // This is a follow-up message, should not happen immediately but handle it
                console.log(`[AI Agent Post-Flow] 🔄 User sent another message - will be handled by the ongoing conversation logic`);
              }
            }
          } catch (aiError: any) {
            console.error(`[AI Agent Post-Flow] ❌ Error checking AI agent:`, aiError.message);
          }

          console.log(`[AI Agent Post-Flow] ========================================`);
        } else {
          console.log(`[AI Agent Post-Flow] ℹ️ Chat is not assigned to AI agent (Type: ${chatAfterFlow.assignedAgentType || "none"})`);
        }
      } catch (chatError) {
        console.error(`[AI Agent Post-Flow] ❌ Error loading chat after flow:`, chatError);
      }
    }

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("[Webhook] Unhandled error in POST handler:", error);
    // IMPORTANT: Always return 200 to WhatsApp to acknowledge receipt
    return NextResponse.json({ status: "error", message: "Internal error handled" }, { status: 200 });
  }
}

/**
 * Execute a flow for a contact
 */
async function executeFlow(flowId: string, phoneNumber: string, initialMessage: string, contactId: string, deviceId: string | null) {
  try {
    // Generate session ID
    const sessionId = `${phoneNumber}-${flowId}-${Date.now()}`;

    console.log(`[Flow Execution] ========================================`);
    console.log(`[Flow Execution] STARTING FLOW EXECUTION`);
    console.log(`[Flow Execution] Flow ID: ${flowId}`);
    console.log(`[Flow Execution] Contact: ${phoneNumber} (contactId: ${contactId})`);
    console.log(`[Flow Execution] Device ID: ${deviceId || 'none'}`);
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

    // Create or update Chat record BEFORE flow execution (needed for AI agent assignment)
    console.log(`[Flow Execution] Creating/updating Chat for contact...`);
    const normalizedText = initialMessage;
    const chat = await prisma.chat.upsert({
      where: {
        phoneNumber_deviceId: {
          phoneNumber,
          deviceId: deviceId || "",
        },
      },
      create: {
        phoneNumber,
        contactName: phoneNumber, // We'll update this from Contact if available
        deviceId: deviceId || "",
        lastMessagePreview: normalizedText,
        lastMessageAt: new Date(),
        status: "open",
        unreadCount: 1,
      },
      update: {
        lastMessagePreview: normalizedText,
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
        updatedAt: new Date(),
      },
      select: {
        id: true,
        assignedAgentType: true,
        assignedAgentId: true,
      },
    });
    console.log(`[Flow Execution] ✓ Chat created/updated: ${chat.id}`);
    console.log(`[Flow Execution] Chat assignedAgentType: ${chat.assignedAgentType}, assignedAgentId: ${chat.assignedAgentId}`);

    // Initialize engine with chatId
    const engine = new FlowEngine(flow, context.sessionId, context.variables, chat.id);

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
        console.log(`[Flow Execution]   → send_whatsapp action`);
        console.log(`[Flow Execution]   → To: ${action.to}`);
        console.log(`[Flow Execution]   → Text: "${action.text}"`);

        try {
          if (!deviceId) {
            console.error(`[Flow Execution]   ✗ No deviceId available, cannot persist message`);
            throw new Error("No deviceId available");
          }

          await sendAndPersistMessage({
            deviceId,
            toPhoneNumber: action.to,
            type: "text",
            payload: { text: { body: action.text } },
            sender: "flow",
            textPreview: action.text,
          });

          // Also log to messageLog for backwards compatibility
          await prisma.messageLog.create({
            data: {
              phone: action.to,
              message: action.text,
              status: "sent",
            },
          });

          console.log(`[Flow Execution]   ✓ Message sent and persisted`);
        } catch (err) {
          console.error(`[Flow Execution]   ✗ Exception while sending WhatsApp message:`, err);
        }
      } else if (action.type === "send_whatsapp_interactive") {
        console.log(`[Flow Execution]   → send_whatsapp_interactive action`);
        console.log(`[Flow Execution]   → To: ${action.to}`);
        console.log(`[Flow Execution]   → Interactive type: ${action.interactive?.type}`);

        try {
          if (!deviceId) {
            console.error(`[Flow Execution]   ✗ No deviceId available, cannot persist message`);
            throw new Error("No deviceId available");
          }

          const messageText = action.interactive?.body?.text || "Interactive message";

          await sendAndPersistMessage({
            deviceId,
            toPhoneNumber: action.to,
            type: "interactive",
            payload: { interactive: action.interactive },
            sender: "flow",
            textPreview: messageText,
          });

          // Also log to messageLog for backwards compatibility
          await prisma.messageLog.create({
            data: {
              phone: action.to,
              message: messageText,
              status: "sent",
            },
          });

          console.log(`[Flow Execution]   ✓ Interactive message sent and persisted`);
        } catch (err) {
          console.error(`[Flow Execution]   ✗ Exception while sending interactive message:`, err);
        }
      } else if (action.type === "send_whatsapp_media") {
        console.log(`[Flow Execution]   → send_whatsapp_media action`);
        const { to, mediaId, mediaUrl, mediaType, caption, fileName } = action.data || {};

        console.log(`[Flow Execution]   → Media details:`, {
          to,
          mediaId: mediaId || 'none',
          mediaUrl: mediaUrl || 'none',
          mediaType,
          caption: caption || 'none',
          fileName: fileName || 'none',
        });

        // Guard against blob URLs (browser-only URLs that WhatsApp Cloud API cannot access)
        if (mediaUrl && mediaUrl.startsWith("blob:")) {
          console.error("[send_whatsapp_media] ❌ REJECTED: blob: URL detected! WhatsApp Cloud API cannot access blob URLs.", {
            mediaUrl,
            to,
            mediaType,
          });
          console.error("[send_whatsapp_media] ❌ This is a browser-only URL. Use mediaUrl (public HTTP/HTTPS URL) instead of fileUrl.");
          continue;
        }

        // Guard against missing data
        const hasMediaId = mediaId && mediaId !== "";
        const hasMediaUrl = mediaUrl && mediaUrl !== "" && !mediaUrl.startsWith("blob:");

        if (!to || !mediaType || (!hasMediaId && !hasMediaUrl) || !deviceId) {
          console.error("[send_whatsapp_media] Missing required data", {
            to,
            mediaId,
            mediaUrl,
            mediaType,
            deviceId,
            hasMediaId,
            hasMediaUrl,
          });
          continue;
        }

        console.log(`[Flow Execution]   → Using: ${hasMediaId ? `Media ID: ${mediaId}` : `Media URL: ${mediaUrl}`}`);

        try {
          // Build payload based on media type
          let payload: any = {};
          const actualType = mediaType === "media" ? "image" : mediaType;

          if (actualType === "image") {
            const imagePayload: any = {};
            if (hasMediaId) imagePayload.id = mediaId;
            else if (hasMediaUrl) imagePayload.link = mediaUrl;
            if (caption) imagePayload.caption = caption;
            payload.image = imagePayload;
          } else if (actualType === "audio") {
            const audioPayload: any = {};
            if (hasMediaId) audioPayload.id = mediaId;
            else if (hasMediaUrl) audioPayload.link = mediaUrl;
            payload.audio = audioPayload;
          } else if (actualType === "document") {
            const documentPayload: any = {};
            if (hasMediaId) documentPayload.id = mediaId;
            else if (hasMediaUrl) documentPayload.link = mediaUrl;
            if (caption) documentPayload.caption = caption;
            if (fileName) documentPayload.filename = fileName;
            payload.document = documentPayload;
          }

          await sendAndPersistMessage({
            deviceId,
            toPhoneNumber: to,
            type: actualType as any,
            payload,
            sender: "flow",
            textPreview: caption || `[${actualType}]`,
          });

          // Also log to messageLog for backwards compatibility
          await prisma.messageLog.create({
            data: {
              phone: to,
              message: `[${mediaType}] ${caption || "Media"}`,
              status: "sent",
            },
          });

          console.log(`[Flow Execution]   ✓ Media sent and persisted`);
        } catch (err: any) {
          console.error("[WA] Exception sending media message", {
            payload: { to, mediaId, mediaUrl, mediaType },
            message: err.message,
            error: err,
          });
        }
      } else if (action.type === "assign_conversation") {
        console.log(`[Flow Execution]   → Assigning conversation to: ${action.assigneeId || 'NULL'}`);
        console.log(`[Flow Execution]   → Assignment type: ${action.assigneeType || 'human'}`);

        // Check if this is an AI agent assignment
        if (action.assigneeType === "ai" && action.assigneeId) {
          console.log(`[Flow Execution]   → AI agent assignment - generating reply...`);

          try {
            // Call AI agent API endpoint
            const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai-agent`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                agentId: action.assigneeId,
                userMessage: initialMessage,
                sessionId: sessionId,
              }),
            });

            if (!response.ok) {
              console.error(`[Flow Execution]   ✗ AI agent API error: ${response.status}`);
              throw new Error(`AI agent API returned ${response.status}`);
            }

            const data = await response.json();
            const aiReply = data.reply;

            console.log(`[Flow Execution]   → AI agent response (${aiReply.length} chars): ${aiReply.substring(0, 100)}...`);

            // ═══════════════════════════════════════════════════════════════════
            // 📨 SPLIT AI RESPONSE INTO MULTIPLE WHATSAPP MESSAGES BY PARAGRAPHS
            // ═══════════════════════════════════════════════════════════════════
            const messageParts = aiReply
              .split(/\n{2,}/)           // Split by 2+ newlines (blank lines)
              .map((part: string) => part.trim())
              .filter(Boolean);          // Remove empty parts

            console.log(`[Flow Execution]   → Split into ${messageParts.length} part(s)`);

            // 🧠 SIMULATE HUMAN DELAY BEFORE SENDING (3-10 seconds)
            await simulateHumanDelay();

            // Send each part as a separate WhatsApp message, in order
            for (let i = 0; i < messageParts.length; i++) {
              const part = messageParts[i];
              console.log(`[Flow Execution]   → Sending part ${i + 1}/${messageParts.length}`);

              const success = await sendWhatsAppMessage({
                to: phoneNumber,
                message: part,
              });

              await prisma.messageLog.create({
                data: {
                  phone: phoneNumber,
                  message: part,
                  status: success ? "sent" : "failed",
                },
              });

              // Small delay between messages
              if (i < messageParts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }

            console.log(`[Flow Execution]   ✓ All ${messageParts.length} AI agent message part(s) sent from ${data.agentName}`);
          } catch (err) {
            console.error(`[Flow Execution]   ✗ Exception while generating AI reply:`, err);
          }
        }

        // Assignment is already handled in the runtime engine
        console.log(`[Flow Execution]   ✓ Assignment handled by runtime engine`);
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

/**
 * Continue an existing flow session with user's reply
 */
async function continueFlow(session: any, flow: any, phoneNumber: string, userReply: string, contactId: string, deviceId: string | null) {
  try {
    console.log(`[Flow Continue] ========================================`);
    console.log(`[Flow Continue] CONTINUING FLOW SESSION`);
    console.log(`[Flow Continue] Session ID: ${session.sessionId}`);
    console.log(`[Flow Continue] Current step: ${session.currentStepId}`);
    console.log(`[Flow Continue] Device ID: ${deviceId || 'none'}`);
    console.log(`[Flow Continue] User reply: "${userReply}"`);
    const currentStep = flow.steps.find((s: any) => s.id === session.currentStepId);

    if (!currentStep) {
      console.error(`[Flow Continue] Current step not found: ${session.currentStepId}`);
      return;
    }

    console.log(`[Flow Continue] Current step type: ${currentStep.type}`);

    // Find the next step based on user's reply
    let nextStepId: string | null = null;

    if (currentStep.type === "question_multiple" || currentStep.type === "question_simple" || currentStep.type === "multipleChoice") {
      // For question nodes, find the connection that matches the reply
      const outgoingConnections = flow.connections.filter(
        (c: any) => c.fromStepId === currentStep.id
      );

      console.log(`[Flow Continue] Found ${outgoingConnections.length} outgoing connection(s)`);

      if (outgoingConnections.length > 0) {
        const normalizedReply = userReply.toLowerCase().trim();

        // For multipleChoice, try to match numeric replies (1, 2, 3) to option index
        if (currentStep.type === "multipleChoice") {
          const currentConfig = JSON.parse(currentStep.configJson);
          const options = currentConfig.options || [];

          console.log(`[Flow Continue] multipleChoice with ${options.length} options`);

          // Check if reply is a number (1, 2, 3, etc.)
          const replyNumber = parseInt(normalizedReply, 10);
          if (!isNaN(replyNumber) && replyNumber >= 1 && replyNumber <= options.length) {
            const selectedOption = options[replyNumber - 1];
            console.log(`[Flow Continue] User selected option ${replyNumber}: ${selectedOption.id}`);

            // Find connection with matching sourceHandle
            const matchedConn = outgoingConnections.find(
              (c: any) => c.sourceHandle === selectedOption.id
            );

            if (matchedConn) {
              nextStepId = matchedConn.toStepId;
              console.log(`[Flow Continue] ✓ Matched option ${replyNumber} (ID: ${selectedOption.id}) to connection`);
            }
          } else {
            console.log(`[Flow Continue] Reply "${userReply}" is not a valid numeric option (1-${options.length})`);
          }
        }

        // If still no match, try matching with connection labels or handles (for other question types)
        if (!nextStepId) {
          for (const conn of outgoingConnections) {
            const sourceHandle = conn.sourceHandle?.toLowerCase().trim();
            const conditionLabel = conn.conditionLabel?.toLowerCase().trim();

            console.log(`[Flow Continue] Checking connection - handle: "${sourceHandle}", label: "${conditionLabel}"`);

            if (sourceHandle && normalizedReply.includes(sourceHandle)) {
              nextStepId = conn.toStepId;
              console.log(`[Flow Continue] ✓ Matched source handle "${sourceHandle}"`);
              break;
            } else if (conditionLabel && normalizedReply.includes(conditionLabel)) {
              nextStepId = conn.toStepId;
              console.log(`[Flow Continue] ✓ Matched condition label "${conditionLabel}"`);
              break;
            }
          }
        }

        // If no match, DO NOT auto-select - user must reply with valid option
        if (!nextStepId) {
          console.log(`[Flow Continue] No match found - user must select a valid option`);
          // Optionally send error message
          await sendWhatsAppMessage({
            to: phoneNumber,
            message: "Por favor, selecciona una opción válida.",
          });
          return; // Stop here, don't continue to invalid path
        }
      }
    } else {
      // For other step types, just take the next connection
      const nextConnection = flow.connections.find(
        (c: any) => c.fromStepId === currentStep.id
      );
      if (nextConnection) {
        nextStepId = nextConnection.toStepId;
      }
    }

    if (!nextStepId) {
      console.log(`[Flow Continue] No next step found, ending flow`);
      await prisma.sessionState.update({
        where: { sessionId: session.sessionId },
        data: { status: "completed" },
      });
      return;
    }

    console.log(`[Flow Continue] Next step ID: ${nextStepId}`);

    // Load variables from session
    const variables = JSON.parse(session.variablesJson || "{}");
    variables.phone = phoneNumber;
    variables.lastReply = userReply;
    variables.contactId = contactId;

    // Initialize engine and continue execution
    const engine = new FlowEngine(flow, session.sessionId, variables);
    const actions = await engine.executeFromStep(nextStepId);

    console.log(`[Flow Continue] ✓ Generated ${actions.length} action(s)`);

    // Process actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`[Flow Continue] Processing action ${i + 1}/${actions.length}: ${action.type}`);

      try {
        if (action.type === "send_whatsapp") {
          console.log(`[Flow Continue]   → Sending message to ${action.to}`);
          console.log(`[Flow Continue]   → Text: "${action.text}"`);

          try {
            if (!deviceId) {
              console.error(`[Flow Continue]   ✗ No deviceId available, cannot persist message`);
              throw new Error("No deviceId available");
            }

            await sendAndPersistMessage({
              deviceId,
              toPhoneNumber: action.to,
              type: "text",
              payload: { text: { body: action.text } },
              sender: "flow",
              textPreview: action.text,
            });

            await prisma.messageLog.create({
              data: {
                phone: action.to,
                message: action.text,
                status: "sent",
              },
            });

            console.log(`[Flow Continue]   ✓ Message sent and persisted`);
          } catch (err) {
            console.error(`[Flow Continue]   ✗ Exception sending text:`, err);
          }
        } else if (action.type === "send_whatsapp_interactive") {
          console.log(`[Flow Continue]   → Sending interactive message to ${action.to}`);
          console.log(`[Flow Continue]   → Interactive type: ${action.interactive?.type}`);

          try {
            if (!deviceId) {
              console.error(`[Flow Continue]   ✗ No deviceId available, cannot persist message`);
              throw new Error("No deviceId available");
            }

            const messageText = action.interactive?.body?.text || "Interactive message";

            await sendAndPersistMessage({
              deviceId,
              toPhoneNumber: action.to,
              type: "interactive",
              payload: { interactive: action.interactive },
              sender: "flow",
              textPreview: messageText,
            });

            await prisma.messageLog.create({
              data: {
                phone: action.to,
                message: messageText,
                status: "sent",
              },
            });

            console.log(`[Flow Continue]   ✓ Interactive sent and persisted`);
          } catch (err) {
            console.error(`[Flow Continue]   ✗ Exception sending interactive:`, err);
          }
        } else if (action.type === "send_whatsapp_media") {
          console.log(`[Flow Continue]   → Sending media message`);
          const { to, mediaId, mediaUrl, mediaType, caption, fileName } = action.data || {};

          console.log(`[Flow Continue]   → Media details:`, {
            to,
            mediaId: mediaId || 'none',
            mediaUrl: mediaUrl || 'none',
            mediaType,
            caption: caption || 'none',
            fileName: fileName || 'none',
          });

          // Guard against blob URLs (browser-only URLs that WhatsApp Cloud API cannot access)
          if (mediaUrl && mediaUrl.startsWith("blob:")) {
            console.error("[Flow Continue] ❌ REJECTED: blob: URL detected! WhatsApp Cloud API cannot access blob URLs.", {
              mediaUrl,
              to,
              mediaType,
            });
            console.error("[Flow Continue] ❌ This is a browser-only URL. Use mediaUrl (public HTTP/HTTPS URL) instead of fileUrl.");
            continue;
          }

          // Guard against missing data
          const hasMediaId = mediaId && mediaId !== "";
          const hasMediaUrl = mediaUrl && mediaUrl !== "" && !mediaUrl.startsWith("blob:");

          if (!to || !mediaType || (!hasMediaId && !hasMediaUrl) || !deviceId) {
            console.error("[send_whatsapp_media] Missing required data", {
              to,
              mediaId,
              mediaUrl,
              mediaType,
              deviceId,
              hasMediaId,
              hasMediaUrl,
            });
            continue;
          }

          console.log(`[Flow Continue]   → Using: ${hasMediaId ? `Media ID: ${mediaId}` : `Media URL: ${mediaUrl}`}`);

          try {
            // Build payload based on media type
            let payload: any = {};
            const actualType = mediaType === "media" ? "image" : mediaType;

            if (actualType === "image") {
              const imagePayload: any = {};
              if (hasMediaId) imagePayload.id = mediaId;
              else if (hasMediaUrl) imagePayload.link = mediaUrl;
              if (caption) imagePayload.caption = caption;
              payload.image = imagePayload;
            } else if (actualType === "audio") {
              const audioPayload: any = {};
              if (hasMediaId) audioPayload.id = mediaId;
              else if (hasMediaUrl) audioPayload.link = mediaUrl;
              payload.audio = audioPayload;
            } else if (actualType === "document") {
              const documentPayload: any = {};
              if (hasMediaId) documentPayload.id = mediaId;
              else if (hasMediaUrl) documentPayload.link = mediaUrl;
              if (caption) documentPayload.caption = caption;
              if (fileName) documentPayload.filename = fileName;
              payload.document = documentPayload;
            }

            await sendAndPersistMessage({
              deviceId,
              toPhoneNumber: to,
              type: actualType as any,
              payload,
              sender: "flow",
              textPreview: caption || `[${actualType}]`,
            });

            // Also log to messageLog for backwards compatibility
            await prisma.messageLog.create({
              data: {
                phone: to,
                message: `[${mediaType}] ${caption || "Media"}`,
                status: "sent",
              },
            });

            console.log(`[Flow Continue]   ✓ Media sent and persisted`);
          } catch (err: any) {
            console.error("[WA] Exception sending media message", {
              payload: { to, mediaId, mediaUrl, mediaType },
              message: err.message,
              error: err,
            });
          }
        } else {
          console.log(`[Flow Continue]   → Action type: ${action.type} (no handler)`);
        }
      } catch (actionError) {
        console.error(`[Flow Continue]   ✗ Action processing error:`, actionError);
        // Continue with next action even if this one fails
      }
    }

    console.log(`[Flow Continue] ========================================`);
    console.log(`[Flow Continue] ✓✓✓ Flow continued successfully for ${phoneNumber}`);
    console.log(`[Flow Continue] ========================================`);
  } catch (error) {
    console.error(`[Flow Continue] Error:`, error);
  }
}

/**
 * Check if a message is a trigger keyword for any active flow
 */
async function checkIfTriggerKeyword(messageText: string): Promise<boolean> {
  try {
    const activeFlows = await prisma.flow.findMany({
      where: { isActive: true },
      include: { steps: true },
    });

    const messageLower = messageText.toLowerCase().trim();

    for (const flow of activeFlows) {
      const startNode = flow.steps.find((s) => s.type === "start");
      if (!startNode) continue;

      const startConfig = JSON.parse(startNode.configJson);
      const trigger = startConfig.trigger;

      if (!trigger || trigger.type !== "message_received") continue;

      // Check if matches "all"
      if (trigger.matchMode === "all") {
        return true;
      }

      // Check if matches any keyword
      if (trigger.keywords && trigger.keywords.length > 0) {
        const matches = trigger.keywords.some((keyword: string) => {
          const keywordLower = keyword.toLowerCase().trim();
          if (trigger.matchMode === "exact") {
            return messageLower === keywordLower;
          } else {
            return messageLower.includes(keywordLower);
          }
        });
        if (matches) return true;
      }
    }

    return false;
  } catch (error) {
    console.error("[Webhook] Error checking trigger keyword:", error);
    return false;
  }
}

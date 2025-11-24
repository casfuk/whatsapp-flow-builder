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

  try {
    const body = await request.json();

    console.log("[Webhook] Raw body:", JSON.stringify(body, null, 2));

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
    const messageType = message.type;
    const messageId = message.id;
    const contactName = value.contacts?.[0]?.profile?.name || null;

    // Handle both text and interactive (button/list) messages
    let normalizedText: string | null = null;

    if (messageType === "text" && message.text?.body) {
      normalizedText = message.text.body;
    } else if (messageType === "interactive" && message.interactive) {
      if (message.interactive.type === "button_reply" && message.interactive.button_reply) {
        normalizedText = message.interactive.button_reply.id || message.interactive.button_reply.title;
        console.log(`[Webhook] Button clicked - ID: ${message.interactive.button_reply.id}, Title: ${message.interactive.button_reply.title}`);
      } else if (message.interactive.type === "list_reply" && message.interactive.list_reply) {
        normalizedText = message.interactive.list_reply.id || message.interactive.list_reply.title;
        console.log(`[Webhook] List item selected - ID: ${message.interactive.list_reply.id}, Title: ${message.interactive.list_reply.title}`);
      }
    }

    if (!normalizedText) {
      console.log(`[Webhook] Unsupported message type: ${messageType}`);
      return NextResponse.json({ status: "unsupported type" });
    }

    const messageText = normalizedText;

    console.log(`[Webhook] ========================================`);
    console.log(`[Webhook] Received ${messageType} message from ${from}`);
    console.log(`[Webhook] Incoming text: "${messageText}"`);
    console.log(`[Webhook] Message text (trimmed, lowercase): "${messageText.toLowerCase().trim()}"`);
    console.log(`[Webhook] Contact name: ${contactName || 'N/A'}`);

    // Extract profile picture URL if available
    const profilePicUrl = value.contacts?.[0]?.profile?.picture;

    // Save or update contact
    const contact = await prisma.contact.upsert({
      where: { phone: from },
      create: {
        phone: from,
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

    console.log(`[Webhook] Contact for this event: ${contact.id}, phone: ${contact.phone}, name: ${contact.name || 'unnamed'}`);

    // Get device ID from the webhook payload (WhatsApp Phone Number ID)
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

        // Save the message
        await prisma.message.create({
          data: {
            chatId: chat.id,
            sender: "contact",
            text: messageText,
            status: "delivered",
            messageId: messageId,
          },
        });

        console.log(`[Webhook] Message saved to database`);
      } catch (chatError) {
        console.error(`[Webhook] Error saving to Chat system:`, chatError);
      }
    }

    // Check if this is a reply to an existing session (button click)
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

    if (existingSession && existingSession.currentStepId) {
      console.log(`[Webhook] Found existing session: ${existingSession.sessionId}`);
      console.log(`[Webhook] Current step: ${existingSession.currentStepId}`);
      console.log(`[Webhook] User replied with: "${messageText}"`);

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
      await continueFlow(existingSession, flow, from, messageText, contact.id);

      return NextResponse.json({ status: "session continued" });
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
        console.log(`[Webhook] ➜ Calling executeFlow with flowId=${flow.id}, phone=${from}, contactId=${contact.id}`);
        triggeredCount++;

        // Execute the flow
        await executeFlow(flow.id, from, messageText, contact.id);

        console.log(`[Webhook] ✓ Flow executed for flow ${flow.id}`);
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
        console.log(`[Flow Execution]   → send_whatsapp action`);
        console.log(`[Flow Execution]   → To: ${action.to}`);
        console.log(`[Flow Execution]   → Text: "${action.text}"`);

        try {
          const success = await sendWhatsAppMessage({
            to: action.to,
            message: action.text,
          });

          if (!success) {
            console.error(`[Flow Execution]   ✗ Failed to send message (sendWhatsAppMessage returned false)`);
          }

          // Log the outgoing message
          await prisma.messageLog.create({
            data: {
              phone: action.to,
              message: action.text,
              status: success ? "sent" : "failed",
            },
          });

          console.log(`[Flow Execution]   ✓ Message logged to messageLog (status: ${success ? 'sent' : 'failed'})`);
        } catch (err) {
          console.error(`[Flow Execution]   ✗ Exception while sending WhatsApp message:`, err);
        }
      } else if (action.type === "send_whatsapp_interactive") {
        console.log(`[Flow Execution]   → send_whatsapp_interactive action`);
        console.log(`[Flow Execution]   → To: ${action.to}`);
        console.log(`[Flow Execution]   → Interactive type: ${action.interactive?.type}`);

        try {
          const success = await sendWhatsAppMessage({
            to: action.to,
            type: "interactive",
            interactive: action.interactive,
          });

          if (!success) {
            console.error(`[Flow Execution]   ✗ Failed to send interactive message`);
          }

          // Log the outgoing message
          const messageText = action.interactive?.body?.text || "Interactive message";
          await prisma.messageLog.create({
            data: {
              phone: action.to,
              message: messageText,
              status: success ? "sent" : "failed",
            },
          });

          console.log(`[Flow Execution]   ✓ Interactive message logged (status: ${success ? 'sent' : 'failed'})`);
        } catch (err) {
          console.error(`[Flow Execution]   ✗ Exception while sending interactive message:`, err);
        }
      } else if (action.type === "send_whatsapp_media") {
        console.log(`[Flow Execution]   → send_whatsapp_media action`);
        console.log(`[Flow Execution]   → To: ${action.to}`);
        console.log(`[Flow Execution]   → Media type: ${action.mediaType}`);

        try {
          const success = await sendWhatsAppMessage({
            to: action.to,
            type: action.mediaType as any,
            image: action.image,
            document: action.document,
            video: action.video,
            audio: action.audio,
          });

          if (!success) {
            console.error(`[Flow Execution]   ✗ Failed to send media message`);
          }

          // Log the outgoing message
          const caption = action.image?.caption || action.document?.caption || action.video?.caption || "Media message";
          await prisma.messageLog.create({
            data: {
              phone: action.to,
              message: `[${action.mediaType}] ${caption}`,
              status: success ? "sent" : "failed",
            },
          });

          console.log(`[Flow Execution]   ✓ Media message logged (status: ${success ? 'sent' : 'failed'})`);
        } catch (err) {
          console.error(`[Flow Execution]   ✗ Exception while sending media message:`, err);
        }
      } else if (action.type === "assign_conversation") {
        console.log(`[Flow Execution]   → Assigning conversation to: ${action.assigneeId || 'NULL'}`);
        console.log(`[Flow Execution]   → Assignment type: ${action.assigneeType || 'human'}`);

        // Check if this is an AI agent assignment
        if (action.assigneeType === "ai" && action.assigneeId) {
          console.log(`[Flow Execution]   → AI agent assignment - generating reply...`);

          try {
            // Fetch AI agent details
            const aiAgent = await prisma.aiAgent.findUnique({
              where: { id: action.assigneeId },
            });

            if (!aiAgent) {
              console.error(`[Flow Execution]   ✗ AI agent not found: ${action.assigneeId}`);
            } else {
              console.log(`[Flow Execution]   → AI agent: ${aiAgent.name}`);

              // For now, send a simple greeting from the AI agent
              // TODO: Integrate with actual AI agent API endpoint
              const aiReply = `Hola! Soy ${aiAgent.name}, tu agente de IA. ¿En qué puedo ayudarte?`;

              const success = await sendWhatsAppMessage({
                to: phoneNumber,
                message: aiReply,
              });

              await prisma.messageLog.create({
                data: {
                  phone: phoneNumber,
                  message: aiReply,
                  status: success ? "sent" : "failed",
                },
              });

              console.log(`[Flow Execution]   ✓ AI agent reply sent from ${aiAgent.name}`);
            }
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
async function continueFlow(session: any, flow: any, phoneNumber: string, userReply: string, contactId: string) {
  try {
    console.log(`[Flow Continue] ========================================`);
    console.log(`[Flow Continue] CONTINUING FLOW SESSION`);
    console.log(`[Flow Continue] Session ID: ${session.sessionId}`);
    console.log(`[Flow Continue] Current step: ${session.currentStepId}`);
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

        // If no match, take the first connection
        if (!nextStepId && outgoingConnections.length > 0) {
          nextStepId = outgoingConnections[0].toStepId;
          console.log(`[Flow Continue] No match found, taking first connection`);
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

      if (action.type === "send_whatsapp") {
        console.log(`[Flow Continue]   → Sending message to ${action.to}`);
        console.log(`[Flow Continue]   → Text: "${action.text}"`);

        try {
          const success = await sendWhatsAppMessage({
            to: action.to,
            message: action.text,
          });

          await prisma.messageLog.create({
            data: {
              phone: action.to,
              message: action.text,
              status: success ? "sent" : "failed",
            },
          });

          console.log(`[Flow Continue]   ✓ Message ${success ? 'sent' : 'failed'}`);
        } catch (err) {
          console.error(`[Flow Continue]   ✗ Exception:`, err);
        }
      }
    }

    console.log(`[Flow Continue] ========================================`);
    console.log(`[Flow Continue] ✓✓✓ Flow continued successfully for ${phoneNumber}`);
    console.log(`[Flow Continue] ========================================`);
  } catch (error) {
    console.error(`[Flow Continue] Error:`, error);
  }
}

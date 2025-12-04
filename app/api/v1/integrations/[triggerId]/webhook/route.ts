import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FlowEngine } from "@/lib/runtime-engine";
import { sendAndPersistMessage } from "@/lib/whatsapp-message-service";
import { normalizePhoneNumber } from "@/lib/phone-utils";

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Webhook endpoint for third-party integrations (Facebook Leads, etc.)
 *
 * POST /api/v1/integrations/[triggerId]/webhook
 *
 * Receives webhook payloads from external services (e.g., Facebook Lead Ads),
 * creates/updates contacts, and triggers the associated flow.
 *
 * Supports both JSON and URL-encoded form data.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  const { triggerId } = await params;
  console.log("[Third-Party Webhook] *** NEW REQUEST ***");
  console.log(`[Third-Party Webhook] Trigger ID: ${triggerId}`);

  try {
    // 1. Look up the trigger
    const trigger = await prisma.thirdPartyTrigger.findUnique({
      where: { id: triggerId },
      include: {
        flow: {
          include: {
            steps: true,
            connections: true,
          },
        },
        device: true,
      },
    });

    if (!trigger) {
      console.error(`[Third-Party Webhook] Trigger not found: ${triggerId}`);
      return NextResponse.json(
        { error: "Trigger not found" },
        {
          status: 404,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(`[Third-Party Webhook] Trigger found: ${trigger.id}`);
    console.log(`[Third-Party Webhook] Flow: ${trigger.flow.name} (${trigger.flowId})`);
    console.log(`[Third-Party Webhook] Device: ${trigger.device.name} (${trigger.deviceId})`);

    // 2. Read webhook payload with flexible parsing (JSON or URL-encoded)
    const contentType = request.headers.get('content-type') || '';
    let payload: any = {};

    console.log(`[Third-Party Webhook] Content-Type: ${contentType}`);

    if (contentType.includes('application/json')) {
      console.log(`[Third-Party Webhook] Parsing as JSON...`);
      payload = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      console.log(`[Third-Party Webhook] Parsing as URL-encoded form data...`);
      const text = await request.text();
      const params = new URLSearchParams(text);
      payload = Object.fromEntries(params.entries());
    } else {
      console.log(`[Third-Party Webhook] Unknown content-type, attempting JSON fallback...`);
      // Fallback: try json, but don't crash hard
      try {
        payload = await request.json();
      } catch {
        console.warn(`[Third-Party Webhook] Failed to parse payload, using empty object`);
        payload = {};
      }
    }

    console.log(`[Third-Party Webhook] Normalized payload:`, JSON.stringify(payload, null, 2));
    console.log(`[Third-Party Webhook] Payload keys:`, Object.keys(payload));

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔍 FIELD MAPPING FOR FLOW BUILDER
    // ═══════════════════════════════════════════════════════════════════════════
    // Extract field mapping from payload - Flow Builder REQUIRES this format
    console.log(`[FIELD_MAPPING] ========================================`);
    console.log(`[FIELD_MAPPING] Payload received:`, payload);
    console.log(`[FIELD_MAPPING] Extracting fields from payload keys...`);

    const fields = Object.keys(payload).map((key) => ({
      key,
      type: "string" // Flow Builder expects all types as "string"
    }));

    console.log(`[FIELD_MAPPING] Fields extracted:`, fields);
    console.log(`[FIELD_MAPPING] Total fields found: ${fields.length}`);
    console.log(`[FIELD_MAPPING] Will return fields to Flow Builder in response`);
    console.log(`[FIELD_MAPPING] ========================================`);

    // ═══════════════════════════════════════════════════════════════════════════
    // 💾 SAVE PAYLOAD SAMPLE IMMEDIATELY (BEFORE VALIDATION)
    // ═══════════════════════════════════════════════════════════════════════════
    // This MUST happen before any validation errors (missing phone, etc.)
    // so that Flow Builder can always see the latest payload keys
    // (Elementor, Facebook, or any other source)
    console.log(`[Third-Party Webhook] ========================================`);
    console.log(`[Third-Party Webhook] Saving lastPayloadSample for trigger ${triggerId}...`);
    console.log(`[Third-Party Webhook] Payload keys being saved:`, Object.keys(payload));

    try {
      await prisma.thirdPartyTrigger.update({
        where: { id: trigger.id },
        data: {
          lastReceivedAt: new Date(),
          lastPayloadPreview: JSON.stringify(payload).substring(0, 500),
          lastPayloadSample: payload,
        },
      });
      console.log(`[Third-Party Webhook] ✅ lastPayloadSample saved successfully`);
      console.log(`[Third-Party Webhook] Flow Builder will now show these ${Object.keys(payload).length} fields in mapping UI`);
    } catch (updateError) {
      console.error(`[Third-Party Webhook] ❌ Failed to save lastPayloadSample:`, updateError);
      // Don't fail the whole request if we can't save the sample
    }
    console.log(`[Third-Party Webhook] ========================================`);

    // 3. Extract contact data from payload using field mapping
    let fullName = null;
    let phoneNumber = null;
    let email = null;
    const customFieldsData: Record<string, any> = {};

    // Parse field mappings
    let fieldMappings: any[] = [];
    try {
      fieldMappings = JSON.parse(trigger.fieldMapping);
    } catch (error) {
      console.error(`[Third-Party Webhook] Error parsing fieldMapping:`, error);
    }

    console.log(`[Third-Party Webhook] Field mappings:`, fieldMappings);

    if (fieldMappings && fieldMappings.length > 0) {
      // Use configured field mappings
      for (const mapping of fieldMappings) {
        const value = payload[mapping.sourceKey];
        if (value !== undefined && value !== null) {
          if (mapping.targetType === "standard") {
            if (mapping.targetKey === "name") fullName = value;
            else if (mapping.targetKey === "phone") phoneNumber = value;
            else if (mapping.targetKey === "email") email = value;
          } else if (mapping.targetType === "custom") {
            customFieldsData[mapping.targetKey] = value;
          }
        }
      }
    } else {
      // Fallback to default field names
      fullName = payload.full_name || payload.name || payload.fullName || null;
      phoneNumber = payload.phone_number || payload.phone || payload.phoneNumber || null;
      email = payload.email || null;
    }

    console.log(`[Third-Party Webhook] Extracted data:`, {
      fullName,
      phoneNumber,
      email,
      customFields: customFieldsData,
    });

    // Validate required fields
    if (!phoneNumber) {
      console.error(`[Third-Party Webhook] Missing phone number in payload`);
      console.log(`[FIELD_MAPPING] Returning fields even though validation failed`);
      console.log(`[FIELD_MAPPING] Flow Builder will still see ${fields.length} fields from this payload`);

      return NextResponse.json(
        {
          error: "Missing phone_number in payload (no mapping configured or field not found)",
          fields, // Include fields so Flow Builder can see them even when validation fails
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Normalize phone number for consistent storage
    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    console.log(`[Third-Party Webhook] Phone normalized: ${phoneNumber} -> ${normalizedPhone}`);

    // 4. Create or update contact
    const createMetadata = {
      triggerId: trigger.id,
      triggerType: trigger.type,
      receivedAt: new Date().toISOString(),
      originalPayload: payload,
      customFields: customFieldsData,
    };

    const updateMetadata = {
      triggerId: trigger.id,
      triggerType: trigger.type,
      lastReceivedAt: new Date().toISOString(),
      lastPayload: payload,
      customFields: customFieldsData,
    };

    const contact = await prisma.contact.upsert({
      where: {
        phone_device: {
          phone: normalizedPhone,
          deviceId: trigger.deviceId,
        },
      },
      create: {
        phone: normalizedPhone,
        name: fullName,
        email: email,
        deviceId: trigger.deviceId,
        source: "third_party_webhook",
        metadata: JSON.stringify(createMetadata),
      },
      update: {
        name: fullName || undefined,
        email: email || undefined,
        metadata: JSON.stringify(updateMetadata),
        updatedAt: new Date(),
      },
    });

    console.log(`[Third-Party Webhook] Contact upserted: ${contact.id}`);
    console.log(`[Third-Party Webhook] Contact phone: ${contact.phone}, name: ${contact.name || "N/A"}`);

    // 4.5. Create or update Chat record (needed for AI agent assignment)
    console.log(`[Third-Party Webhook] Creating/updating Chat for contact...`);
    const normalizedText = `New ${trigger.type} lead`;
    const chat = await prisma.chat.upsert({
      where: {
        phoneNumber_deviceId: {
          phoneNumber: contact.phone,
          deviceId: trigger.deviceId,
        },
      },
      create: {
        phoneNumber: contact.phone,
        contactName: contact.name || fullName || "Lead",
        deviceId: trigger.deviceId,
        lastMessagePreview: normalizedText,
        lastMessageAt: new Date(),
        status: "open",
        unreadCount: 1,
      },
      update: {
        contactName: contact.name || fullName || undefined,
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
    console.log(`[Third-Party Webhook] ✓ Chat created/updated: ${chat.id}`);
    console.log(`[Third-Party Webhook] Chat assignedAgentType: ${chat.assignedAgentType}, assignedAgentId: ${chat.assignedAgentId}`);

    // Note: lastPayloadSample was already saved immediately after payload parsing
    // (before validation) so that Flow Builder always has the latest field keys
    // even if validation fails (e.g., missing phone number)

    // 6. Check if runOncePerContact is enabled and contact already triggered
    if (trigger.runOncePerContact) {
      console.log(`[Third-Party Webhook] Checking runOncePerContact...`);
      const existingExecution = await prisma.thirdPartyTriggerExecution.findUnique({
        where: {
          triggerId_contactId: {
            triggerId: trigger.id,
            contactId: contact.id,
          },
        },
      });

      if (existingExecution) {
        console.log(`[Third-Party Webhook] ⚠ Contact already triggered this flow (runOncePerContact enabled)`);
        console.log(`[Third-Party Webhook] Previous execution: ${existingExecution.createdAt}`);

        console.log(`[FIELD_MAPPING] Returning fields to Flow Builder (skipped response)...`);
        console.log(`[FIELD_MAPPING] Response will include ${fields.length} fields`);

        return NextResponse.json(
          {
            ok: true,
            skipped: true,
            reason: "runOncePerContact_already_triggered",
            contactId: contact.id,
            previouslyTriggeredAt: existingExecution.createdAt,
            fields, // Required for Flow Builder to detect field mapping
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json",
            },
          }
        );
      }
    }

    // 7. Start the flow for this contact
    console.log(`[Third-Party Webhook] ========================================`);
    console.log(`[Third-Party Webhook] 🚀 STARTING FLOW EXECUTION`);
    console.log(`[Third-Party Webhook] Flow ID: ${trigger.flowId}`);
    console.log(`[Third-Party Webhook] Device ID: ${trigger.deviceId}`);
    console.log(`[Third-Party Webhook] Contact ID: ${contact.id}`);
    console.log(`[Third-Party Webhook] Phone: ${contact.phone}`);
    console.log(`[Third-Party Webhook] Contact Name: ${contact.name || "Lead"}`);
    console.log(`[Third-Party Webhook] Flow is active: ${trigger.flow.isActive}`);
    console.log(`[Third-Party Webhook] ========================================`);

    await executeFlowForContact({
      flowId: trigger.flowId,
      deviceId: trigger.deviceId,
      contactId: contact.id,
      phoneNumber: contact.phone,
      contactName: contact.name || "Lead",
      initialMessage: `New ${trigger.type} lead`,
      chatId: chat.id,
    });

    console.log(`[Third-Party Webhook] ✓ Flow executed successfully`);

    // 8. Create execution record if runOncePerContact is enabled
    if (trigger.runOncePerContact) {
      try {
        await prisma.thirdPartyTriggerExecution.create({
          data: {
            triggerId: trigger.id,
            contactId: contact.id,
          },
        });
        console.log(`[Third-Party Webhook] ✓ Created execution record for runOncePerContact`);
      } catch (error) {
        console.error(`[Third-Party Webhook] Error creating execution record:`, error);
        // Don't fail the whole request if we can't create the execution record
      }
    }

    console.log(`[FIELD_MAPPING] Returning fields to Flow Builder (success response)...`);
    console.log(`[FIELD_MAPPING] Response will include ${fields.length} fields`);
    console.log(`[FIELD_MAPPING] Final response format:`, {
      ok: true,
      contactId: contact.id,
      flowId: trigger.flowId,
      fields: fields,
    });

    return NextResponse.json(
      {
        ok: true,
        contactId: contact.id,
        flowId: trigger.flowId,
        fields, // Required for Flow Builder to detect field mapping
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error(`[Third-Party Webhook] Error:`, error);
    return NextResponse.json(
      {
        error: "Internal error",
        message: error.message || "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/**
 * Execute a flow for a contact (reused from WhatsApp webhook logic)
 */
async function executeFlowForContact({
  flowId,
  deviceId,
  contactId,
  phoneNumber,
  contactName,
  initialMessage,
  chatId,
}: {
  flowId: string;
  deviceId: string;
  contactId: string;
  phoneNumber: string;
  contactName: string;
  initialMessage: string;
  chatId: string;
}) {
  try {
    // Generate session ID
    const sessionId = `${phoneNumber}-${flowId}-${Date.now()}`;

    console.log(`[Flow Execution] ========================================`);
    console.log(`[Flow Execution] STARTING FLOW EXECUTION (Third-Party Trigger)`);
    console.log(`[Flow Execution] Flow ID: ${flowId}`);
    console.log(`[Flow Execution] Contact: ${phoneNumber} (${contactName})`);
    console.log(`[Flow Execution] Contact ID: ${contactId}`);
    console.log(`[Flow Execution] Device ID: ${deviceId}`);
    console.log(`[Flow Execution] Session ID: ${sessionId}`);

    // Create execution context with contact variables
    const context = {
      sessionId,
      flowId,
      variables: {
        phone: phoneNumber,
        name: contactName,
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

    // Increment flow execution counter
    await prisma.flow.update({
      where: { id: flow.id },
      data: {
        executions: {
          increment: 1,
        },
      },
    });
    console.log(`[Flow Execution] ✓ Flow execution counter incremented`);

    // Find the start node
    const startNode = flow.steps.find((s: any) => s.type === "start");
    if (!startNode) {
      console.error(`[Flow Execution] No start node found in flow "${flow.name}"`);
      return;
    }

    // Initialize engine with chatId
    const engine = new FlowEngine(flow, context.sessionId, context.variables, chatId);

    console.log(`[Flow Execution] ✓ FlowEngine initialized`);
    console.log(`[Flow Execution] Executing flow from start node ID: ${startNode.id}...`);

    // Execute flow from start
    const actions = await engine.executeFromStep(startNode.id);

    console.log(`[Flow Execution] ✓ Flow execution complete. Generated ${actions.length} action(s)`);

    // Process actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`[Flow Execution] ----------------------------------------`);
      console.log(`[Flow Execution] Processing action ${i + 1}/${actions.length}: ${action.type}`);
      console.log(`[Flow Execution] Action data:`, JSON.stringify(action, null, 2));

      if (action.type === "send_whatsapp") {
        console.log(`[Flow Execution]   → 📱 SENDING WHATSAPP MESSAGE`);
        console.log(`[Flow Execution]   → To: ${action.to}`);
        console.log(`[Flow Execution]   → Text: "${action.text}"`);
        console.log(`[Flow Execution]   → Device ID: ${deviceId}`);

        try {
          console.log(`[Flow Execution]   → Calling sendAndPersistMessage...`);

          await sendAndPersistMessage({
            deviceId,
            toPhoneNumber: action.to,
            type: "text",
            payload: { text: { body: action.text } },
            sender: "flow",
            textPreview: action.text,
          });

          console.log(`[Flow Execution]   → ✓ sendAndPersistMessage completed`);

          // Also log to messageLog for backwards compatibility
          await prisma.messageLog.create({
            data: {
              phone: action.to,
              message: action.text,
              status: "sent",
            },
          });

          console.log(`[Flow Execution]   ✓ Message sent and persisted successfully`);
        } catch (err: any) {
          console.error(`[Flow Execution]   ✗ ERROR sending message:`, err);
          console.error(`[Flow Execution]   ✗ Error message:`, err.message);
          console.error(`[Flow Execution]   ✗ Error stack:`, err.stack);
        }
      } else if (action.type === "send_whatsapp_interactive") {
        console.log(`[Flow Execution]   → send_whatsapp_interactive`);

        try {
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

          console.log(`[Flow Execution]   ✓ Interactive message sent and persisted`);
        } catch (err) {
          console.error(`[Flow Execution]   ✗ Error sending interactive message:`, err);
        }
      } else if (action.type === "send_whatsapp_media") {
        console.log(`[Flow Execution]   → send_whatsapp_media`);
        const { to, mediaId, mediaUrl, mediaType, caption, fileName } = action.data || {};

        const hasMediaId = mediaId && mediaId !== "";
        const hasMediaUrl = mediaUrl && mediaUrl !== "" && !mediaUrl.startsWith("blob:");

        if (!to || !mediaType || (!hasMediaId && !hasMediaUrl)) {
          console.error(`[Flow Execution]   ✗ Missing required media data`);
          continue;
        }

        try {
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

          await prisma.messageLog.create({
            data: {
              phone: to,
              message: `[${mediaType}] ${caption || "Media"}`,
              status: "sent",
            },
          });

          console.log(`[Flow Execution]   ✓ Media sent and persisted`);
        } catch (err: any) {
          console.error(`[Flow Execution]   ✗ Error sending media:`, err);
        }
      } else if (action.type === "assign_conversation") {
        console.log(`[Flow Execution]   → 👤 ASSIGNING CONVERSATION`);
        console.log(`[Flow Execution]   → Full action object:`, JSON.stringify(action, null, 2));
        console.log(`[Flow Execution]   → Assignee ID: ${action.assigneeId}`);
        console.log(`[Flow Execution]   → Session ID: ${action.sessionId}`);
        console.log(`[Flow Execution]   → Phone number: ${phoneNumber}`);
        console.log(`[Flow Execution]   → Device ID: ${deviceId}`);

        try {
          // Get the chat for this contact
          console.log(`[Flow Execution]   → 🔍 Searching for chat with phoneNumber=${phoneNumber}, deviceId=${deviceId}`);
          const chat = await prisma.chat.findFirst({
            where: {
              phoneNumber,
              deviceId,
            },
            orderBy: { createdAt: "desc" },
          });

          if (!chat) {
            console.error(`[Flow Execution]   ✗ ❌ NO CHAT FOUND for contact ${phoneNumber}`);
            console.error(`[Flow Execution]   ✗ This means the chat wasn't created yet - this is the problem!`);
            continue;
          }

          console.log(`[Flow Execution]   → ✅ Chat found: ${chat.id}`);
          console.log(`[Flow Execution]   → Current chat state - assignedAgentType: ${chat.assignedAgentType}, assignedAgentId: ${chat.assignedAgentId}`);

          // Check if assignee is an AI agent
          console.log(`[Flow Execution]   → 🔍 Checking if assigneeId "${action.assigneeId}" is an AI agent...`);
          const aiAgent = await prisma.aiAgent.findUnique({
            where: { id: action.assigneeId },
          });

          if (aiAgent) {
            console.log(`[Flow Execution]   → ✅ AI Agent found: ${aiAgent.name} (ID: ${aiAgent.id})`);
            console.log(`[Flow Execution]   → 📝 About to UPDATE chat ${chat.id} with assignedAgentType="AI", assignedAgentId="${aiAgent.id}"`);

            // Update chat to be assigned to AI agent
            const updatedChat = await prisma.chat.update({
              where: { id: chat.id },
              data: {
                assignedAgentType: "AI",
                assignedAgentId: aiAgent.id,
              },
            });

            console.log(`[Flow Execution]   → ✅✅✅ Chat UPDATE SUCCESSFUL!`);
            console.log(`[Flow Execution]   → Updated chat state:`, JSON.stringify({
              id: updatedChat.id,
              assignedAgentType: updatedChat.assignedAgentType,
              assignedAgentId: updatedChat.assignedAgentId,
            }, null, 2));

            // Trigger initial AI greeting
            console.log(`[Flow Execution]   → Triggering initial AI greeting...`);
            console.log(`[Flow Execution]   → Agent language: ${aiAgent.language}`);
            console.log(`[Flow Execution]   → Agent tone: ${aiAgent.tone}`);
            console.log(`[Flow Execution]   → Agent goal: ${aiAgent.goal || "N/A"}`);

            try {
              // Build initial greeting prompt that instructs the AI to introduce itself
              const greetingPrompt = `You are starting a new conversation. Introduce yourself warmly and begin with your first question based on your objective. Keep it short (2-3 sentences maximum).`;

              console.log(`[Flow Execution]   → Calling AI endpoint /api/ai-agent`);

              // Call AI endpoint to generate initial greeting
              const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/ai-agent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agentId: aiAgent.id,
                  userMessage: greetingPrompt,
                  sessionId: chat.id,
                }),
              });

              console.log(`[Flow Execution]   → AI API response status: ${aiResponse.status}`);

              if (!aiResponse.ok) {
                const errorText = await aiResponse.text();
                console.error(`[Flow Execution]   ✗ AI API error response:`, errorText);
                throw new Error(`AI API returned ${aiResponse.status}: ${errorText}`);
              }

              const aiData = await aiResponse.json();
              const aiMessage = aiData.reply || "Hola, ¿cómo puedo ayudarte?";

              console.log(`[Flow Execution]   → AI generated greeting: "${aiMessage}"`);

              // Send AI greeting via WhatsApp
              await sendAndPersistMessage({
                deviceId,
                toPhoneNumber: phoneNumber,
                type: "text",
                payload: { text: { body: aiMessage } },
                sender: "agent",
                textPreview: aiMessage,
                chatId: chat.id,
                agentId: aiAgent.id,
              });

              console.log(`[Flow Execution]   ✓ AI greeting sent successfully to ${phoneNumber}`);
            } catch (aiError: any) {
              console.error(`[Flow Execution]   ✗ Error generating/sending AI greeting:`, aiError);
              console.error(`[Flow Execution]   ✗ AI Error message:`, aiError.message);
              console.error(`[Flow Execution]   ✗ AI Error stack:`, aiError.stack);
            }
          } else {
            // Regular human agent assignment
            console.log(`[Flow Execution]   → ❌ AI agent NOT found with ID: ${action.assigneeId}`);
            console.log(`[Flow Execution]   → Assuming human agent assignment`);
            console.log(`[Flow Execution]   → 📝 About to UPDATE chat ${chat.id} with assignedAgentType="HUMAN", assignedAgentId="${action.assigneeId}"`);

            const updatedChat = await prisma.chat.update({
              where: { id: chat.id },
              data: {
                assignedAgentType: "HUMAN",
                assignedAgentId: action.assigneeId,
              },
            });

            console.log(`[Flow Execution]   → ✅ Chat UPDATE SUCCESSFUL (human agent)`);
            console.log(`[Flow Execution]   → Updated chat state:`, JSON.stringify({
              id: updatedChat.id,
              assignedAgentType: updatedChat.assignedAgentType,
              assignedAgentId: updatedChat.assignedAgentId,
            }, null, 2));
          }
        } catch (err: any) {
          console.error(`[Flow Execution]   ✗ ❌❌❌ ERROR ASSIGNING CONVERSATION:`, err);
          console.error(`[Flow Execution]   ✗ Error name:`, err.name);
          console.error(`[Flow Execution]   ✗ Error message:`, err.message);
          console.error(`[Flow Execution]   ✗ Error stack:`, err.stack);
        }
      } else {
        console.log(`[Flow Execution]   → Action type: ${action.type} (no handler)`);
      }
    }

    console.log(`[Flow Execution] ========================================`);
    console.log(`[Flow Execution] ✓✓✓ Flow "${flow.name}" executed successfully`);
    console.log(`[Flow Execution] ========================================`);
  } catch (error) {
    console.error(`[Flow Execution] Error executing flow:`, error);
  }
}

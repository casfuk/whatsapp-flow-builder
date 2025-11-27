import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FlowEngine } from "@/lib/runtime-engine";
import { sendAndPersistMessage } from "@/lib/whatsapp-message-service";
import { normalizePhoneNumber } from "@/lib/phone-utils";

/**
 * Webhook endpoint for third-party integrations (Facebook Leads, etc.)
 *
 * POST /api/v1/integrations/[triggerId]/webhook
 *
 * Receives webhook payloads from external services (e.g., Facebook Lead Ads),
 * creates/updates contacts, and triggers the associated flow.
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
        { status: 404 }
      );
    }

    console.log(`[Third-Party Webhook] Trigger found: ${trigger.id}`);
    console.log(`[Third-Party Webhook] Flow: ${trigger.flow.name} (${trigger.flowId})`);
    console.log(`[Third-Party Webhook] Device: ${trigger.device.name} (${trigger.deviceId})`);

    // 2. Read webhook payload
    const payload = await request.json();
    console.log(`[Third-Party Webhook] Payload received:`, JSON.stringify(payload, null, 2));
    console.log(`[Third-Party Webhook] Payload keys:`, Object.keys(payload));

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
      return NextResponse.json(
        { error: "Missing phone_number in payload (no mapping configured or field not found)" },
        { status: 400 }
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

    // 5. Update trigger with last received data
    console.log(`[Third-Party Webhook] Updating trigger ${trigger.id} with payload...`);
    console.log(`[Third-Party Webhook] Payload to save:`, payload);
    console.log(`[Third-Party Webhook] Payload keys to save:`, Object.keys(payload));

    const updatedTrigger = await prisma.thirdPartyTrigger.update({
      where: { id: trigger.id },
      data: {
        lastReceivedAt: new Date(),
        lastPayloadPreview: JSON.stringify(payload).substring(0, 500),
        lastPayloadSample: payload,
      },
    });

    console.log(`[Third-Party Webhook] ✓ Trigger updated successfully`);
    console.log(`[Third-Party Webhook] Saved lastPayloadSample keys:`,
      updatedTrigger.lastPayloadSample ? Object.keys(updatedTrigger.lastPayloadSample as any) : 'null');

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
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "runOncePerContact_already_triggered",
          contactId: contact.id,
          previouslyTriggeredAt: existingExecution.createdAt,
        });
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

    return NextResponse.json({
      ok: true,
      contactId: contact.id,
      flowId: trigger.flowId,
    });
  } catch (error: any) {
    console.error(`[Third-Party Webhook] Error:`, error);
    return NextResponse.json(
      {
        error: "Internal error",
        message: error.message || "Unknown error",
      },
      { status: 500 }
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
}: {
  flowId: string;
  deviceId: string;
  contactId: string;
  phoneNumber: string;
  contactName: string;
  initialMessage: string;
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

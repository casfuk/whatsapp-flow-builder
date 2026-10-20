import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone-utils";
import { safeJson } from "@/lib/safe-response";
import { startFlow } from "@/lib/flow/flow-runtime";

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
      return safeJson(
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

      return safeJson(
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

        return safeJson(
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

    // ═══════════════════════════════════════════════════════════════════════════
    // 📤 RESPONSE FORMATTING: Different formats for different clients
    // ═══════════════════════════════════════════════════════════════════════════
    // - Elementor: Expects simple {success: true} to avoid UI error
    // - Meta/Flow Builder: Needs detailed response with fields array for mapping
    // ═══════════════════════════════════════════════════════════════════════════

    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';

    // Detect Elementor requests (check for Elementor in user-agent or form data)
    const isElementorRequest =
      userAgent.toLowerCase().includes('elementor') ||
      referer.toLowerCase().includes('elementor') ||
      payload['form_name']?.toLowerCase().includes('elementor') ||
      payload['page_id'] !== undefined; // Elementor often sends page_id

    console.log(`[FIELD_MAPPING] Request source detection:`);
    console.log(`[FIELD_MAPPING] User-Agent: ${userAgent}`);
    console.log(`[FIELD_MAPPING] Referer: ${referer}`);
    console.log(`[FIELD_MAPPING] Is Elementor: ${isElementorRequest}`);

    if (isElementorRequest) {
      // Elementor-friendly response: simple and clean
      console.log(`[FIELD_MAPPING] Returning Elementor-friendly response (simple success)`);
      return new NextResponse(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      // Meta/Flow Builder response: detailed with fields for mapping
      console.log(`[FIELD_MAPPING] Returning detailed response for Flow Builder/Meta`);
      console.log(`[FIELD_MAPPING] Response will include ${fields.length} fields`);
      console.log(`[FIELD_MAPPING] Final response format:`, {
        ok: true,
        contactId: contact.id,
        flowId: trigger.flowId,
        fields: fields,
      });

      return safeJson(
        {
          ok: true,
          contactId: contact.id,
          flowId: trigger.flowId,
          fields, // Required for Flow Builder to detect field mapping
        },
        {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error: any) {
    console.error(`[Third-Party Webhook] Error:`, error);
    return safeJson(
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
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: { steps: true, connections: true },
    });
    if (!flow) {
      console.error(`[Flow Execution] Flow not found: ${flowId}`);
      return;
    }

    // Shared runtime: same actions (incl. AI agent activation) as WhatsApp-triggered flows.
    // The lead has not written yet, so an activated agent opens the conversation.
    await startFlow({
      flow,
      phoneNumber,
      contactId,
      deviceId,
      chatId,
      inboundText: null,
      variables: { name: contactName, message: initialMessage },
    });
    console.log(`[Flow Execution] ✓ Flow "${flow.name}" executed for ${phoneNumber}`);
  } catch (error) {
    console.error(`[Flow Execution] Error executing flow:`, (error as Error)?.message);
  }
}

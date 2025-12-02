import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/phone-utils";

/**
 * GET /api/v1/integrations/facebook/webhook
 *
 * Facebook webhook verification endpoint
 * Meta will send a GET request with hub.mode, hub.verify_token, and hub.challenge
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[Facebook Webhook] GET verification request received");
  console.log("[Facebook Webhook] Mode:", mode);
  console.log("[Facebook Webhook] Token:", token ? "***" : "missing");
  console.log("[Facebook Webhook] Challenge:", challenge);

  if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
    console.log("[Facebook Webhook] ✓ Verification successful, returning challenge");
    // IMPORTANT: return the raw challenge string and 200
    return new Response(challenge ?? "", { status: 200 });
  }

  console.error("[Facebook Webhook] ✗ Verification failed");
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST /api/v1/integrations/facebook/webhook
 *
 * Handles Facebook leadgen events
 * Fetches lead data from Graph API and triggers configured flows
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Facebook Webhook] POST event received");
    console.log("[Facebook Webhook] Body:", JSON.stringify(body, null, 2));

    // Facebook sends an array of entries
    if (!body.entry || !Array.isArray(body.entry)) {
      console.log("[Facebook Webhook] No entries in webhook payload");
      return NextResponse.json({ success: true });
    }

    // Process each entry
    for (const entry of body.entry) {
      const changes = entry.changes || [];

      for (const change of changes) {
        // Only process leadgen events
        if (change.field === "leadgen") {
          await processLeadgenEvent(change.value);
        }
      }
    }

    // Always return 200 OK to acknowledge receipt
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Facebook Webhook] POST error:", error);
    // Still return 200 to prevent Meta from retrying
    return NextResponse.json({ success: true });
  }
}

/**
 * Process a leadgen event
 */
async function processLeadgenEvent(eventData: any) {
  try {
    const { leadgen_id, page_id, form_id, created_time } = eventData;

    console.log("[Facebook Leadgen] ========================================");
    console.log("[Facebook Leadgen] New lead received");
    console.log("[Facebook Leadgen] Lead ID:", leadgen_id);
    console.log("[Facebook Leadgen] Page ID:", page_id);
    console.log("[Facebook Leadgen] Form ID:", form_id);
    console.log("[Facebook Leadgen] Created:", created_time);
    console.log("[Facebook Leadgen] ========================================");

    if (!leadgen_id) {
      console.error("[Facebook Leadgen] Missing leadgen_id");
      return;
    }

    // Fetch the lead data from Facebook Graph API
    const leadData = await fetchLeadDataFromFacebook(leadgen_id);

    if (!leadData) {
      console.error("[Facebook Leadgen] Failed to fetch lead data");
      return;
    }

    console.log("[Facebook Leadgen] Lead data fetched successfully");
    console.log("[Facebook Leadgen] Lead data:", JSON.stringify(leadData, null, 2));

    // Extract contact information from field_data
    const fieldData = leadData.field_data || [];
    let name = null;
    let email = null;
    let phone = null;
    const customFields: Record<string, string> = {};

    for (const field of fieldData) {
      const fieldName = field.name?.toLowerCase() || "";
      const fieldValue = field.values?.[0] || "";

      // Map common field names to contact fields
      if (fieldName.includes("name") || fieldName === "full_name") {
        name = fieldValue;
      } else if (fieldName.includes("email")) {
        email = fieldValue;
      } else if (fieldName.includes("phone") || fieldName.includes("telefono")) {
        phone = fieldValue;
      } else {
        // Store other fields as custom fields
        customFields[field.name] = fieldValue;
      }
    }

    console.log("[Facebook Leadgen] Extracted contact data:");
    console.log("[Facebook Leadgen] - Name:", name || "N/A");
    console.log("[Facebook Leadgen] - Email:", email || "N/A");
    console.log("[Facebook Leadgen] - Phone:", phone || "N/A");
    console.log("[Facebook Leadgen] - Custom fields:", customFields);

    // Phone is required to create a contact
    if (!phone) {
      console.error("[Facebook Leadgen] Missing phone number in lead data");
      return;
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(phone);
    console.log("[Facebook Leadgen] Phone normalized:", phone, "→", normalizedPhone);

    // Find or create the contact
    // Facebook leads don't have a deviceId, so we use an empty string
    const contact = await prisma.contact.upsert({
      where: {
        phone_device: {
          phone: normalizedPhone,
          deviceId: "", // Facebook leads have no device
        },
      },
      create: {
        phone: normalizedPhone,
        deviceId: "",
        name: name || null,
        email: email || null,
        source: "facebook_lead",
        metadata: JSON.stringify({
          leadgen_id,
          page_id,
          form_id,
          created_time,
          custom_fields: customFields,
        }),
      },
      update: {
        name: name || undefined,
        email: email || undefined,
        metadata: JSON.stringify({
          leadgen_id,
          page_id,
          form_id,
          created_time,
          custom_fields: customFields,
          last_updated: new Date().toISOString(),
        }),
        updatedAt: new Date(),
      },
    });

    console.log("[Facebook Leadgen] ✓ Contact created/updated:", contact.id);

    // Look up the page integration by page_id
    const pageIntegration = await prisma.facebookPageIntegration.findUnique({
      where: { pageId: page_id },
      include: {
        leadFormConfigs: true,
      },
    });

    if (!pageIntegration) {
      console.log("[Facebook Leadgen] No page integration found for page_id:", page_id);
      console.log("[Facebook Leadgen] Contact created but no flow triggered");
      return;
    }

    console.log("[Facebook Leadgen] Found page integration:", pageIntegration.pageName);

    // Look up the form config
    const formConfig = pageIntegration.leadFormConfigs.find(
      (config) => config.formId === form_id && config.isActive
    );

    let flowId: string | null = null;
    let tagsToApply: string[] = [];

    if (formConfig && formConfig.flowId) {
      // Use form-specific config
      console.log("[Facebook Leadgen] Using form-specific config");
      flowId = formConfig.flowId;
      try {
        tagsToApply = JSON.parse(formConfig.tags);
      } catch (e) {
        tagsToApply = [];
      }
    } else if (pageIntegration.defaultFlowId) {
      // Fall back to default config
      console.log("[Facebook Leadgen] Using default page config");
      flowId = pageIntegration.defaultFlowId;
      try {
        tagsToApply = JSON.parse(pageIntegration.defaultTags);
      } catch (e) {
        tagsToApply = [];
      }
    } else {
      console.log("[Facebook Leadgen] No flow configured for this form or page");
      console.log("[Facebook Leadgen] Contact created but no flow triggered");
      return;
    }

    console.log("[Facebook Leadgen] Flow ID:", flowId);
    console.log("[Facebook Leadgen] Tags to apply:", tagsToApply);

    // Apply tags to contact
    if (tagsToApply.length > 0) {
      console.log("[Facebook Leadgen] Applying tags to contact");
      for (const tagName of tagsToApply) {
        try {
          // Find or create tag
          const tag = await prisma.tag.upsert({
            where: { name: tagName },
            create: { name: tagName },
            update: {},
          });

          // Add tag to contact (ignore if already exists)
          await prisma.contactTag.upsert({
            where: {
              contactId_tagId: {
                contactId: contact.id,
                tagId: tag.id,
              },
            },
            create: {
              contactId: contact.id,
              tagId: tag.id,
            },
            update: {},
          });

          console.log("[Facebook Leadgen] ✓ Applied tag:", tagName);
        } catch (tagError) {
          console.error("[Facebook Leadgen] Error applying tag:", tagError);
        }
      }
    }

    // Load the flow
    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!flow) {
      console.error("[Facebook Leadgen] Flow not found:", flowId);
      return;
    }

    console.log("[Facebook Leadgen] Triggering flow:", flow.name);

    // Get the first available device for sending WhatsApp messages
    const device = await prisma.device.findFirst({
      where: { isConnected: true },
    });

    if (!device) {
      console.error("[Facebook Leadgen] No connected WhatsApp devices found");
      return;
    }

    console.log("[Facebook Leadgen] Using device:", device.name);

    // Create Chat record for the contact (needed for messaging)
    const chat = await prisma.chat.upsert({
      where: {
        phoneNumber_deviceId: {
          phoneNumber: contact.phone,
          deviceId: device.id,
        },
      },
      create: {
        phoneNumber: contact.phone,
        contactName: contact.name || name || "Facebook Lead",
        deviceId: device.id,
        lastMessagePreview: "New Facebook lead",
        lastMessageAt: new Date(),
        status: "open",
        unreadCount: 1,
      },
      update: {
        contactName: contact.name || name || undefined,
        lastMessagePreview: "New Facebook lead",
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    console.log("[Facebook Leadgen] ✓ Chat created/updated:", chat.id);

    // Increment flow execution counter
    await prisma.flow.update({
      where: { id: flow.id },
      data: {
        executions: {
          increment: 1,
        },
      },
    });

    // Import FlowEngine dynamically to execute the flow
    const { FlowEngine } = await import("@/lib/runtime-engine");

    // Find the start node
    const startNode = flow.steps.find((s: any) => s.type === "start");
    if (!startNode) {
      console.error("[Facebook Leadgen] No start node found in flow");
      return;
    }

    // Generate session ID
    const sessionId = `${contact.phone}-${flow.id}-${Date.now()}`;

    // Initialize engine
    const engine = new FlowEngine(
      flow,
      sessionId,
      {
        phone: contact.phone,
        name: contact.name || name || "Lead",
        email: email || "",
        contactId: contact.id,
        leadgen_id,
        page_id,
        form_id,
        ...customFields,
      },
      chat.id
    );

    console.log("[Facebook Leadgen] ✓ FlowEngine initialized");
    console.log("[Facebook Leadgen] Executing flow from start node...");

    // Execute flow from start
    const actions = await engine.executeFromStep(startNode.id);

    console.log(`[Facebook Leadgen] ✓ Flow execution complete. Generated ${actions.length} action(s)`);

    // Process actions (send WhatsApp messages, etc.)
    const { sendAndPersistMessage } = await import("@/lib/whatsapp-message-service");

    for (const action of actions) {
      if (action.type === "send_whatsapp") {
        console.log("[Facebook Leadgen] Sending WhatsApp message to", action.to);
        try {
          await sendAndPersistMessage({
            deviceId: device.id,
            toPhoneNumber: action.to,
            type: "text",
            payload: { text: { body: action.text } },
            sender: "flow",
            textPreview: action.text,
          });
          console.log("[Facebook Leadgen] ✓ Message sent successfully");
        } catch (err) {
          console.error("[Facebook Leadgen] ✗ Error sending message:", err);
        }
      } else if (action.type === "send_whatsapp_interactive") {
        console.log("[Facebook Leadgen] Sending interactive WhatsApp message");
        try {
          const messageText = action.interactive?.body?.text || "Interactive message";
          await sendAndPersistMessage({
            deviceId: device.id,
            toPhoneNumber: action.to,
            type: "interactive",
            payload: { interactive: action.interactive },
            sender: "flow",
            textPreview: messageText,
          });
          console.log("[Facebook Leadgen] ✓ Interactive message sent");
        } catch (err) {
          console.error("[Facebook Leadgen] ✗ Error sending interactive message:", err);
        }
      }
      // Add more action handlers as needed
    }

    console.log("[Facebook Leadgen] ✓ Flow triggered successfully");

    console.log("[Facebook Leadgen] ✓ Lead processing complete");
  } catch (error) {
    console.error("[Facebook Leadgen] Error processing leadgen event:", error);
  }
}

/**
 * Fetch lead data from Facebook Graph API
 */
async function fetchLeadDataFromFacebook(leadgenId: string) {
  try {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      console.error("[Facebook Graph API] Missing FACEBOOK_APP_ID or FACEBOOK_APP_SECRET");
      return null;
    }

    // Create app access token: APP_ID|APP_SECRET
    const accessToken = `${appId}|${appSecret}`;

    // Fetch lead data from Graph API
    const url = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${accessToken}`;

    console.log("[Facebook Graph API] Fetching lead data from:", `https://graph.facebook.com/v21.0/${leadgenId}`);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Facebook Graph API] Error response:", response.status, errorText);
      return null;
    }

    const data = await response.json();

    console.log("[Facebook Graph API] ✓ Lead data fetched successfully");

    return data;
  } catch (error) {
    console.error("[Facebook Graph API] Error fetching lead data:", error);
    return null;
  }
}

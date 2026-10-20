import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { FlowEngine } from "@/lib/runtime-engine";
import { sendWhatsAppMessage } from "@/lib/whatsapp-sender";
import { checkAndSendAdminAlert } from "@/lib/admin-alerts";
import { safeJson } from "@/lib/safe-response";
import { handleMetaVerification, readVerifiedMetaJson } from "@/lib/meta-webhook";

// GET: Webhook verification (required by Meta)
export async function GET(request: NextRequest) {
  return handleMetaVerification(request, [process.env.FACEBOOK_VERIFY_TOKEN], "[Facebook Lead Webhook]");
}

// POST: Handle incoming lead data
export async function POST(request: NextRequest) {
  // Reject anything not signed by Meta, checked on the raw body before parsing
  const verified = await readVerifiedMetaJson(request, "[Facebook Lead Webhook]");
  if (!verified.ok) return verified.response;

  try {
    const body = verified.body;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value || !value.leadgen_id) {
      return safeJson({ status: "no lead data" });
    }

    const leadgenId = value.leadgen_id;
    const pageId = value.page_id;
    const formId = value.form_id;

    console.log(`Received Facebook lead: ${leadgenId}`);

    // Fetch full lead data from Facebook Graph API
    const leadData = await fetchLeadData(leadgenId);

    if (!leadData) {
      return safeJson({ error: "Failed to fetch lead" }, { status: 500 });
    }

    // Create or update contact
    const contact = await createContactFromLead(leadData);

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔔 ADMIN ALERT: Check and send admin alert for new Facebook lead
    // ═══════════════════════════════════════════════════════════════════════════
    const adminNumber = process.env.ADMIN_ALERT_PHONE;
    if (adminNumber) {
      try {
        await checkAndSendAdminAlert({
          contact,
          source: "facebook_lead",
          adminNumber,
          additionalInfo: `Form ID: ${formId}`,
        });
      } catch (alertError) {
        console.error(`[ADMIN_ALERT_ERROR] Exception in admin alert:`, alertError);
        // Don't fail the webhook if alert fails
      }
    } else {
      console.warn(`[ADMIN_ALERT] ADMIN_ALERT_PHONE not configured - skipping alert`);
    }

    // Find and trigger active flows with Facebook lead trigger
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
      const startNode = flow.steps.find((s) => s.type === "start");
      if (!startNode) continue;

      const startConfig = JSON.parse(startNode.configJson);
      const trigger = startConfig.trigger;

      if (trigger?.type === "facebook_lead" || trigger?.type === "tag_added") {
        console.log(`Triggering flow: ${flow.name} for lead: ${contact.phone}`);
        await executeFlowForLead(flow.id, contact.phone, leadData);
      }
    }

    return safeJson({ status: "processed" });
  } catch (error) {
    console.error("Facebook webhook error:", error);
    return safeJson({ error: "Internal error" }, { status: 500 });
  }
}

async function fetchLeadData(leadId: string) {
  try {
    // Get Facebook page access token
    const pageConnection = await prisma.facebookPageConnection.findFirst({
      where: { isDefault: true },
    });

    if (!pageConnection) {
      console.error("No default Facebook page connection found");
      return null;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${leadId}?access_token=${pageConnection.pageAccessToken}`
    );

    if (!response.ok) {
      console.error("Failed to fetch lead data from Facebook");
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching lead data:", error);
    return null;
  }
}

async function createContactFromLead(leadData: any) {
  const fieldData = leadData.field_data || [];

  let name = "";
  let phone = "";
  let email = "";

  for (const field of fieldData) {
    if (field.name === "full_name" || field.name === "name") {
      name = field.values?.[0] || "";
    } else if (field.name === "phone_number" || field.name === "phone") {
      phone = field.values?.[0] || "";
    } else if (field.name === "email") {
      email = field.values?.[0] || "";
    }
  }

  // Create or update contact
  // Form contacts have deviceId = "" (empty string for non-WhatsApp contacts)
  let contact = await prisma.contact.findFirst({
    where: { phone, deviceId: "" },
  });

  if (contact) {
    // Update existing
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: {
        name: name || contact.name,
        email: email || contact.email,
      },
    });
  } else {
    // Create new
    contact = await prisma.contact.create({
      data: {
        phone,
        deviceId: "",
        name,
        email,
        source: "form",
      },
    });
  }

  return contact;
}

async function executeFlowForLead(flowId: string, phoneNumber: string, leadData: any) {
  try {
    const sessionId = `${phoneNumber}-${flowId}-${Date.now()}`;

    const context = {
      sessionId,
      flowId,
      variables: {
        phone: phoneNumber,
        leadData,
      },
    };

    const flow = await prisma.flow.findUnique({
      where: { id: flowId },
      include: {
        steps: true,
        connections: true,
      },
    });

    if (!flow) return;

    // Find the start node
    const startNode = flow.steps.find((s: any) => s.type === "start");
    if (!startNode) {
      console.error("No start node found in flow");
      return;
    }

    const engine = new FlowEngine(flow, context.sessionId, context.variables);
    const actions = await engine.executeFromStep(startNode.id);

    for (const action of actions) {
      if (action.type === "send_whatsapp") {
        await sendWhatsAppMessage({
          to: action.to,
          message: action.text,
        });
      }
    }
  } catch (error) {
    console.error("Flow execution error for lead:", error);
  }
}

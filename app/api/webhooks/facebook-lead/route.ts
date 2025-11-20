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

  const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || "funnelchat_fb_verify";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Facebook webhook verified");
    return new NextResponse(challenge, { status: 200 });
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}

// POST: Handle incoming lead data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value || !value.leadgen_id) {
      return NextResponse.json({ status: "no lead data" });
    }

    const leadgenId = value.leadgen_id;
    const pageId = value.page_id;
    const formId = value.form_id;

    console.log(`Received Facebook lead: ${leadgenId}`);

    // Fetch full lead data from Facebook Graph API
    const leadData = await fetchLeadData(leadgenId);

    if (!leadData) {
      return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
    }

    // Create or update contact
    const contact = await createContactFromLead(leadData);

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
        console.log(`Triggering flow: ${flow.name} for lead: ${contact.phoneNumber}`);
        await executeFlowForLead(flow.id, contact.phoneNumber, leadData);
      }
    }

    return NextResponse.json({ status: "processed" });
  } catch (error) {
    console.error("Facebook webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
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
  let contact = await prisma.contact.findUnique({
    where: { phoneNumber: phone },
  });

  if (contact) {
    // Update existing
    contact = await prisma.contact.update({
      where: { phoneNumber: phone },
      data: {
        name: name || contact.name,
        email: email || contact.email,
      },
    });
  } else {
    // Create new
    contact = await prisma.contact.create({
      data: {
        phoneNumber: phone,
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

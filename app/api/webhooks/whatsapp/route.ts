import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNewLeadNotification } from "@/lib/whatsapp-sender";
import { sendAndPersistMessage } from "@/lib/whatsapp-message-service";
import { normalizePhoneNumber } from "@/lib/phone-utils";
import { checkAndSendAdminAlert } from "@/lib/admin-alerts";
import { safeJson } from "@/lib/safe-response";
import { handleMetaVerification, readVerifiedMetaJson } from "@/lib/meta-webhook";
import { rankMatchingFlows } from "@/lib/flow/triggers";
import { continueFlowSession, startFlow } from "@/lib/flow/flow-runtime";
import { respondWithAgent } from "@/lib/ai/agent-runtime";

/**
 * WhatsApp Cloud API webhook: the single inbound channel for every business
 * using FunnelChat. Routing is generic and driven by the flows built in the UI:
 *
 *   1. A flow waiting for this contact's answer continues
 *      (unless the message is a keyword that starts another flow).
 *   2. Otherwise the best matching flow trigger starts ONE flow. The flow
 *      decides what happens next, including which AI agent (if any) to
 *      activate, change or stop.
 *   3. Otherwise, if the conversation has an active AI agent, that agent replies.
 *      While an agent is active, only a message that is exactly a flow keyword
 *      interrupts it.
 */

// Customer opt-out from automated messages
const STOP_KEYWORDS = ["stop", "para", "basta", "gracias", "gracias ya"];
const STOP_CONFIRMATION =
  "Perfecto, dejo de enviarte mensajes automáticos. Si necesitas algo más, escribe y te atendemos en persona. 🙌";

// Our own admin notifications (sent from the same number) must never trigger flows
const OWN_NOTIFICATION_PREFIXES = ["📩 Nueva conversación en FunnelChat", "📩 Nuevo Handover de "];

type Inbound = {
  /** Used for routing flow buttons (button/list id for taps, text otherwise) */
  routeText: string;
  /** What the contact actually typed or tapped */
  displayText: string;
  isInteractive: boolean;
  metadata: Record<string, unknown>;
};

function parseInbound(message: any): Inbound | null {
  const metadata: Record<string, unknown> = { messageType: message.type, timestamp: new Date().toISOString() };
  if (message.type === "text" && message.text?.body) {
    return { routeText: message.text.body, displayText: message.text.body, isInteractive: false, metadata };
  }
  const interactive = message.interactive;
  if (message.type === "interactive" && interactive?.type === "button_reply" && interactive.button_reply) {
    const { id, title } = interactive.button_reply;
    return {
      routeText: id,
      displayText: title || id,
      isInteractive: true,
      metadata: { ...metadata, interactiveType: "button_reply", buttonId: id, buttonTitle: title },
    };
  }
  if (message.type === "interactive" && interactive?.type === "list_reply" && interactive.list_reply) {
    const { id, title, description } = interactive.list_reply;
    return {
      routeText: id,
      displayText: title || id,
      isInteractive: true,
      metadata: { ...metadata, interactiveType: "list_reply", listItemId: id, listItemTitle: title, listItemDescription: description },
    };
  }
  return null;
}

async function firstAllowedMatch<F extends { id: string }>(matches: { flow: F; trigger: { oncePerContact?: boolean } }[], phone: string) {
  for (const match of matches) {
    if (match.trigger.oncePerContact) {
      const already = await prisma.sessionState.findFirst({
        where: { flowId: match.flow.id, sessionId: { startsWith: phone } },
        select: { id: true },
      });
      if (already) continue;
    }
    return match.flow;
  }
  return null;
}

// GET: Webhook verification (required by Meta)
export async function GET(request: NextRequest) {
  return handleMetaVerification(request, [process.env.WEBHOOK_VERIFY_TOKEN, process.env.WHATSAPP_VERIFY_TOKEN], "[Webhook]");
}

// POST: Handle incoming messages
export async function POST(request: NextRequest) {
  // Reject anything not signed by Meta, checked on the raw body before parsing
  const verified = await readVerifiedMetaJson(request, "[Webhook]");
  if (!verified.ok) return verified.response;

  try {
    const value = verified.body.entry?.[0]?.changes?.[0]?.value;

    // Delivery/read receipts
    if (value?.statuses) return safeJson({ ok: true });

    const message = value?.messages?.[0];
    if (!message) return safeJson({ ok: true });

    const from = normalizePhoneNumber(message.from);
    const contactName: string | null = value.contacts?.[0]?.profile?.name || null;
    const inbound = parseInbound(message);

    if (!inbound || !inbound.routeText.trim()) {
      console.log(`[Webhook] Ignoring unsupported or empty ${message.type} message`);
      return safeJson({ status: "ignored" });
    }
    if (OWN_NOTIFICATION_PREFIXES.some((p) => inbound.displayText.startsWith(p))) {
      return safeJson({ status: "ignored (our own notification)" });
    }

    console.log(`[Webhook] ${message.type} message from ${from}`);

    // Device = the WhatsApp number that received the message
    const devicePhoneNumberId = value.metadata?.phone_number_id;
    const device =
      (devicePhoneNumberId &&
        (await prisma.device.findFirst({ where: { whatsappPhoneNumberId: devicePhoneNumberId } }))) ||
      (await prisma.device.findFirst({ where: { isConnected: true }, orderBy: { createdAt: "asc" } }));

    if (!device) {
      console.error("[Webhook] No WhatsApp device configured - message not processed");
      return safeJson({ status: "no device" });
    }

    const contact = await prisma.contact.upsert({
      where: { phone_device: { phone: from, deviceId: device.id } },
      create: {
        phone: from,
        deviceId: device.id,
        name: contactName,
        profileImageUrl: value.contacts?.[0]?.profile?.picture || null,
        source: "whatsapp",
        metadata: JSON.stringify({ lastMessageAt: new Date().toISOString(), lastMessageId: message.id }),
      },
      update: {
        name: contactName || undefined,
        profileImageUrl: value.contacts?.[0]?.profile?.picture || undefined,
        metadata: JSON.stringify({ lastMessageAt: new Date().toISOString(), lastMessageId: message.id }),
        updatedAt: new Date(),
      },
    });

    const chat = await prisma.chat.upsert({
      where: { phoneNumber_deviceId: { phoneNumber: from, deviceId: device.id } },
      create: {
        phoneNumber: from,
        contactName,
        deviceId: device.id,
        lastMessagePreview: inbound.displayText,
        lastMessageAt: new Date(),
        unreadCount: 1,
        status: "open",
      },
      update: {
        contactName: contactName || undefined,
        lastMessagePreview: inbound.displayText,
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    const inboundMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        sender: "contact",
        text: inbound.routeText,
        status: "delivered",
        messageId: message.id,
        metadata: JSON.stringify(inbound.metadata),
      },
    });

    const adminNumber = process.env.ADMIN_ALERT_PHONE;
    if (adminNumber) {
      await checkAndSendAdminAlert({ contact, source: "whatsapp", adminNumber }).catch((err) =>
        console.error("[Webhook] Admin alert failed:", err?.message)
      );
    }

    // The contact replied: reset follow-up tracking
    await prisma.chat.update({
      where: { id: chat.id },
      data: { lastUserReplyAt: new Date(), lastQuestionAttempts: 0 },
    });

    // Customer opt-out
    const normalized = inbound.displayText.trim().toLowerCase();
    if (STOP_KEYWORDS.includes(normalized) && !chat.aiDisabled) {
      await prisma.chat.update({
        where: { id: chat.id },
        data: { aiDisabled: true, lastQuestionSentAt: null, lastQuestionAttempts: 0, lastQuestionMessageId: null },
      });
      await sendAndPersistMessage({
        deviceId: device.id,
        toPhoneNumber: from,
        type: "text",
        payload: { text: { body: STOP_CONFIRMATION } },
        sender: "agent",
        textPreview: STOP_CONFIRMATION,
        chatId: chat.id,
        agentId: chat.assignedAgentId || undefined,
      }).catch((err) => console.error("[Webhook] STOP confirmation failed:", err?.message));
      return safeJson({ status: "ai_disabled" });
    }

    // An agent only counts as active if it still exists and is enabled
    const assignedAgent =
      chat.assignedAgentType === "AI" && chat.assignedAgentId && !chat.aiDisabled
        ? await prisma.aiAgent.findUnique({ where: { id: chat.assignedAgentId }, select: { isActive: true } })
        : null;
    const aiActive = !!assignedAgent?.isActive;
    const flows = await prisma.flow.findMany({
      where: { isActive: true },
      include: { steps: true, connections: true },
    });
    const flowContext = {
      phoneNumber: from,
      contactId: contact.id,
      deviceId: device.id,
      chatId: chat.id,
    };

    const startMatchedFlow = async (flow: (typeof flows)[number]) => {
      console.log(`[Webhook] Starting flow "${flow.name}" for ${from}`);
      await prisma.messageLog.create({ data: { phone: from, message: inbound.displayText, status: "received" } });
      sendNewLeadNotification({
        flowName: flow.name,
        phoneNumber: from,
        name: contactName,
        email: null,
        source: "whatsapp",
      }).catch((err) => console.error("[Webhook] New lead notification failed:", err?.message));
      await startFlow({
        flow,
        ...flowContext,
        inboundText: inbound.displayText,
        startedAt: inboundMessage.createdAt,
      });
    };

    // 1. A flow is waiting for this contact's answer
    const waitingSession = await prisma.sessionState.findFirst({
      where: { sessionId: { startsWith: from }, status: "active", currentStepId: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (waitingSession) {
      // A typed keyword of another flow restarts routing; button taps are always answers
      const interrupting = inbound.isInteractive
        ? null
        : await firstAllowedMatch(rankMatchingFlows(flows, inbound.displayText, { waitingForReply: true }), from);
      if (interrupting) {
        await prisma.sessionState.update({ where: { id: waitingSession.id }, data: { status: "completed" } });
        await startMatchedFlow(interrupting);
        return safeJson({ status: "flow started" });
      }
      const flow = flows.find((f) => f.id === waitingSession.flowId) ??
        (await prisma.flow.findUnique({ where: { id: waitingSession.flowId }, include: { steps: true, connections: true } }));
      if (flow) {
        await continueFlowSession({
          session: waitingSession,
          flow,
          ...flowContext,
          replyId: inbound.routeText,
          replyText: inbound.displayText,
        });
        return safeJson({ status: "session continued" });
      }
    }

    // 2. A flow trigger matches: the flow decides what happens (incl. which AI agent)
    const matched = await firstAllowedMatch(rankMatchingFlows(flows, inbound.displayText, { aiActive }), from);
    if (matched) {
      await startMatchedFlow(matched);
      return safeJson({ status: "flow started" });
    }

    // 3. The conversation's active AI agent replies
    if (aiActive) {
      await respondWithAgent({
        agentId: chat.assignedAgentId!,
        chatId: chat.id,
        deviceId: device.id,
        phoneNumber: from,
        userMessage: inbound.displayText,
      });
      return safeJson({ status: "ai agent replied" });
    }

    return safeJson({ status: "processed" });
  } catch (error) {
    console.error("[Webhook] Unhandled error in POST handler:", (error as Error)?.message);
    // Always 200 so Meta does not retry
    return safeJson({ status: "error", message: "Internal error handled" }, { status: 200 });
  }
}

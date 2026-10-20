import { prisma } from "@/lib/prisma";
import { FlowEngine } from "@/lib/runtime-engine";
import type { Action } from "@/lib/runtime-types";
import { sendAndPersistMessage } from "@/lib/whatsapp-message-service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-sender";
import { respondWithAgent } from "@/lib/ai/agent-runtime";

/**
 * Shared flow runtime used by every entry point (WhatsApp messages, Facebook
 * Lead Ads, third-party lead webhooks). One place starts/continues flows and
 * executes their actions, including the generic AI agent actions.
 */

type FlowWithGraph = {
  id: string;
  name: string;
  steps: { id: string; type: string; configJson: string }[];
  connections: { fromStepId: string; toStepId: string; sourceHandle: string | null; conditionLabel: string | null }[];
};

type MediaActionData = {
  to?: string;
  mediaId?: string;
  mediaUrl?: string;
  mediaType?: string;
  caption?: string;
  fileName?: string;
};

export type ActionContext = {
  deviceId: string | null;
  phoneNumber: string;
  chatId: string | null;
  sessionId: string;
  flowName: string;
  /** What the contact wrote (button title for taps); absent for lead-triggered flows */
  inboundText?: string | null;
};

// Admin who receives "assign to me" notifications (existing behaviour)
const ASSIGN_NOTIFICATION_NUMBER = "34644412937";

async function logOutbound(phone: string, message: string) {
  await prisma.messageLog.create({ data: { phone, message, status: "sent" } }).catch(() => undefined);
}

function buildMediaPayload(data: MediaActionData | undefined) {
  const { mediaId, mediaUrl, mediaType, caption, fileName } = data || {};
  const hasMediaId = !!mediaId;
  const hasMediaUrl = !!mediaUrl && !String(mediaUrl).startsWith("blob:");
  if (!mediaType || (!hasMediaId && !hasMediaUrl)) return null;
  const actualType = (mediaType === "media" ? "image" : mediaType) as "image" | "audio" | "document" | "video";
  const media: Record<string, string | undefined> = hasMediaId ? { id: mediaId } : { link: mediaUrl };
  if (caption && actualType !== "audio") media.caption = caption;
  if (fileName && actualType === "document") media.filename = fileName;
  return { actualType, payload: { [actualType]: media }, preview: caption || `[${actualType}]` };
}

async function notifyAssignToSelf(action: Action, ctx: ActionContext) {
  const contact = await prisma.contact.findFirst({
    where: { phone: ctx.phoneNumber, deviceId: ctx.deviceId },
    include: { tags: { include: { tag: true } } },
  });
  const session = await prisma.sessionState.findUnique({ where: { sessionId: ctx.sessionId } });
  const variables = session?.variablesJson ? JSON.parse(session.variablesJson) : {};
  const summary = Object.keys(variables)
    .filter((k) => !["phone", "sessionId", "sessionStartedAt", "contactId"].includes(k) && variables[k])
    .map((k) => `• ${k}: ${variables[k]}`);
  const baseUrl = process.env.APP_BASE_URL;
  const lines = [
    "📩 Nueva conversación asignada a ti",
    "",
    `• Flow: ${action.flowName || ctx.flowName}`,
    `• Contacto: ${contact?.name || ctx.phoneNumber}`,
    `• Teléfono: +${ctx.phoneNumber}`,
    `• Etiquetas: ${contact?.tags.map((t) => t.tag.name).join(", ") || "Sin etiquetas"}`,
    "",
    "📋 Resumen:",
    summary.length ? summary.join("\n") : "No hay información adicional disponible",
  ];
  if (baseUrl) lines.push("", `🔗 Abrir el dashboard: ${baseUrl}/chat?phone=${encodeURIComponent(ctx.phoneNumber)}`);
  await sendWhatsAppMessage({ to: ASSIGN_NOTIFICATION_NUMBER, message: lines.join("\n"), type: "text" });
}

/** Executes the actions produced by the flow engine, in order. */
export async function executeFlowActions(actions: Action[], ctx: ActionContext) {
  for (const action of actions) {
    try {
      switch (action.type) {
        case "send_whatsapp": {
          if (!ctx.deviceId) throw new Error("No WhatsApp device available");
          await sendAndPersistMessage({
            deviceId: ctx.deviceId,
            toPhoneNumber: action.to,
            type: "text",
            payload: { text: { body: action.text } },
            sender: "flow",
            textPreview: action.text,
            chatId: ctx.chatId ?? undefined,
          });
          await logOutbound(action.to, action.text);
          break;
        }
        case "send_whatsapp_interactive": {
          if (!ctx.deviceId) throw new Error("No WhatsApp device available");
          const preview = action.interactive?.body?.text || "Interactive message";
          await sendAndPersistMessage({
            deviceId: ctx.deviceId,
            toPhoneNumber: action.to,
            type: "interactive",
            payload: { interactive: action.interactive },
            sender: "flow",
            textPreview: preview,
            chatId: ctx.chatId ?? undefined,
          });
          await logOutbound(action.to, preview);
          break;
        }
        case "send_whatsapp_media": {
          const media = buildMediaPayload(action.data);
          if (!media || !ctx.deviceId || !action.data?.to) {
            console.error("[FlowRuntime] Media action skipped: missing media, device or recipient");
            break;
          }
          await sendAndPersistMessage({
            deviceId: ctx.deviceId,
            toPhoneNumber: action.data.to,
            type: media.actualType,
            payload: media.payload,
            sender: "flow",
            textPreview: media.preview,
            chatId: ctx.chatId ?? undefined,
          });
          await logOutbound(action.data.to, `[${action.data.mediaType}] ${action.data.caption || "Media"}`);
          break;
        }
        case "assign_conversation": {
          if (action.assignToSelf === true && action.assigneeType === "human") {
            await notifyAssignToSelf(action, ctx);
          }
          if (action.assigneeType === "ai" && action.assigneeId && ctx.chatId && ctx.deviceId) {
            await respondWithAgent({
              agentId: action.assigneeId,
              chatId: ctx.chatId,
              deviceId: ctx.deviceId,
              phoneNumber: ctx.phoneNumber,
              userMessage: ctx.inboundText,
            });
          }
          break;
        }
        case "ai_agent": {
          if (action.mode !== "stop" && action.respondNow && ctx.chatId && ctx.deviceId) {
            await respondWithAgent({
              agentId: action.agentId,
              chatId: ctx.chatId,
              deviceId: ctx.deviceId,
              phoneNumber: ctx.phoneNumber,
              userMessage: ctx.inboundText,
            });
          }
          break;
        }
        default:
          console.log(`[FlowRuntime] No handler for action ${action.type}`);
      }
    } catch (error) {
      console.error(`[FlowRuntime] Action ${action.type} failed:`, (error as Error)?.message);
    }
  }
}

/** Starts a flow from its start node for a contact. */
export async function startFlow({
  flow,
  phoneNumber,
  contactId,
  deviceId,
  chatId,
  inboundText,
  startedAt = new Date(),
  variables = {},
}: {
  flow: FlowWithGraph;
  phoneNumber: string;
  contactId: string | null;
  deviceId: string | null;
  chatId: string | null;
  inboundText?: string | null;
  startedAt?: Date;
  variables?: Record<string, unknown>;
}) {
  const startNode = flow.steps.find((s) => s.type === "start");
  if (!startNode) {
    console.error(`[FlowRuntime] Flow "${flow.name}" has no start node`);
    return;
  }
  const sessionId = `${phoneNumber}-${flow.id}-${Date.now()}`;
  await prisma.flow.update({ where: { id: flow.id }, data: { executions: { increment: 1 } } }).catch(() => undefined);

  const engine = new FlowEngine(
    flow,
    sessionId,
    {
      phone: phoneNumber,
      message: inboundText ?? "",
      contactId,
      sessionStartedAt: startedAt.toISOString(),
      ...variables,
    },
    chatId ?? undefined
  );
  const actions = await engine.executeFromStep(startNode.id);
  await executeFlowActions(actions, { deviceId, phoneNumber, chatId, sessionId, flowName: flow.name, inboundText });
}

/**
 * Continues a flow that is waiting for the contact's answer.
 * `replyId` is what routes buttons (option id); `replyText` is what the contact saw/typed.
 */
export async function continueFlowSession({
  session,
  flow,
  phoneNumber,
  contactId,
  deviceId,
  chatId,
  replyId,
  replyText,
}: {
  session: { sessionId: string; currentStepId: string | null; variablesJson: string };
  flow: FlowWithGraph;
  phoneNumber: string;
  contactId: string | null;
  deviceId: string | null;
  chatId: string | null;
  replyId: string;
  replyText: string;
}) {
  const currentStep = flow.steps.find((s) => s.id === session.currentStepId);
  if (!currentStep) {
    console.error(`[FlowRuntime] Current step not found: ${session.currentStepId}`);
    return;
  }

  let nextStepId: string | null = null;
  const outgoing = flow.connections.filter((c) => c.fromStepId === currentStep.id);
  const isQuestion = ["question_multiple", "question_simple", "multipleChoice"].includes(currentStep.type);

  if (isQuestion && outgoing.length > 0) {
    const normalizedReply = replyId.toLowerCase().trim();
    if (currentStep.type === "multipleChoice") {
      const options = JSON.parse(currentStep.configJson).options || [];
      const n = parseInt(normalizedReply, 10);
      if (!isNaN(n) && n >= 1 && n <= options.length) {
        nextStepId = outgoing.find((c) => c.sourceHandle === options[n - 1].id)?.toStepId ?? null;
      }
    }
    if (!nextStepId) {
      for (const conn of outgoing) {
        const handle = conn.sourceHandle?.toLowerCase().trim();
        const label = conn.conditionLabel?.toLowerCase().trim();
        if ((handle && normalizedReply.includes(handle)) || (label && normalizedReply.includes(label))) {
          nextStepId = conn.toStepId;
          break;
        }
      }
    }
    if (!nextStepId) {
      await sendWhatsAppMessage({ to: phoneNumber, message: "Por favor, selecciona una opción válida." });
      return;
    }
  } else {
    nextStepId = outgoing[0]?.toStepId ?? null;
  }

  if (!nextStepId) {
    await prisma.sessionState.update({ where: { sessionId: session.sessionId }, data: { status: "completed" } });
    return;
  }

  const variables = JSON.parse(session.variablesJson || "{}");
  variables.phone = phoneNumber;
  variables.lastReply = replyText;
  variables.contactId = contactId;

  const engine = new FlowEngine(flow, session.sessionId, variables, chatId ?? undefined);
  const actions = await engine.executeFromStep(nextStepId);
  await executeFlowActions(actions, {
    deviceId,
    phoneNumber,
    chatId,
    sessionId: session.sessionId,
    flowName: flow.name,
    inboundText: replyText,
  });
}

import OpenAI from "openai";
import type { AiAgent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAndPersistMessage } from "@/lib/whatsapp-message-service";
import { sendHandoverNotification, sendNewLeadNotification, sendTypingIndicator } from "@/lib/whatsapp-sender";

/**
 * Generic AI agent runtime.
 *
 * Everything business-specific (identity, personality, knowledge, rules,
 * model, fallback, handover number, follow-ups) lives on the AiAgent record
 * and is edited in the UI. This file only contains platform behaviour that
 * applies to every agent.
 *
 * Context isolation: an agent only sees the messages of its own conversation
 * segment, which starts at Chat.aiContextStartedAt (set when a flow activates
 * or changes the agent), and never sees messages written by other agents.
 */

const HISTORY_LIMIT = 50;
const LOCK_STALE_MS = 2 * 60 * 1000;

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Spanish",
  en: "English",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
};

const DEFAULT_FALLBACK: Record<string, string> = {
  es: "Ahora mismo no puedo responder 😅 Inténtalo de nuevo en unos minutos.",
  en: "Sorry, I can't reply right now. Please try again in a few minutes.",
};

export function languageName(code: string) {
  return LANGUAGE_NAMES[code] || code;
}

export function fallbackMessageFor(agent: Pick<AiAgent, "fallbackMessage" | "language">) {
  return agent.fallbackMessage?.trim() || DEFAULT_FALLBACK[agent.language] || DEFAULT_FALLBACK.en;
}

/** Platform rules shared by every agent. Contains no business information. */
function platformRules(agent: AiAgent, contactName: string | null) {
  return `You are an AI assistant chatting with a customer over WhatsApp on behalf of the business described below.

PLATFORM RULES (apply to every conversation):
1. Always reply in ${languageName(agent.language)} unless the customer clearly writes in another language.
2. Write like a human on WhatsApp: short messages (1-3 sentences), at most ONE question per message. Never stack several questions, never simulate the whole conversation, advance one step per customer reply.
3. Read the conversation history first. Never ask again for information the customer or an automated flow already provided; build on it.
4. ${contactName ? `The customer's name is "${contactName}". Use it naturally.` : "You do not know the customer's name. Do not invent one."} Never output placeholders such as {name} or {primer_nombre}.
5. Never show technical markers, JSON, braces or code to the customer.
6. HANDOVER: only when you have gathered what your role requires (or the customer asks for a human), send a warm closing message to the customer and then, in the same reply, append [[HANDOVER]] followed by a single-line JSON object with the data you collected. Everything after [[HANDOVER]] is hidden from the customer.
7. Stay strictly within the business, knowledge and role defined below. If something is not covered, say you will check with the team instead of inventing it.`;
}

export function buildSystemPrompt(agent: AiAgent, contactName: string | null) {
  const sections = [platformRules(agent, contactName), "", "## YOUR ROLE", `Name: ${agent.name}`];
  if (agent.description) sections.push(`Description: ${agent.description}`);
  if (agent.goal) sections.push(`Goal: ${agent.goal}`);
  sections.push(`Tone: ${agent.tone}`);
  sections.push("", "## INSTRUCTIONS AND PERSONALITY", agent.systemPrompt);
  if (agent.knowledge?.trim()) sections.push("", "## BUSINESS KNOWLEDGE", agent.knowledge.trim());
  if (agent.rules?.trim()) sections.push("", "## RULES", agent.rules.trim());
  return sections.join("\n");
}

type HistoryMessage = { sender: string; text: string; agentId: string | null; metadata: string; createdAt: Date };

/** Text the customer actually saw/tapped (button titles instead of internal ids). */
function displayText(msg: HistoryMessage) {
  if (msg.sender !== "contact") return msg.text;
  try {
    const meta = JSON.parse(msg.metadata || "{}");
    return meta.buttonTitle || meta.listItemTitle || msg.text;
  } catch {
    return msg.text;
  }
}

/**
 * Messages visible to an agent: the customer's messages, automated flow/system
 * messages (stored as sender "agent" without agentId), and this agent's own
 * replies. Other agents' replies are never visible.
 */
export function visibleHistory(messages: HistoryMessage[], agentId: string) {
  return messages
    .filter((m) => m.sender === "contact" || m.agentId === null || m.agentId === agentId)
    .map((m) => ({
      role: m.sender === "contact" ? ("user" as const) : ("assistant" as const),
      content: displayText(m) || "",
      fromThisAgent: m.sender !== "contact" && m.agentId === agentId,
    }));
}

export type AgentReply = {
  reply: string;
  agentId: string;
  agentName: string;
  handoverData?: Record<string, unknown>;
  failed?: boolean;
};

let openaiFactory = (apiKey: string) => new OpenAI({ apiKey });
/** Test hook */
export function setOpenAIFactory(factory: (apiKey: string) => Pick<OpenAI, "chat">) {
  openaiFactory = factory as (apiKey: string) => OpenAI;
}

/**
 * Generates the agent's next reply for a chat. When `userMessage` is omitted
 * (e.g. a flow activated the agent for a lead who has not written yet), the
 * agent opens the conversation.
 */
export async function generateAgentReply({
  agentId,
  chatId,
  userMessage,
}: {
  agentId: string;
  chatId?: string | null;
  userMessage?: string | null;
}): Promise<AgentReply> {
  const agent = await prisma.aiAgent.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error(`AI agent not found: ${agentId}`);
  if (!agent.isActive) throw new Error(`AI agent is inactive: ${agent.name}`);

  const chat = chatId
    ? await prisma.chat.findUnique({
        where: { id: chatId },
        select: { id: true, phoneNumber: true, contactName: true, aiContextStartedAt: true, createdAt: true },
      })
    : null;
  const contactName = chat?.contactName && !/^\+?\d+$/.test(chat.contactName) ? chat.contactName : null;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(agent, contactName) },
  ];

  let turnCount = 0;
  if (chat) {
    const since = chat.aiContextStartedAt ?? chat.createdAt;
    const recent = await prisma.message.findMany({
      where: { chatId: chat.id, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { sender: true, text: true, agentId: true, metadata: true, createdAt: true },
    });
    const history = visibleHistory(recent.reverse(), agent.id);
    turnCount = history.filter((m) => m.fromThisAgent).length;
    messages.push(...history.map(({ role, content }) => ({ role, content })));

    // First message from this agent in this chat -> new lead notification (existing behaviour)
    if (turnCount === 0) {
      const everReplied = await prisma.message.count({ where: { chatId: chat.id, agentId: agent.id } });
      if (everReplied === 0) {
        sendNewLeadNotification({
          flowName: agent.name,
          phoneNumber: chat.phoneNumber,
          name: chat.contactName || null,
          email: null,
          source: "whatsapp-ai",
        }).catch((err) => console.error("[AI Agent] New lead notification failed:", err?.message));
      }
    }
  }

  const lastUserTurn = [...messages].reverse().find((m) => m.role === "user");
  if (userMessage && lastUserTurn?.content !== userMessage) {
    messages.push({ role: "user", content: userMessage });
  }
  if (!userMessage && messages[messages.length - 1]?.role !== "user") {
    messages.push({
      role: "system",
      content: "The customer has not written to you yet. Open the conversation now with a short greeting that fits your role.",
    });
  }

  if (turnCount >= agent.maxTurns) {
    messages.push({
      role: "system",
      content: `You have used all ${agent.maxTurns} turns. This MUST be your final message: thank the customer, summarize briefly and hand over (include [[HANDOVER]]).`,
    });
  } else if (turnCount >= agent.maxTurns - 1) {
    messages.push({
      role: "system",
      content: `This is your last turn (${turnCount + 1}/${agent.maxTurns}). Wrap up and hand over; do not ask new questions.`,
    });
  }

  let rawReply: string;
  let failed = false;
  try {
    if (agent.provider !== "openai") throw new Error(`Unsupported AI provider: ${agent.provider}`);
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    const completion = await openaiFactory(process.env.OPENAI_API_KEY).chat.completions.create({
      model: agent.model,
      messages,
      temperature: agent.temperature,
      max_tokens: agent.maxTokens,
    });
    rawReply = completion.choices[0]?.message?.content?.trim() || fallbackMessageFor(agent);
  } catch (error) {
    console.error(`[AI Agent] ${agent.name}: provider call failed:`, (error as Error)?.message);
    rawReply = fallbackMessageFor(agent);
    failed = true;
  }

  const [visiblePart, handoverPart] = rawReply.split("[[HANDOVER]]");
  const reply = visiblePart.trim() || fallbackMessageFor(agent);
  let handoverData: Record<string, unknown> | undefined;

  if (handoverPart !== undefined && chat) {
    const raw = handoverPart.trim();
    try {
      handoverData = JSON.parse(raw);
    } catch {
      handoverData = { _error: "JSON parsing failed", _rawData: raw.slice(0, 500), _agent: agent.name, _timestamp: new Date().toISOString() };
    }
    sendHandoverNotification(handoverData!, chat.phoneNumber, agent.name, agent.handoverPhone || undefined).catch((err) =>
      console.error("[AI Agent] Handover notification failed:", err?.message)
    );
  }

  return { reply, agentId: agent.id, agentName: agent.name, handoverData, failed };
}

function humanDelayMs() {
  if (process.env.AI_HUMAN_DELAY === "off") return 0;
  return 3000 + Math.random() * 7000; // 3-10 s, feels like typing
}

/** Atomically marks the chat as "AI responding"; stale locks expire. */
async function acquireLock(chatId: string) {
  const { count } = await prisma.chat.updateMany({
    where: {
      id: chatId,
      OR: [{ isResponding: false }, { updatedAt: { lt: new Date(Date.now() - LOCK_STALE_MS) } }],
    },
    data: { isResponding: true },
  });
  return count === 1;
}

/**
 * Generates the agent's reply and delivers it on WhatsApp: typing indicator,
 * human-like delay, one WhatsApp message per paragraph, follow-up tracking.
 * Returns false if another reply for this chat is already in progress.
 */
export async function respondWithAgent({
  agentId,
  chatId,
  deviceId,
  phoneNumber,
  userMessage,
}: {
  agentId: string;
  chatId: string;
  deviceId: string;
  phoneNumber: string;
  userMessage?: string | null;
}): Promise<boolean> {
  if (!(await acquireLock(chatId))) {
    console.log(`[AI Agent] Chat ${chatId} already has a reply in progress - skipping`);
    return false;
  }

  try {
    await sendTypingIndicator(phoneNumber, "typing_on").catch(() => undefined);
    const result = await generateAgentReply({ agentId, chatId, userMessage });
    const parts = result.reply.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

    const delay = humanDelayMs();
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await sendTypingIndicator(phoneNumber, "typing_off").catch(() => undefined);

    for (const part of parts) {
      await sendAndPersistMessage({
        deviceId,
        toPhoneNumber: phoneNumber,
        type: "text",
        payload: { text: { body: part } },
        sender: "agent",
        textPreview: part,
        chatId,
        agentId: result.agentId,
      });
    }

    // Follow-up tracking: a new question starts when the customer has replied
    const current = await prisma.chat.findUnique({ where: { id: chatId }, select: { lastQuestionAttempts: true } });
    if (current && current.lastQuestionAttempts === 0 && !result.handoverData) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastQuestionSentAt: new Date(), lastQuestionAttempts: 1, lastQuestionMessageId: null },
      });
    }
    // After a handover the AI stops following up
    if (result.handoverData) {
      await prisma.chat.update({
        where: { id: chatId },
        data: { lastQuestionSentAt: null, lastQuestionAttempts: 0 },
      });
    }
    return true;
  } catch (error) {
    console.error(`[AI Agent] Failed to respond in chat ${chatId}:`, (error as Error)?.message);
    return false;
  } finally {
    await prisma.chat.update({ where: { id: chatId }, data: { isResponding: false } }).catch(() => undefined);
  }
}

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";

/**
 * End-to-end routing tests: signed WhatsApp webhook -> flow trigger ->
 * condition -> "AI agent" action -> agent replies, using the real webhook,
 * flow engine and agent runtime with an in-memory database.
 * Agent names here are deliberately generic: nothing is hard-coded.
 */

const { fake, outbound, openaiCalls, notifications } = vi.hoisted(() => ({
  fake: {} as any,
  outbound: [] as any[],
  openaiCalls: [] as any[],
  notifications: [] as any[],
}));

vi.mock("@/lib/prisma", async () => {
  const { createFakePrisma } = await import("./helpers/fake-prisma");
  Object.assign(fake, createFakePrisma());
  return { prisma: fake };
});

vi.mock("@/lib/whatsapp-message-service", () => ({
  sendAndPersistMessage: vi.fn(async (p: any) => {
    const chat =
      (p.chatId && (await fake.chat.findUnique({ where: { id: p.chatId } }))) ||
      (await fake.chat.findFirst({ where: { phoneNumber: p.toPhoneNumber, deviceId: p.deviceId } }));
    const text = p.textPreview || p.payload?.text?.body || `[${p.type}]`;
    await fake.message.create({
      data: { chatId: chat.id, sender: p.sender === "contact" ? "contact" : "agent", text, agentId: p.agentId ?? null, metadata: JSON.stringify({ sender: p.sender }) },
    });
    outbound.push({ to: p.toPhoneNumber, text, sender: p.sender, agentId: p.agentId ?? null, type: p.type, payload: p.payload });
    return { messages: [{ id: "wamid.test" }] };
  }),
}));

vi.mock("@/lib/whatsapp-sender", () => ({
  sendWhatsAppMessage: vi.fn(async (p: any) => {
    notifications.push({ kind: "direct", ...p });
    return true;
  }),
  sendNewLeadNotification: vi.fn(async () => true),
  sendHandoverNotification: vi.fn(async (...args: any[]) => {
    notifications.push({ kind: "handover", args });
    return true;
  }),
  sendTypingIndicator: vi.fn(async () => true),
  sendOwnerNotification: vi.fn(async () => true),
}));

vi.mock("@/lib/admin-alerts", () => ({ checkAndSendAdminAlert: vi.fn(async () => undefined) }));

const SECRET = "routing-test-app-secret";
let POST: (req: NextRequest) => Promise<Response>;
let agentA: any;
let agentB: any;
let device: any;

function fakeOpenAI(replyFor?: (params: any) => string) {
  return () => ({
    chat: {
      completions: {
        create: async (params: any) => {
          openaiCalls.push(params);
          const name = /Name: (.+)/.exec(params.messages[0].content)?.[1] ?? "?";
          return { choices: [{ message: { content: replyFor ? replyFor(params) : `Reply from ${name}` } }] };
        },
      },
    },
  });
}

beforeAll(async () => {
  process.env.META_APP_SECRET = SECRET;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.AI_HUMAN_DELAY = "off";
  ({ POST } = await import("@/app/api/webhooks/whatsapp/route"));
});

let msgCounter = 0;
async function deliver(message: Record<string, unknown>, from: string, name = "Test Contact") {
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: { metadata: { phone_number_id: "PNID" }, contacts: [{ profile: { name } }], messages: [{ from, id: `wamid.in.${++msgCounter}`, ...message }] } }] }],
  });
  const signature = "sha256=" + createHmac("sha256", SECRET).update(payload).digest("hex");
  const res = await POST(
    new NextRequest("https://funnelchat.test/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature },
      body: payload,
    })
  );
  return res.json();
}
const send = (from: string, text: string) => deliver({ type: "text", text: { body: text } }, from);
const tap = (from: string, id: string, title: string) =>
  deliver({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title } } }, from);

async function makeFlow(name: string, trigger: any, steps: { id: string; type: string; config?: any }[], edges: [string, string, string?][]) {
  const flow = await fake.flow.create({ data: { name, key: name.toLowerCase().replace(/\W/g, "-") } });
  const ids: Record<string, string> = {};
  for (const step of [{ id: "start", type: "start", config: { trigger } }, ...steps]) {
    const row = await fake.flowStep.create({
      data: { flowId: flow.id, type: step.type, label: step.id, configJson: JSON.stringify(step.config ?? {}) },
    });
    ids[step.id] = row.id;
  }
  for (const [from, to, handle] of edges) {
    await fake.flowConnection.create({
      data: { flowId: flow.id, fromStepId: ids[from], toStepId: ids[to], sourceHandle: handle ?? null, conditionLabel: null },
    });
  }
  return flow;
}

const chatOf = (phone: string) => fake.chat.findFirst({ where: { phoneNumber: phone } });
const repliesTo = (phone: string) => outbound.filter((m) => m.to === phone);
const lastPrompt = () => openaiCalls[openaiCalls.length - 1];
const promptText = (call: any) => call.messages.map((m: any) => `${m.role}: ${m.content}`).join("\n");

beforeEach(async () => {
  for (const key of Object.keys(fake._tables)) fake._tables[key].length = 0;
  outbound.length = 0;
  openaiCalls.length = 0;
  notifications.length = 0;
  const runtime = await import("@/lib/ai/agent-runtime");
  runtime.setOpenAIFactory(fakeOpenAI() as any);

  device = await fake.device.create({ data: { name: "Main", whatsappPhoneNumberId: "PNID", isConnected: true } });
  agentA = await fake.aiAgent.create({
    data: {
      name: "Agent Alpha",
      systemPrompt: "You are Alpha. ALPHA_PERSONALITY",
      knowledge: "ALPHA_KNOWLEDGE",
      rules: "ALPHA_RULES",
      model: "gpt-4o",
      temperature: 0.2,
      maxTokens: 321,
      language: "en",
    },
  });
  agentB = await fake.aiAgent.create({ data: { name: "Agent Beta", systemPrompt: "You are Beta. BETA_PERSONALITY", knowledge: "BETA_KNOWLEDGE" } });

  // Router: incoming message -> condition -> Activate agent A / B (keywords are flow config)
  await makeFlow(
    "Router",
    { type: "message_received", matchMode: "contains", keywords: ["alpha", "beta"] },
    [
      { id: "isAlpha", type: "condition", config: { conditions: [{ type: "message", operator: "contains", value: "alpha" }] } },
      { id: "isBeta", type: "condition", config: { conditions: [{ type: "message", operator: "contains", value: "beta" }] } },
      { id: "activateA", type: "ai_agent", config: { aiAction: "activate", agentId: agentA.id, respondNow: true } },
      { id: "activateB", type: "ai_agent", config: { aiAction: "activate", agentId: agentB.id, respondNow: true } },
    ],
    [
      ["start", "isAlpha"],
      ["isAlpha", "activateA", "cumple"],
      ["isAlpha", "isBeta", "no_cumple"],
      ["isBeta", "activateB", "cumple"],
    ]
  );
  // Stop flow: hands the conversation back to humans
  await makeFlow(
    "Handoff",
    { type: "message_received", matchMode: "exact", keywords: ["human"] },
    [{ id: "stopAi", type: "ai_agent", config: { aiAction: "stop", stopMessage: "A teammate will reply soon" } }],
    [["start", "stopAi"]]
  );
});

describe("flow-driven agent routing", () => {
  it("a flow condition activates agent A, and later messages keep going to A", async () => {
    await send("111", "Hi, I want ALPHA info");
    let chat = await chatOf("111");
    expect(chat.assignedAgentType).toBe("AI");
    expect(chat.assignedAgentId).toBe(agentA.id);
    expect(repliesTo("111").map((m) => m.text)).toEqual(["Reply from Agent Alpha"]);
    expect(repliesTo("111")[0].agentId).toBe(agentA.id);

    // No keyword: the active agent answers, no flow runs
    const status = await send("111", "What courses do you have?");
    expect(status.status).toBe("ai agent replied");
    expect(repliesTo("111").map((m) => m.text)).toEqual(["Reply from Agent Alpha", "Reply from Agent Alpha"]);
    chat = await chatOf("111");
    expect(chat.assignedAgentId).toBe(agentA.id);
    expect(openaiCalls.every((c) => c.messages[0].content.includes("Name: Agent Alpha"))).toBe(true);
  });

  it("the other branch of the same flow activates agent B for another contact", async () => {
    await send("222", "beta please");
    expect((await chatOf("222")).assignedAgentId).toBe(agentB.id);
    expect(repliesTo("222").map((m) => m.text)).toEqual(["Reply from Agent Beta"]);
  });

  it("no matching trigger and no agent: message is stored, nothing is sent", async () => {
    const res = await send("333", "hello there");
    expect(res.status).toBe("processed");
    expect(outbound).toHaveLength(0);
    expect(openaiCalls).toHaveLength(0);
    expect(await fake.message.count({ where: { chatId: (await chatOf("333")).id } })).toBe(1);
  });

  it("each agent uses its own configuration (prompt, knowledge, rules, model settings)", async () => {
    await send("111", "alpha");
    const call = lastPrompt();
    expect(call.model).toBe("gpt-4o");
    expect(call.temperature).toBe(0.2);
    expect(call.max_tokens).toBe(321);
    const system = call.messages[0].content;
    expect(system).toContain("ALPHA_PERSONALITY");
    expect(system).toContain("ALPHA_KNOWLEDGE");
    expect(system).toContain("ALPHA_RULES");
    expect(system).toContain("Always reply in English");
    expect(system).not.toContain("BETA");
  });

  it("while an agent is active, partial keyword matches do not hijack the conversation", async () => {
    await send("111", "alpha");
    const res = await send("111", "my friend talked about beta testing");
    expect(res.status).toBe("ai agent replied");
    expect((await chatOf("111")).assignedAgentId).toBe(agentA.id);
  });

  it("an exact keyword switches agents and the new agent gets an isolated context", async () => {
    await send("111", "alpha");
    await send("111", "secret alpha detail");
    const res = await send("111", "BETA");
    expect(res.status).toBe("flow started");
    expect((await chatOf("111")).assignedAgentId).toBe(agentB.id);

    const betaCall = lastPrompt();
    const seen = promptText(betaCall);
    expect(betaCall.messages[0].content).toContain("Name: Agent Beta");
    expect(seen).toContain("BETA"); // the message that routed here
    expect(seen).not.toContain("secret alpha detail"); // earlier business context
    expect(seen).not.toContain("Reply from Agent Alpha"); // other agent's replies
    expect(repliesTo("111").at(-1)).toMatchObject({ text: "Reply from Agent Beta", agentId: agentB.id });
  });

  it("a Stop AI Agent action returns the conversation to manual handling", async () => {
    await send("111", "alpha");
    await send("111", "human");
    const chat = await chatOf("111");
    expect(chat.assignedAgentType).toBeNull();
    expect(chat.assignedAgentId).toBeNull();
    expect(repliesTo("111").at(-1)).toMatchObject({ text: "A teammate will reply soon", sender: "flow" });

    const before = openaiCalls.length;
    const res = await send("111", "anyone there?");
    expect(res.status).toBe("processed");
    expect(openaiCalls).toHaveLength(before);
  });

  it("button menus can route to agents (flow waits for the tap, then activates)", async () => {
    await makeFlow(
      "Menu",
      { type: "message_received", matchMode: "all" },
      [
        { id: "menu", type: "multipleChoice", config: { message: "Which one?", options: [{ id: "opt-a", title: "Alpha" }, { id: "opt-b", title: "Beta" }] } },
        { id: "toA", type: "ai_agent", config: { aiAction: "activate", agentId: agentA.id } },
        { id: "toB", type: "ai_agent", config: { aiAction: "activate", agentId: agentB.id } },
      ],
      [
        ["start", "menu"],
        ["menu", "toA", "opt-a"],
        ["menu", "toB", "opt-b"],
      ]
    );
    await send("444", "hello");
    expect(repliesTo("444")[0]).toMatchObject({ type: "interactive" });

    await tap("444", "opt-b", "Beta");
    expect((await chatOf("444")).assignedAgentId).toBe(agentB.id);
    const call = lastPrompt();
    // The agent sees the button title, not the internal option id
    expect(promptText(call)).toContain("user: Beta");
    expect(promptText(call)).not.toContain("opt-b");

    // The catch-all menu flow does not hijack the active agent
    const res = await send("444", "tell me more");
    expect(res.status).toBe("ai agent replied");
  });

  it("only one flow starts when several match (exact beats contains)", async () => {
    await makeFlow(
      "Exact beta",
      { type: "message_received", matchMode: "exact", keywords: ["beta"] },
      [{ id: "msg", type: "send_message", config: { type: "text", text: "EXACT FLOW" } }],
      [["start", "msg"]]
    );
    await send("555", "beta");
    expect(repliesTo("555").map((m) => m.text)).toEqual(["EXACT FLOW"]);
    expect((await chatOf("555")).assignedAgentId).toBeNull();
  });

  it("customer phrases can no longer erase history (old reset backdoor removed)", async () => {
    await send("111", "alpha");
    const before = await fake.message.count({ where: { chatId: (await chatOf("111")).id } });
    for (const phrase of ["claudia reset", "reset maria", "borrar memoria", "reset chat", "restart ai"]) {
      const res = await send("111", phrase);
      expect(res.status).not.toBe("reset successful");
    }
    const after = await fake.message.count({ where: { chatId: (await chatOf("111")).id } });
    expect(after).toBeGreaterThan(before);
    expect((await chatOf("111")).assignedAgentId).toBe(agentA.id);
  });

  it("the provider failing sends the agent's configured fallback message", async () => {
    await fake.aiAgent.update({ where: { id: agentA.id }, data: { fallbackMessage: "ALPHA_FALLBACK" } });
    const runtime = await import("@/lib/ai/agent-runtime");
    runtime.setOpenAIFactory((() => ({ chat: { completions: { create: async () => { throw new Error("boom"); } } } })) as any);
    await send("111", "alpha");
    expect(repliesTo("111").at(-1)?.text).toBe("ALPHA_FALLBACK");
  });

  it("[[HANDOVER]] data is hidden from the customer and sent to the agent's handover number", async () => {
    await fake.aiAgent.update({ where: { id: agentA.id }, data: { handoverPhone: "34600111222" } });
    const runtime = await import("@/lib/ai/agent-runtime");
    runtime.setOpenAIFactory(fakeOpenAI(() => 'Thanks, a person will call you.\n\n[[HANDOVER]]{"goal":"x"}') as any);
    await send("111", "alpha");
    expect(repliesTo("111").map((m) => m.text)).toEqual(["Thanks, a person will call you."]);
    const handover = notifications.find((n) => n.kind === "handover");
    expect(handover.args[0]).toEqual({ goal: "x" });
    expect(handover.args[3]).toBe("34600111222");
  });

  it("inactive or missing agents are skipped safely", async () => {
    await fake.aiAgent.update({ where: { id: agentA.id }, data: { isActive: false } });
    await send("111", "alpha");
    expect((await chatOf("111")).assignedAgentId).toBeNull();
    expect(openaiCalls).toHaveLength(0);
  });
});

describe("admin controls", () => {
  it("reset-ai gives the agent a fresh context without deleting history", async () => {
    await send("111", "alpha");
    await send("111", "old detail to forget");
    const chat = await chatOf("111");
    const { POST: reset } = await import("@/app/api/chats/[id]/reset-ai/route");
    const res = await reset(new NextRequest("https://x/api/chats/x/reset-ai", { method: "POST" }), { params: Promise.resolve({ id: chat.id }) });
    expect(res.status).toBe(200);

    await send("111", "new question");
    const seen = promptText(lastPrompt());
    expect(seen).toContain("new question");
    expect(seen).not.toContain("old detail to forget");
    expect(await fake.message.count({ where: { chatId: chat.id, text: "old detail to forget" } })).toBe(1);
  });

  it("PATCH lets an admin switch or remove the conversation's agent", async () => {
    await send("111", "alpha");
    const chat = await chatOf("111");
    const { PATCH } = await import("@/app/api/chats/[id]/route");
    const patch = (body: unknown) =>
      PATCH(new NextRequest("https://x/api/chats/x", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), {
        params: Promise.resolve({ id: chat.id }),
      });

    const switched = await (await patch({ agentId: agentB.id })).json();
    expect(switched).toMatchObject({ assignedAgentId: agentB.id, agentName: "Agent Beta" });
    await send("111", "next message");
    expect(repliesTo("111").at(-1)).toMatchObject({ agentId: agentB.id });

    await patch({ agentId: null });
    const res = await send("111", "and now?");
    expect(res.status).toBe("processed");
  });
});

describe("lead-triggered flows", () => {
  it("an activated agent opens the conversation when the lead has not written yet", async () => {
    const flow = await makeFlow(
      "Lead",
      { type: "third_party" },
      [{ id: "act", type: "ai_agent", config: { aiAction: "activate", agentId: agentB.id } }],
      [["start", "act"]]
    );
    const chat = await fake.chat.create({ data: { phoneNumber: "666", deviceId: device.id } });
    const { startFlow } = await import("@/lib/flow/flow-runtime");
    const graph = await fake.flow.findUnique({ where: { id: flow.id }, include: { steps: true, connections: true } });
    await startFlow({ flow: graph, phoneNumber: "666", contactId: null, deviceId: device.id, chatId: chat.id, inboundText: null });
    expect(repliesTo("666").map((m) => m.text)).toEqual(["Reply from Agent Beta"]);
    expect(promptText(lastPrompt())).toContain("has not written to you yet");
  });
});

describe("follow-ups use each agent's own settings", () => {
  it("sends one of the agent's configured messages after its delay, and none when disabled", async () => {
    const { checkAndSendFollowup } = await import("@/lib/followup-service");
    await fake.aiAgent.update({ where: { id: agentA.id }, data: { followupMessages: "ALPHA_FOLLOWUP", followupDelayMinutes: 5 } });
    await send("111", "alpha");
    const chat = await chatOf("111");
    await fake.chat.update({ where: { id: chat.id }, data: { lastQuestionSentAt: new Date(Date.now() - 3 * 60_000), lastUserReplyAt: null, lastQuestionAttempts: 1 } });
    expect(await checkAndSendFollowup(chat.id)).toBe(false); // 3 min < 5 min

    await fake.chat.update({ where: { id: chat.id }, data: { lastQuestionSentAt: new Date(Date.now() - 6 * 60_000) } });
    // Only the agent's reply since the last customer message -> under the safety guard
    expect(await checkAndSendFollowup(chat.id)).toBe(true);
    expect(repliesTo("111").at(-1)).toMatchObject({ text: "ALPHA_FOLLOWUP", agentId: agentA.id });

    await fake.aiAgent.update({ where: { id: agentA.id }, data: { followupEnabled: false } });
    await fake.chat.update({ where: { id: chat.id }, data: { lastQuestionAttempts: 1 } });
    expect(await checkAndSendFollowup(chat.id)).toBe(false);
  });
});

describe("no business routing is hard-coded", () => {
  const ROOT = path.resolve(__dirname, "..");
  const files = [
    "app/api/webhooks/whatsapp/route.ts",
    "app/api/ai-agent/route.ts",
    "lib/flow/flow-runtime.ts",
    "lib/flow/triggers.ts",
    "lib/flow/conditions.ts",
    "lib/ai/agent-runtime.ts",
    "lib/runtime-engine.ts",
    "lib/followup-service.ts",
  ];
  for (const file of files) {
    it(file, () => {
      const src = fs.readFileSync(path.join(ROOT, file), "utf8");
      // Business / agent names
      for (const word of ["dlfitness", "englishacker", "claudia", "maria", "franquicia", "benalua"]) {
        expect(src.toLowerCase().includes(word), `${file} mentions "${word}"`).toBe(false);
      }
      // Routing keywords as string literals
      expect(src, `${file} hard-codes a routing keyword`).not.toMatch(/["'`](english|fitness|ENGLISH|FITNESS|ingl[eé]s)["'`]/);
    });
  }
});

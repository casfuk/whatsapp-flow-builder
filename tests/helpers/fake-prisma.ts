/**
 * Minimal in-memory stand-in for the Prisma client, covering the queries used
 * by the WhatsApp routing pipeline. Good enough to run the real webhook,
 * flow engine and agent runtime end to end in tests.
 */

type Row = Record<string, any>;

let clock = Date.parse("2026-01-01T10:00:00Z");
export const tick = () => new Date((clock += 1000));

const COMPOSITE_KEYS: Record<string, string[]> = {
  phone_device: ["phone", "deviceId"],
  phoneNumber_deviceId: ["phoneNumber", "deviceId"],
  contactId_customFieldId: ["contactId", "customFieldId"],
};

function isPlainObject(v: unknown): v is Row {
  return v !== null && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v);
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Row[]).some((c) => matches(row, c));
    if (key === "AND") return (cond as Row[]).every((c) => matches(row, c));
    if (COMPOSITE_KEYS[key]) return COMPOSITE_KEYS[key].every((f) => row[f] === cond[f]);
    const value = row[key];
    if (isPlainObject(cond)) {
      return Object.entries(cond).every(([op, arg]) => {
        switch (op) {
          case "startsWith":
            return typeof value === "string" && value.startsWith(arg as string);
          case "not":
            return value !== arg;
          case "gte":
            return value >= (arg as any);
          case "lt":
            return value < (arg as any);
          case "in":
            return (arg as unknown[]).includes(value);
          case "equals":
            return value === arg;
          default:
            throw new Error(`fake-prisma: unsupported operator ${op}`);
        }
      });
    }
    return value === cond;
  });
}

function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (isPlainObject(value) && "increment" in value) row[key] = (row[key] ?? 0) + (value.increment as number);
    else if (value !== undefined) row[key] = value;
  }
  if ("updatedAt" in row) row.updatedAt = tick();
  return row;
}

let idCounter = 0;
const newId = (prefix: string) => `${prefix}_${++idCounter}`;

const DEFAULTS: Record<string, () => Row> = {
  chat: () => ({
    unreadCount: 0,
    status: "open",
    tags: "[]",
    isFavorite: false,
    isResponding: false,
    assignedToUserId: null,
    assignedAgentType: null,
    assignedAgentId: null,
    lastQuestionSentAt: null,
    lastQuestionAttempts: 0,
    lastQuestionMessageId: null,
    lastUserReplyAt: null,
    aiDisabled: false,
    perAgentTurnCount: "{}",
    aiContextStartedAt: null,
    contactName: null,
  }),
  message: () => ({ status: "sent", messageId: null, metadata: "{}", agentId: null }),
  sessionState: () => ({ currentStepId: null, variablesJson: "{}", status: "active", assigneeId: null, aiTurnCount: 0, assigneeType: null }),
  contact: () => ({ name: null, email: null, metadata: "{}", profileImageUrl: null }),
  flow: () => ({ isActive: true, executions: 0, description: null }),
  aiAgent: () => ({
    description: null,
    language: "es",
    tone: "professional",
    goal: null,
    maxTurns: 20,
    isActive: true,
    provider: "openai",
    model: "gpt-4o-mini",
    temperature: 0.7,
    maxTokens: 500,
    knowledge: null,
    rules: null,
    fallbackMessage: null,
    handoverPhone: null,
    followupEnabled: true,
    followupDelayMinutes: 2,
    followupMessages: null,
  }),
};

function model(name: string, tables: Record<string, Row[]>) {
  const table = () => (tables[name] ??= []);
  const sorted = (rows: Row[], orderBy?: Row) => {
    if (!orderBy) return rows;
    const [[field, dir]] = Object.entries(orderBy);
    return [...rows].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (dir === "desc" ? -1 : 1));
  };
  const withIncludes = (row: Row | undefined, include?: Row) => {
    if (!row || !include) return row ?? null;
    const out = { ...row };
    if (include.steps) out.steps = (tables.flowStep ?? []).filter((s) => s.flowId === row.id);
    if (include.connections) out.connections = (tables.flowConnection ?? []).filter((c) => c.flowId === row.id);
    if (include.messages) {
      const opts = include.messages === true ? {} : include.messages;
      let msgs = sorted((tables.message ?? []).filter((m) => m.chatId === row.id), opts.orderBy);
      if (opts.take) msgs = msgs.slice(0, opts.take);
      out.messages = msgs;
    }
    return out;
  };
  const create = ({ data }: { data: Row }) => {
    const now = tick();
    const row = { ...(DEFAULTS[name]?.() ?? {}), id: newId(name), createdAt: now, updatedAt: now, ...data };
    table().push(row);
    return { ...row };
  };
  return {
    findMany: async ({ where, orderBy, take, include }: Row = {}) => {
      let rows = sorted(table().filter((r) => matches(r, where)), orderBy);
      if (take) rows = rows.slice(0, take);
      return rows.map((r) => withIncludes(r, include));
    },
    findFirst: async ({ where, orderBy, include }: Row = {}) =>
      withIncludes(sorted(table().filter((r) => matches(r, where)), orderBy)[0], include),
    findUnique: async ({ where, include }: Row) => withIncludes(table().find((r) => matches(r, where)), include),
    count: async ({ where }: Row = {}) => table().filter((r) => matches(r, where)).length,
    create: async (args: { data: Row }) => create(args),
    update: async ({ where, data }: Row) => {
      const row = table().find((r) => matches(r, where));
      if (!row) throw new Error(`fake-prisma: ${name} not found`);
      return { ...applyData(row, data) };
    },
    updateMany: async ({ where, data }: Row) => {
      const rows = table().filter((r) => matches(r, where));
      rows.forEach((r) => applyData(r, data));
      return { count: rows.length };
    },
    upsert: async ({ where, create: createData, update }: Row) => {
      const row = table().find((r) => matches(r, where));
      if (row) return { ...applyData(row, update) };
      return create({ data: createData });
    },
    deleteMany: async ({ where }: Row = {}) => {
      const before = table().length;
      tables[name] = table().filter((r) => !matches(r, where));
      return { count: before - tables[name].length };
    },
    _rows: table,
  };
}

export function createFakePrisma() {
  const tables: Record<string, Row[]> = {};
  const names = [
    "device", "contact", "chat", "message", "messageLog", "sessionState", "flow", "flowStep",
    "flowConnection", "aiAgent", "debugAction", "settings", "formAnswer", "contactCustomFieldValue",
    "whatsAppConfig", "contactTag", "tag",
  ];
  const client: Record<string, any> = { _tables: tables };
  for (const n of names) client[n] = model(n, tables);
  return client as Record<string, ReturnType<typeof model>> & { _tables: Record<string, Row[]> };
}

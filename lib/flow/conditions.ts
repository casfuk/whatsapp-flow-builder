import { prisma } from "@/lib/prisma";

/**
 * Condition node evaluation. A condition node passes ("cumple") when ALL of
 * its conditions pass. Everything is configured in the flow builder; nothing
 * here knows about specific businesses or keywords.
 */

export type FlowCondition = {
  type: "tag" | "weekday" | "time" | "message";
  operator: string;
  value: string;
};

export type ConditionContext = {
  /** Latest message from the contact (text they typed or button they tapped) */
  message?: string | null;
  contactId?: string | null;
  phone?: string | null;
  now?: Date;
  timeZone?: string;
};

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Lowercase, trim, collapse spaces and strip accents so "Información" matches "informacion". */
export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "info, información" -> ["info", "informacion"] (any of them may match) */
function alternatives(value: string) {
  return value.split(",").map(normalizeText).filter(Boolean);
}

export function evaluateMessageCondition(operator: string, message: string | null | undefined, value: string) {
  const text = normalizeText(message);
  const options = alternatives(value);
  if (options.length === 0) return false;
  switch (operator) {
    case "contains":
      return options.some((o) => text.includes(o));
    case "not_contains":
      return !options.some((o) => text.includes(o));
    case "starts_with":
      return options.some((o) => text.startsWith(o));
    case "equals":
    case "is":
      return options.some((o) => text === o);
    case "not_equals":
    case "is_not":
      return !options.some((o) => text === o);
    default:
      return false;
  }
}

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayIndex = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(get("weekday"));
  return { weekday: WEEKDAYS[weekdayIndex], minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

async function contactHasTag(ctx: ConditionContext, tagName: string) {
  const where = ctx.contactId ? { id: ctx.contactId } : ctx.phone ? { phone: ctx.phone } : null;
  if (!where) return false;
  const contact = await prisma.contact.findFirst({
    where,
    select: { tags: { select: { tag: { select: { name: true } } } } },
  });
  const wanted = normalizeText(tagName);
  return !!contact?.tags.some((t) => normalizeText(t.tag.name) === wanted);
}

export async function evaluateCondition(condition: FlowCondition, ctx: ConditionContext): Promise<boolean> {
  const negate = condition.operator === "is_not";
  switch (condition.type) {
    case "message":
      return evaluateMessageCondition(condition.operator, ctx.message, condition.value);
    case "tag": {
      const has = await contactHasTag(ctx, condition.value);
      return negate ? !has : has;
    }
    case "weekday": {
      const { weekday } = localParts(ctx.now ?? new Date(), ctx.timeZone ?? defaultTimeZone());
      const same = weekday === normalizeText(condition.value) || normalizeText(weekday) === normalizeText(condition.value);
      return negate ? !same : same;
    }
    case "time": {
      const [h, m] = condition.value.split(":").map(Number);
      if (!Number.isFinite(h)) return false;
      const target = h * 60 + (m || 0);
      const { minutes } = localParts(ctx.now ?? new Date(), ctx.timeZone ?? defaultTimeZone());
      // "after" (legacy "is"): from that time onwards; "before" (legacy "is_not"): earlier than it
      return condition.operator === "before" || condition.operator === "is_not" ? minutes < target : minutes >= target;
    }
    default:
      return false;
  }
}

export async function evaluateConditions(conditions: FlowCondition[] | undefined, ctx: ConditionContext) {
  if (!conditions || conditions.length === 0) return false;
  for (const condition of conditions) {
    if (!(await evaluateCondition(condition, ctx))) return false;
  }
  return true;
}

export function defaultTimeZone() {
  return process.env.FLOW_TIMEZONE || "Europe/Madrid";
}

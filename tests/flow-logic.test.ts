import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { evaluateCondition, evaluateMessageCondition, normalizeText } from "@/lib/flow/conditions";
import { matchTrigger, rankMatchingFlows } from "@/lib/flow/triggers";

describe("message conditions", () => {
  it("normalizes case, spaces and accents", () => {
    expect(normalizeText("  Información   Útil ")).toBe("informacion util");
  });

  it.each([
    ["contains", "I want INFO now", "info", true],
    ["contains", "hello", "info", false],
    ["starts_with", "Info please", "info", true],
    ["starts_with", "more info", "info", false],
    ["equals", " INFO ", "info", true],
    ["equals", "info please", "info", false],
    ["not_contains", "hello", "info", true],
    ["contains", "precio por favor", "precios, precio", true], // comma-separated alternatives
    ["contains", "Información", "informacion", true],
  ])("%s(%j, %j) = %s", (op, message, value, expected) => {
    expect(evaluateMessageCondition(op, message, value)).toBe(expected);
  });
});

describe("weekday and time conditions use the flow time zone", () => {
  // 2026-10-20 is a Tuesday; 22:30 UTC = 00:30 Wednesday in Madrid
  const now = new Date("2026-10-20T22:30:00Z");

  it("weekday", async () => {
    expect(await evaluateCondition({ type: "weekday", operator: "is", value: "Miércoles" }, { now, timeZone: "Europe/Madrid" })).toBe(true);
    expect(await evaluateCondition({ type: "weekday", operator: "is", value: "Martes" }, { now, timeZone: "UTC" })).toBe(true);
    expect(await evaluateCondition({ type: "weekday", operator: "is_not", value: "Martes" }, { now, timeZone: "Europe/Madrid" })).toBe(true);
  });

  it("time after / before", async () => {
    const ctx = { now: new Date("2026-10-20T08:15:00Z"), timeZone: "Europe/Madrid" }; // 10:15 local
    expect(await evaluateCondition({ type: "time", operator: "after", value: "09:00" }, ctx)).toBe(true);
    expect(await evaluateCondition({ type: "time", operator: "before", value: "09:00" }, ctx)).toBe(false);
    expect(await evaluateCondition({ type: "time", operator: "before", value: "18:00" }, ctx)).toBe(true);
  });
});

describe("trigger matching", () => {
  const flow = (id: string, trigger: object, createdAt = "2026-01-01") => ({
    id,
    createdAt: new Date(createdAt),
    steps: [{ type: "start", configJson: JSON.stringify({ trigger: { type: "message_received", ...trigger } }) }],
  });

  it("supports contains, starts_with, exact and all", () => {
    expect(matchTrigger({ type: "message_received", matchMode: "contains", keywords: ["promo"] }, "the PROMO code")).toBeTruthy();
    expect(matchTrigger({ type: "message_received", matchMode: "starts_with", keywords: ["promo"] }, "promo code")).toBeTruthy();
    expect(matchTrigger({ type: "message_received", matchMode: "starts_with", keywords: ["promo"] }, "my promo")).toBeNull();
    expect(matchTrigger({ type: "message_received", matchMode: "exact", keywords: ["promo"] }, "promo!")).toBeNull();
    expect(matchTrigger({ type: "message_received", matchMode: "all" }, "anything")).toBeTruthy();
    expect(matchTrigger({ type: "message_received", matchMode: "contains", keywords: [] }, "x")).toBeNull();
  });

  it("ranks best match first and is deterministic", () => {
    const flows = [
      flow("catchall", { matchMode: "all" }),
      flow("contains", { matchMode: "contains", keywords: ["book"] }),
      flow("longer", { matchMode: "contains", keywords: ["book trial"] }, "2026-02-01"),
      flow("starts", { matchMode: "starts_with", keywords: ["book"] }),
    ];
    expect(rankMatchingFlows(flows, "book trial today").map((m) => m.flow.id)).toEqual(["starts", "longer", "contains", "catchall"]);
  });

  it("with an active agent only exact keyword messages qualify; waiting flows ignore catch-alls", () => {
    const flows = [flow("catchall", { matchMode: "all" }), flow("contains", { matchMode: "contains", keywords: ["book"] })];
    expect(rankMatchingFlows(flows, "I want to book", { aiActive: true })).toHaveLength(0);
    expect(rankMatchingFlows(flows, "Book", { aiActive: true }).map((m) => m.flow.id)).toEqual(["contains"]);
    expect(rankMatchingFlows(flows, "anything", { waitingForReply: true })).toHaveLength(0);
  });

  it("ignores flows without a message trigger or with broken config", () => {
    const broken = { id: "b", createdAt: new Date(), steps: [{ type: "start", configJson: "{not json" }] };
    const none = { id: "n", createdAt: new Date(), steps: [{ type: "start", configJson: JSON.stringify({ trigger: { type: "none" } }) }] };
    expect(rankMatchingFlows([broken, none], "hello")).toHaveLength(0);
  });
});

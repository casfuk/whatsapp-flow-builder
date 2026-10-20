import { normalizeText } from "./conditions";

/**
 * Matching of inbound WhatsApp messages against the "message received"
 * triggers configured on flows. The keywords come entirely from the flows
 * built in the UI.
 *
 * Exactly ONE flow is started per message: the best match wins
 * (exact > starts with > contains > catch-all, then the longest keyword,
 * then the oldest flow), so overlapping flows never run in parallel.
 */

export type MatchMode = "contains" | "exact" | "starts_with" | "all";

export type MessageTrigger = {
  type: "message_received";
  matchMode?: MatchMode;
  keywords?: string[];
  oncePerContact?: boolean;
};

type FlowLike = {
  id: string;
  createdAt: Date;
  steps: { type: string; configJson: string }[];
};

export type TriggerMatch<F> = { flow: F; trigger: MessageTrigger; score: number; keywordLength: number };

const MODE_SCORE: Record<MatchMode, number> = { exact: 3, starts_with: 2, contains: 1, all: 0 };

export function getMessageTrigger(flow: FlowLike): MessageTrigger | null {
  const start = flow.steps.find((s) => s.type === "start");
  if (!start) return null;
  try {
    const trigger = JSON.parse(start.configJson)?.trigger;
    return trigger?.type === "message_received" ? trigger : null;
  } catch {
    return null;
  }
}

/** Returns the best keyword match for one trigger, or null. */
export function matchTrigger(trigger: MessageTrigger, message: string): { score: number; keywordLength: number } | null {
  const mode: MatchMode = trigger.matchMode ?? "contains";
  if (mode === "all") return { score: MODE_SCORE.all, keywordLength: 0 };

  const text = normalizeText(message);
  let best: { score: number; keywordLength: number } | null = null;
  for (const raw of trigger.keywords ?? []) {
    const keyword = normalizeText(raw);
    if (!keyword) continue;
    // A message equal to a keyword is always an exact match; flows explicitly
    // set to "exact" win ties against other modes
    let score = -1;
    if (text === keyword) score = MODE_SCORE.exact + (mode === "exact" ? 0.5 : 0);
    else if (mode === "starts_with" && text.startsWith(keyword)) score = MODE_SCORE.starts_with;
    else if (mode === "contains" && text.includes(keyword)) score = MODE_SCORE.contains;
    if (score < 0) continue;
    if (!best || score > best.score || (score === best.score && keyword.length > best.keywordLength)) {
      best = { score, keywordLength: keyword.length };
    }
  }
  return best;
}

/**
 * All flows whose trigger matches, best first.
 * - aiActive: an AI agent is handling the chat; only a message that is exactly
 *   one of a flow's keywords may interrupt it (no partial or catch-all matches).
 * - waitingForReply: a flow is waiting for an answer; catch-all flows must not
 *   hijack the answer.
 */
export function rankMatchingFlows<F extends FlowLike>(
  flows: F[],
  message: string,
  opts: { aiActive?: boolean; waitingForReply?: boolean } = {}
): TriggerMatch<F>[] {
  const matches: TriggerMatch<F>[] = [];
  for (const flow of flows) {
    const trigger = getMessageTrigger(flow);
    if (!trigger) continue;
    const match = matchTrigger(trigger, message);
    if (!match) continue;
    if (opts.aiActive && match.score < MODE_SCORE.exact) continue;
    if (opts.waitingForReply && match.score === MODE_SCORE.all) continue;
    matches.push({ flow, trigger, ...match });
  }
  return matches.sort(
    (a, b) =>
      b.score - a.score ||
      b.keywordLength - a.keywordLength ||
      a.flow.createdAt.getTime() - b.flow.createdAt.getTime()
  );
}

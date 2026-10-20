/**
 * Validation for AI agent configuration coming from the admin UI/API.
 */

export const AI_PROVIDERS = ["openai"] as const;
export const AI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"] as const;
export const AGENT_LANGUAGES = ["es", "en", "pt", "fr", "de", "it"] as const;

type Result = { data: Record<string, unknown>; errors: string[] };

const optionalText = (v: unknown, max: number) =>
  v === undefined ? undefined : v === null || v === "" ? null : String(v).slice(0, max);

/**
 * Validates agent fields. With `partial`, only provided fields are checked
 * (updates); otherwise name and systemPrompt are required (create).
 */
export function parseAgentInput(body: Record<string, unknown>, { partial }: { partial: boolean }): Result {
  const errors: string[] = [];
  const data: Record<string, unknown> = {};
  const has = (k: string) => body[k] !== undefined;

  if (!partial || has("name")) {
    const name = String(body.name ?? "").trim();
    if (!name) errors.push("El nombre es obligatorio");
    else data.name = name.slice(0, 100);
  }
  if (!partial || has("systemPrompt")) {
    const prompt = String(body.systemPrompt ?? "").trim();
    if (!prompt) errors.push("Las instrucciones (system prompt) son obligatorias");
    else data.systemPrompt = prompt.slice(0, 20000);
  }

  for (const [key, max] of [
    ["description", 500],
    ["goal", 2000],
    ["knowledge", 50000],
    ["rules", 20000],
    ["fallbackMessage", 1000],
    ["followupMessages", 5000],
  ] as const) {
    const value = optionalText(body[key], max);
    if (value !== undefined) data[key] = value;
  }

  if (has("tone")) data.tone = String(body.tone).slice(0, 50) || "professional";

  if (has("language")) {
    if (!AGENT_LANGUAGES.includes(body.language as never)) errors.push("Idioma no soportado");
    else data.language = body.language;
  }
  if (has("provider")) {
    if (!AI_PROVIDERS.includes(body.provider as never)) errors.push("Proveedor de IA no soportado");
    else data.provider = body.provider;
  }
  if (has("model")) {
    const model = String(body.model).trim();
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(model)) errors.push("Modelo no válido");
    else data.model = model;
  }

  const numberField = (key: string, min: number, max: number, integer = true) => {
    if (!has(key)) return;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
      errors.push(`${key} debe estar entre ${min} y ${max}`);
    } else data[key] = n;
  };
  numberField("maxTurns", 1, 50);
  numberField("temperature", 0, 2, false);
  numberField("maxTokens", 50, 4000);
  numberField("followupDelayMinutes", 1, 1440);

  for (const key of ["isActive", "followupEnabled"]) {
    if (has(key)) data[key] = body[key] === true || body[key] === "true";
  }

  if (has("handoverPhone")) {
    const raw = String(body.handoverPhone ?? "").trim();
    const digits = raw.replace(/[^\d]/g, "");
    if (raw && (digits.length < 8 || digits.length > 15)) errors.push("Teléfono de handover no válido");
    else data.handoverPhone = digits || null;
  }

  return { data, errors };
}

import { randomUUID } from "node:crypto";
import { estimateCost } from "./pricing";
import { saveUsage } from "./store";
import type { Settings } from "./types";
import type { ModelUsage, TokenUsage } from "./usage-types";
import type { ReasoningEffort } from "./types";
import { providerError } from "./provider-errors";
import { cleanError, ProcessError } from "./process";

const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
export const unknownTokens = (): TokenUsage => ({ inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null, totalTokens: null });
export function tokenUsage(raw: unknown, codex = false): TokenUsage {
  if (!raw || typeof raw !== "object") return unknownTokens();
  const data = raw as Record<string, unknown>;
  const input = count(data.input_tokens), output = count(data.output_tokens);
  const cached = count(codex ? data.cached_input_tokens : (data.input_tokens_details as Record<string, unknown>)?.cached_tokens);
  const reasoning = count(codex ? data.reasoning_output_tokens : (data.output_tokens_details as Record<string, unknown>)?.reasoning_tokens);
  return { inputTokens: input, outputTokens: output, cachedInputTokens: cached !== null && input !== null && cached <= input ? cached : null,
    reasoningTokens: reasoning !== null && output !== null && reasoning <= output ? reasoning : null,
    totalTokens: input !== null && output !== null ? input + output : null };
}
export function codexUsage(stdout: string): { tokens: TokenUsage; model: string | null; turns: TokenUsage[] } {
  const turns: TokenUsage[] = []; let model: string | null = null;
  for (const line of stdout.split("\n")) {
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.completed") { turns.push(tokenUsage(event.usage, true)); if (typeof event.model === "string") model = event.model; }
    } catch { /* Other CLI output is never evidence for token counts. */ }
  }
  if (!turns.length) return { tokens: unknownTokens(), model, turns };
  const sum = (key: keyof TokenUsage) => turns.every(t => t[key] !== null) ? turns.reduce((n, t) => n + t[key]!, 0) : null;
  return { model, turns, tokens: { inputTokens: sum("inputTokens"), cachedInputTokens: sum("cachedInputTokens"), outputTokens: sum("outputTokens"), reasoningTokens: sum("reasoningTokens"), totalTokens: sum("totalTokens") } };
}
export function codexFailure(error: unknown): Error {
  if (!(error instanceof ProcessError)) return error instanceof Error ? error : new Error(cleanError(error));
  let message = "";
  for (const line of error.stdout.split("\n")) {
    try {
      const event = JSON.parse(line);
      if (event.type === "error" && typeof event.message === "string") message = event.message;
      if (event.type === "turn.failed" && typeof event.error?.message === "string") message = event.error.message;
    } catch { /* Only structured CLI errors are used. */ }
  }
  const normalized = providerError(`Codex: ${message || error.stderr || error.message}`);
  return new Error(cleanError(normalized.startsWith("Codex:") && !message ? error.message : normalized));
}
export function recordUsage(settings: Settings, operation: string, tokens: TokenUsage, reportedModel: string | null, outcome: ModelUsage["outcome"], tier = "default", reportedEffort?: ReasoningEffort | null, turns?: TokenUsage[]): ModelUsage {
  const requested = settings.provider === "codex" ? settings.codexModel : settings.openaiModel;
  const model = reportedModel || requested || null;
  const pricing = estimateCost(model, tokens, tier);
  // Context thresholds apply per request, not to the sum of a CLI's completed turns.
  if (turns && turns.length > 1) {
    const costs = turns.map(turn => estimateCost(model, turn, tier).estimatedUsd);
    pricing.estimatedUsd = costs.every(cost => cost !== null) ? costs.reduce<number>((sum, cost) => sum + cost!, 0) : null;
  }
  const requestedEffort = settings.provider === "codex" ? settings.codexEffort : settings.openaiEffort;
  const receipt: ModelUsage = { id: randomUUID(), createdAt: new Date().toISOString(), provider: settings.provider, model,
    modelSource: reportedModel ? "reported" : settings.execution?.modelSource || (requested ? "requested" : "unknown"),
    requestedModel: settings.execution ? settings.execution.requestedModel : requested || null,
    reasoningEffort: reportedEffort || (requestedEffort && requestedEffort !== "default" ? requestedEffort : null),
    effortSource: reportedEffort ? "reported" : settings.execution?.effortSource || (requestedEffort && requestedEffort !== "default" ? "requested" : "unknown"),
    operation, jobId: settings.usageJobId, reelId: settings.usageReelId,
    ...tokens, ...pricing, costKind: settings.provider === "codex" ? "api-equivalent" : "api-estimate", outcome, serviceTier: tier };
  saveUsage(receipt); return receipt;
}

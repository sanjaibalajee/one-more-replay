import type { Provider, ReasoningEffort } from "./types";
export interface ModelExecution {
  provider: Provider; model: string; modelSource: "requested" | "resolved-default";
  requestedModel: string | null;
  reasoningEffort: ReasoningEffort; effortSource: "requested" | "catalogue-default" | "unknown";
  rates: { input: number | null; cached: number | null; output: number | null; asOf: string };
}
export interface TokenUsage {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
}
export interface ModelUsage extends TokenUsage {
  id: string; createdAt: string; provider: Provider; model: string | null;
  modelSource: "reported" | "requested" | "resolved-default" | "unknown";
  requestedModel?: string | null;
  reasoningEffort?: ReasoningEffort | null;
  effortSource?: "requested" | "catalogue-default" | "reported" | "unknown";
  operation: string; jobId?: string; reelId?: string;
  estimatedUsd: number | null; costKind: "api-estimate" | "api-equivalent";
  pricingAsOf: string | null; priceModel: string | null; pricingSource: string;
  serviceTier: string; note: string;
  outcome: "response" | "failed" | "cancelled";
}

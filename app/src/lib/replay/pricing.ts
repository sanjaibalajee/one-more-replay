import bundled from "./litellm-prices.json";
import { readFileSync } from "node:fs";
import { writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { LOCAL } from "./paths";
import type { TokenUsage } from "./usage-types";

export const PRICING_SOURCE = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
export interface PriceSnapshot { source: string; fetchedAt: string; models: Record<string, Record<string, unknown>> }
let current: PriceSnapshot | undefined;
export function pricingSnapshot(): PriceSnapshot {
  if (!current) {
    current = bundled as PriceSnapshot;
    try {
      const saved = JSON.parse(readFileSync(path.join(LOCAL, "litellm-prices.json"), "utf8")) as PriceSnapshot;
      if (saved.source === PRICING_SOURCE && Number.isFinite(Date.parse(saved.fetchedAt)) && saved.models && typeof saved.models === "object" && Date.parse(saved.fetchedAt) > Date.parse(current.fetchedAt)) current = saved;
    } catch { /* Bundled rates work offline. */ }
  }
  return current;
}
let refreshing: Promise<PriceSnapshot> | undefined;
export function refreshPricing(): Promise<PriceSnapshot> {
  return refreshing ||= (async () => {
    const response = await fetch(PRICING_SOURCE, { redirect: "error", signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!response.ok || !response.body) throw new Error("LiteLLM pricing is unavailable. The previous rates are still saved.");
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 10_000_000) throw new Error("Pricing response was too large."); chunks.push(value); } }
    finally { await reader.cancel().catch(() => {}); }
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const models: PriceSnapshot["models"] = {};
    for (const [model, entry] of Object.entries(raw)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const data = entry as Record<string, unknown>;
      if (data.litellm_provider !== "openai" || !["chat", "responses"].includes(String(data.mode))) continue;
      if (typeof data.input_cost_per_token !== "number" || typeof data.output_cost_per_token !== "number") continue;
      models[model] = Object.fromEntries(Object.entries(data).filter(([key, value]) => key === "litellm_provider" || key === "mode" || typeof value === "number" && (key.includes("cost_per") || key.startsWith("cache_read_input_token_cost"))));
    }
    if (!Object.keys(models).length) throw new Error("LiteLLM returned no usable OpenAI token prices. Previous rates were kept.");
    const next = { source: PRICING_SOURCE, fetchedAt: new Date().toISOString(), models };
    await mkdir(LOCAL, { recursive: true, mode: 0o700 });
    const temporary = path.join(LOCAL, "litellm-prices.json.part");
    await writeFile(temporary, JSON.stringify(next), { mode: 0o600 });
    await rename(temporary, path.join(LOCAL, "litellm-prices.json")); current = next;
    return next;
  })().finally(() => { refreshing = undefined; });
}
export function estimateCost(model: string | null, usage: TokenUsage, tier = "default", snapshot = pricingSnapshot()) {
  const missing = (note: string) => ({ estimatedUsd: null, priceModel: null, pricingAsOf: snapshot.fetchedAt, pricingSource: snapshot.source, note });
  if (!model) return missing("The CLI did not report the default model. Select a model explicitly for an API-equivalent estimate.");
  const priceModel = [model, `openai/${model}`].find(key => Object.hasOwn(snapshot.models, key));
  if (!priceModel) return missing("LiteLLM has no exact price for this model. Cost is unavailable.");
  const price = snapshot.models[priceModel];
  const { inputTokens: input, cachedInputTokens: cached, outputTokens: output, reasoningTokens: reasoning } = usage;
  if (input === null || output === null || cached === null) return missing("The provider did not return a complete token breakdown. Cost is unavailable.");
  const rate = (field: string) => {
    const suffix = tier === "default" ? "" : `_${tier}`;
    const thresholds = Object.keys(price).flatMap(key => {
      const match = new RegExp(`^${field}_above_(\\d+)k_tokens${suffix}$`).exec(key);
      return match && input > Number(match[1]) * 1000 ? [{ threshold: Number(match[1]), key }] : [];
    }).sort((a, b) => b.threshold - a.threshold);
    const value = price[thresholds[0]?.key || `${field}${suffix}`];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  };
  const inputRate = rate("input_cost_per_token"), cachedRate = rate("cache_read_input_token_cost"), outputRate = rate("output_cost_per_token");
  if (inputRate === null || outputRate === null || cached > 0 && cachedRate === null) return missing("LiteLLM has incomplete rates for this token breakdown or service tier.");
  const reasoningRate = rate("output_cost_per_reasoning_token");
  if (reasoningRate !== null && reasoning === null) return missing("Separate reasoning pricing needs a reported reasoning-token count.");
  const estimatedUsd = (input - cached) * inputRate + cached * (cachedRate ?? 0) + (output - (reasoningRate === null ? 0 : reasoning!)) * outputRate + (reasoningRate === null ? 0 : reasoning! * reasoningRate);
  return { estimatedUsd, priceModel, pricingAsOf: snapshot.fetchedAt, pricingSource: snapshot.source, note: "LiteLLM USD token-rate estimate. Provider invoices, discounts and unreported failed requests can differ." };
}
export function pricingRates(model: string) {
  const snapshot = pricingSnapshot(), price = snapshot.models[model] || snapshot.models[`openai/${model}`];
  const rate = (key: string) => typeof price?.[key] === "number" && Number.isFinite(price[key]) && price[key] >= 0 ? price[key] * 1_000_000 : null;
  return { input: rate("input_cost_per_token"), cached: rate("cache_read_input_token_cost"), output: rate("output_cost_per_token"), asOf: snapshot.fetchedAt };
}

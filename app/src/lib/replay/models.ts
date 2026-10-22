import type { ReasoningEffort } from "./types";
export interface ModelOption { id: string; label: string; description: string; efforts: ReasoningEffort[] }
// Capabilities checked against official model pages on 2026-10-21. /models does not expose these capabilities.
const standard: ReasoningEffort[] = ["low", "medium", "high", "xhigh", "max"];
export const OPENAI_MODELS: ModelOption[] = [
  { id: "gpt-6.1-sol", label: "GPT-6.1 Sol", description: "Detailed analysis", efforts: standard },
  { id: "gpt-6-luna", label: "GPT-6 Luna", description: "Faster, lower cost", efforts: ["none", ...standard] },
  { id: "gpt-6-astra", label: "GPT-6 Astra", description: "Most capable; higher cost", efforts: standard },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini", description: "Compact alternative", efforts: ["none", "low", "medium", "high", "xhigh"] },
];
export const CODEX_MODELS = OPENAI_MODELS.slice(0, 3);
export function modelOption(id: string) { return OPENAI_MODELS.find(m => m.id === id || new RegExp(`^${m.id.replace(/[.]/g, "\\.")}-\\d{4}-\\d{2}-\\d{2}$`).test(id)); }
export function supportedEfforts(id: string, provider: "codex" | "openai"): ReasoningEffort[] {
  if (provider === "codex" && !id) return ["low", "medium", "high"];
  return modelOption(id)?.efforts || [];
}
export function reasoningConfig(model: string, effort: ReasoningEffort = "default"): { effort: Exclude<ReasoningEffort, "default" | "ultra"> } | undefined {
  if (effort === "default") return undefined;
  if (effort === "ultra" || !supportedEfforts(model, "openai").includes(effort)) throw new Error("This reasoning effort is not supported by the selected model. Choose Model default or a supported effort in Connections.");
  return { effort };
}

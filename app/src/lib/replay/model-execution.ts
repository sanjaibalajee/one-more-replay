import { codexModels } from "./codex-models";
import { reasoningConfig, supportedEfforts } from "./models";
import { pricingRates } from "./pricing";
import type { Settings } from "./types";
import type { ModelExecution } from "./usage-types";

export async function prepareModelExecution(settings: Settings, signal: AbortSignal): Promise<Settings> {
  if (settings.execution) return settings;
  const provider = settings.provider;
  const requestedModel = (provider === "codex" ? settings.codexModel : settings.openaiModel).trim();
  let model = requestedModel, reasoningEffort = (provider === "codex" ? settings.codexEffort || "medium" : settings.openaiEffort || "default");
  let effortSource: ModelExecution["effortSource"] = reasoningEffort === "default" ? "unknown" : "requested";
  if (provider === "codex") {
    // Resolve once per job and pin both values, including when Connections says Model default.
    const catalogue = await codexModels(signal).catch(error => {
      if (signal.aborted || !requestedModel) throw error;
      return [];
    });
    const selected = requestedModel ? catalogue.find(m => m.id === requestedModel) : catalogue.find(m => m.isDefault);
    if (!model) {
      if (!selected) throw new Error("Codex did not identify its default model. Choose a model in Connections and retry.");
      model = selected.id;
    }
    if (reasoningEffort === "default" && selected) {
      reasoningEffort = selected.defaultEffort;
      effortSource = reasoningEffort === "default" ? "unknown" : "catalogue-default";
    }
    const supported = selected?.efforts || supportedEfforts(model, "codex");
    if (reasoningEffort !== "default" && !supported.includes(reasoningEffort)) throw new Error(`Codex does not advertise ${reasoningEffort} effort for ${model}. Choose Model default or a supported effort in Connections.`);
  } else {
    if (!model) throw new Error("Choose an OpenAI model in Connections.");
    reasoningConfig(model, reasoningEffort);
  }
  const execution: ModelExecution = { provider, model, requestedModel: requestedModel || null, modelSource: requestedModel ? "requested" : "resolved-default", reasoningEffort, effortSource, rates: pricingRates(model) };
  return { ...settings, ...(provider === "codex" ? { codexModel: model, codexEffort: reasoningEffort } : {}), execution };
}

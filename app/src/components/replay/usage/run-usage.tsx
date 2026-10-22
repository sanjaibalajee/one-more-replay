"use client";
import { dollars, tokens } from "./format";
import type { Job } from "@/lib/replay/types";

export function RunUsage({ job }: { job: Job }) {
  if (!job.runSettings || ["collect", "resolve"].includes(job.kind)) return null;
  const { execution, runSettings: settings } = job;
  const codex = settings.provider === "codex";
  const model = execution?.model || (codex ? settings.codexModel : settings.openaiModel);
  const effort = execution?.reasoningEffort || (codex ? settings.codexEffort : settings.openaiEffort) || "default";
  const receipts = job.usage || [], rates = execution?.rates;
  const known = receipts.filter(receipt => receipt.estimatedUsd !== null);
  const totalCost = known.reduce((sum, receipt) => sum + receipt.estimatedUsd!, 0);
  const knownTokens = receipts.filter(receipt => receipt.totalTokens !== null);
  return (
    <div className="run-usage" aria-label="Model and usage">
      <p><strong>{model || "Resolving Codex default…"}</strong> · {effort === "default" ? "model default effort" : `${effort} effort`} · {codex ? "Codex subscription" : "OpenAI API"}</p>
      <p>
        {knownTokens.length ? `${tokens(knownTokens.reduce((sum, receipt) => sum + receipt.totalTokens!, 0))} tokens reported · ` : ""}
        {known.length ? `${codex ? "API equivalent" : "Estimated API cost"} so far: ${dollars(totalCost)}${known.length < receipts.length ? " (partial)" : ""}. ` : ""}
        {codex ? "Uses your plan allowance. " : "Uses separate API billing. "}
        Tokens and cost arrive when the provider finishes a response.{" "}
        {codex && <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">View plan usage</a>}
      </p>
      {rates && <p className="field-note">
        LiteLLM USD / 1M tokens: input {dollars(rates.input)} · cached {dollars(rates.cached)} · output {dollars(rates.output)}.
        {" "}Standard rates; long context can differ. {codex && "API equivalent only; not a subscription charge."}
      </p>}
    </div>
  );
}

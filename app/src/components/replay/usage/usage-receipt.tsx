"use client";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { dollars, tokens } from "@/components/replay/usage/format";
import type { ModelUsage } from "@/lib/replay/usage-types";

export function UsageReceipt({ usage }: { usage?: ModelUsage }) {
  if (!usage) return null;
  return (
    <Disclosure
      className="usage-receipt"
      title={
        <>
          <span className="usage-model">{usage.model || "Model not reported"}{usage.reasoningEffort ? ` · ${usage.reasoningEffort} effort` : " · effort not reported"}{usage.provider === "codex" && ["requested", "resolved-default"].includes(usage.modelSource) ? " · pinned" : ""}</span>
          <span>
          {tokens(usage.totalTokens)}{" "}
          {usage.totalTokens === null ? "tokens" : "tokens used"}
          {" · "}
          {usage.costKind === "api-equivalent"
            ? "API equivalent"
            : "Estimated API cost"}
          : {dollars(usage.estimatedUsd)}
          </span>
        </>
      }
    >
      <p>
        {usage.model || "Codex default (model not reported)"}
        {usage.modelSource === "requested" ? " · requested model" : ""}
        {usage.modelSource === "resolved-default" ? " · CLI default resolved and pinned for this job" : ""}
        {usage.modelSource === "reported" ? " · provider-reported model" : ""}
        {usage.requestedModel && usage.requestedModel !== usage.model ? ` · requested ${usage.requestedModel}` : ""}
      </p>
      <p>Reasoning effort: {usage.reasoningEffort || "not reported"}{usage.effortSource === "requested" ? " (requested)" : usage.effortSource === "catalogue-default" ? " (CLI default, pinned)" : usage.effortSource === "reported" ? " (provider reported)" : ""}. Service tier: {usage.serviceTier}.</p>
      <dl>
        <div>
          <dt>Input</dt>
          <dd>{tokens(usage.inputTokens)}</dd>
        </div>
        <div>
          <dt>Cached input, included above</dt>
          <dd>{tokens(usage.cachedInputTokens)}</dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>{tokens(usage.outputTokens)}</dd>
        </div>
        <div>
          <dt>Reasoning, included in output</dt>
          <dd>{tokens(usage.reasoningTokens)}</dd>
        </div>
      </dl>
      {usage.provider === "codex" && (
        <p>
          Uses your subscription allowance. The API equivalent is a reference
          estimate, not a subscription charge.
        </p>
      )}
      <p>
        {usage.note}
        {usage.pricingAsOf
          ? ` Rates fetched ${new Date(usage.pricingAsOf).toLocaleDateString()}.`
          : ""}
      </p>
    </Disclosure>
  );
}

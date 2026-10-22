"use client";
import { Notice } from "@/components/replay/shared/notice";
import { dollars, tokens } from "@/components/replay/usage/format";
import { UsageReceipt } from "@/components/replay/usage/usage-receipt";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ModelUsage } from "@/lib/replay/usage-types";
import { useEffect, useState } from "react";

interface SummaryRow {
  provider: string;
  model: string | null;
  requests: number;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedInputTokens: number | null;
  unknownUsage: number;
  knownCosts: number;
  estimatedUsd: number | null;
}

interface Data {
  records: ModelUsage[];
  summary: SummaryRow[];
  pricing: {
    fetchedAt: string;
    models: Record<string, Record<string, unknown>>;
  };
}

export function UsageView({ revision }: { revision?: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/replay/usage", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const next = await r.json();
        if (!r.ok) throw new Error(next.error);
        return next;
      })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [revision]);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/replay/usage", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const next = await fetch("/api/replay/usage", { cache: "no-store" });
      if (!next.ok) throw new Error("Could not reload usage.");
      setData(await next.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh prices.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="usage-page">
      <div className="page-heading">
        <div>
          <h1>Usage & costs</h1>
          <p>Reported model tokens and LiteLLM estimates in USD.</p>
        </div>
        <Button
          variant="outline"
          className="btn"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Refreshing…" : "Refresh prices"}
        </Button>
      </div>
      {error && <Notice danger>{error}</Notice>}
      <Notice>
        API costs are estimates, not invoices. Codex uses your subscription
        allowance; its API equivalent is shown separately. Missing usage or
        rates stay unavailable. Earlier runs have no recorded usage.
      </Notice>
      {!data ? (
        <p role="status">Loading usage…</p>
      ) : (
        <>
          <div className="section-heading">
            <h2>All recorded runs by model</h2>
          </div>
          <div className="analytics-table-wrap usage-model-table">
            <Table className="analytics-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Model / connection</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Reported input</TableHead>
                  <TableHead>Reported output</TableHead>
                  <TableHead>Cost estimate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.summary.map((row) => (
                  <TableRow key={`${row.provider}:${row.model}`}>
                    <TableCell>
                      {row.model || "Default model unavailable"}
                      <small>
                        {row.provider === "codex"
                          ? "Codex subscription"
                          : "OpenAI API"}
                      </small>
                    </TableCell>
                    <TableCell>
                      {row.requests}
                      {row.unknownUsage > 0 && (
                        <small>{row.unknownUsage} without complete usage</small>
                      )}
                    </TableCell>
                    <TableCell>
                      {tokens(row.inputTokens)}
                      <small>
                        {tokens(row.cachedInputTokens)} cached, included
                      </small>
                    </TableCell>
                    <TableCell>{tokens(row.outputTokens)}</TableCell>
                    <TableCell>
                      {dollars(row.estimatedUsd)}
                      <small>
                        {row.provider === "codex"
                          ? "API equivalent"
                          : "Estimated API cost"}{" "}
                        · {row.knownCosts}/{row.requests} priced
                      </small>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="usage-model-cards">
            {data.summary.map((row) => (
              <Card key={`${row.provider}:${row.model}`}>
                <CardHeader>
                  <CardTitle>
                    {row.model || "Default model unavailable"}
                  </CardTitle>
                  <CardDescription>
                    {row.provider === "codex"
                      ? "Codex subscription"
                      : "OpenAI API"}{" "}
                    · {row.requests}{" "}
                    {row.requests === 1 ? "request" : "requests"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="usage-model-cost">
                    {dollars(row.estimatedUsd)}
                  </p>
                  <p className="field-note">
                    {row.provider === "codex"
                      ? "API equivalent"
                      : "Estimated API cost"}{" "}
                    · {row.knownCosts}/{row.requests} priced
                  </p>
                  <dl>
                    <div>
                      <dt>Reported input</dt>
                      <dd>{tokens(row.inputTokens)}</dd>
                    </div>
                    <div>
                      <dt>Reported output</dt>
                      <dd>{tokens(row.outputTokens)}</dd>
                    </div>
                    <div>
                      <dt>Cached, included in input</dt>
                      <dd>{tokens(row.cachedInputTokens)}</dd>
                    </div>
                  </dl>
                  {row.unknownUsage > 0 && (
                    <p className="field-note">
                      {row.unknownUsage} requests without complete usage.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          {!data.summary.length && (
            <p className="research-empty">
              No model usage recorded yet. Future analyses, comparisons and
              concepts will appear here.
            </p>
          )}
          <div className="section-heading">
            <h2>Latest 50 requests</h2>
          </div>
          {data.records.map((record) => (
            <div className="usage-history" key={record.id}>
              <span>
                {new Date(record.createdAt).toLocaleString()} ·{" "}
                {record.operation.replaceAll("_", " ")}
                {record.outcome !== "response" ? ` · ${record.outcome}` : ""}
              </span>
              <UsageReceipt usage={record} />
            </div>
          ))}
          <p className="field-note">
            Rates fetched {new Date(data.pricing.fetchedAt).toLocaleString()}.
            Refreshing prices affects future estimates; saved receipts retain
            the rates used when recorded. Only public pricing is fetched; your
            research is not sent to LiteLLM.{" "}
            <a
              href="https://docs.litellm.ai/docs/proxy/model_cost_map"
              target="_blank"
              rel="noreferrer"
            >
              Pricing source
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}

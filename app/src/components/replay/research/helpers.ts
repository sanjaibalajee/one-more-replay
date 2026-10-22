"use client";
import { platformFor, platformLabel } from "@/lib/replay/research-types";
import type { Reel, Snapshot } from "@/lib/replay/types";

export const ready = (r: Reel) =>
  r.analysis?.version === 2 && Boolean(r.analysis.sources?.length);

export const creator = (r: Reel, data: Snapshot) =>
  r.creatorName ||
  (data.accounts.find((a) => a.id === r.accountId)?.kind === "inbox"
    ? platformLabel[platformFor(r)]
    : `@${data.accounts.find((a) => a.id === r.accountId)?.username || "unknown"}`);

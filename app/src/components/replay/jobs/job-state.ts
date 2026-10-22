import type { Job } from "@/lib/replay/types";

export const active = (job: Job) =>
  !["completed", "failed", "cancelled"].includes(job.phase);

export const phaseLabel = (phase: string) =>
  ({
    idle: "Ready to analyze",
    resolving: "Fetching public details",
    queued: "Queued",
    collecting: "Collecting",
    downloading: "Downloading",
    extracting: "Extracting frames",
    transcribing: "Transcribing",
    analyzing: "Writing report",
    comparing: "Comparing reports",
    completed: "Complete",
    failed: "Needs attention",
    cancelled: "Cancelled",
  })[phase] || phase;

export function elapsedSince(at: string | undefined, now: number) {
  const seconds = Math.max(0, Math.floor((now - Date.parse(at || "")) / 1000));
  return Number.isFinite(seconds)
    ? seconds < 60
      ? `${seconds}s`
      : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    : "";
}

export function retryAdvice(job: Job): string {
  if (job.kind === "resolve")
    return "Retry fetching public details, or open the saved video and upload its file. No Apify token is needed.";
  const message = job.errors.join(" ").toLowerCase();
  if (/usage.limit|credit|402|quota|rate.limit|429/.test(message))
    return "Check the provider’s credits or usage limit. Retry after the limit clears.";
  if (/token|401|403|api.key|authentication|sign.in/.test(message))
    return "Check the selected connection in Connections, then retry.";
  if (/download|expired|instagram link/.test(message))
    return "Refresh the account’s media links or supply the video file from Reel details, then retry.";
  if (/whisper|python|transcrib/.test(message))
    return "Check local Whisper setup in Connections. Saved video and frames can be reused.";
  return "Retry to reuse saved video and transcript where available. Completed reports are kept.";
}

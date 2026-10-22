"use client";
import { elapsedSince, phaseLabel } from "@/components/replay/jobs/job-state";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { RunUsage } from "@/components/replay/usage/run-usage";
import type { Job, Phase } from "@/lib/replay/types";
import { Check, Circle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export const pipeline: { phase: Phase; label: string; note: string }[] = [
  {
    phase: "downloading",
    label: "Download",
    note: "Get the selected video or reuse its saved file.",
  },
  {
    phase: "extracting",
    label: "Frames",
    note: "Sample the opening and moments across the video.",
  },
  {
    phase: "transcribing",
    label: "Transcript",
    note: "Run Whisper locally. The first model download can take longer.",
  },
  {
    phase: "analyzing",
    label: "Analysis",
    note: "Build the evidence-linked report and production ideas.",
  },
];

export function JobProgress({ job }: { job: Job }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const index = pipeline.findIndex((s) => s.phase === job.phase);
  return (
    <div className="job-stages" aria-label="Processing progress">
      <div className="job-stage-heading">
        <strong>
          {job.phase === "comparing" && job.kind === "refine"
            ? "Refining idea"
            : job.phase === "comparing" && job.kind === "adapt"
              ? "Writing concepts"
              : job.phase === "comparing" && job.kind === "gap"
                ? "Finding creative gaps"
                : phaseLabel(job.phase)}
        </strong>
        <span>
          {elapsedSince(job.phaseStartedAt || job.updatedAt, now)} in this stage
          · {elapsedSince(job.createdAt, now)} total
        </span>
      </div>
      {job.kind === "analyze" && (
        <>
          <ol className="pipeline">
            {pipeline.map((step, i) => {
              const seen = job.history?.some(
                (h) => h.phase === step.phase && h.reelId === job.currentReelId,
              );
              const passed = index > i,
                skipped = passed && !seen,
                current = index === i;
              return (
                <li
                  key={step.phase}
                  className={current ? "current" : passed ? "done" : ""}
                  aria-current={current ? "step" : undefined}
                >
                  {current ? (
                    <Loader2 className="spin" size={15} />
                  ) : passed ? (
                    <Check size={15} />
                  ) : (
                    <Circle size={14} />
                  )}
                  <span>
                    {step.label}
                    {skipped && <small>Cached / skipped</small>}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="stage-help">
            {index >= 0
              ? pipeline[index].note
              : "Waiting for earlier work to finish. You can keep browsing."}{" "}
            {job.total > 1 &&
              `${job.completed} of ${job.total} Reels processed.`}
          </p>
        </>
      )}
      <p className="job-detail">{job.detail}</p>
      <RunUsage job={job} />
      {job.kind === "transcribe" && <p className="stage-help">Speech recognition runs on this computer. No Codex allowance or API charge. The saved report stays available.</p>}
      {job.kind === "collect" && (
        <p className="stage-help">
          Requesting up to {job.params.limit || 50} public Reels. Apify may
          return fewer. Analysis starts only after you select videos.
        </p>
      )}
      {job.kind === "compare" && (
        <p className="stage-help">
          Checking formats, lengths, post ages and the selected reports. No new
          account collection is running.
        </p>
      )}
      {job.kind === "resolve" && (
        <p className="stage-help">
          Reading one public video link. If access is blocked, open the saved
          link and upload its video. No account collection, Apify credits or AI
          usage.
        </p>
      )}
      {job.kind === "refine" && (
        <p className="stage-help">
          Using this conversation, the saved idea and source excerpts. Save the
          result to Inspiration when it fits.
        </p>
      )}
      {(job.kind === "adapt" || job.kind === "gap") && (
        <p className="stage-help">
          Using saved evidence and your creator brief with the selected model.
          The result will appear in Reports. This can take a few minutes; you
          can keep browsing.
        </p>
      )}
      {!!job.history?.length && (
        <Disclosure className="stage-history" title={<>Stage history</>}>
          <ol>
            {job.history.map((item, i) => (
              <li key={i}>
                <time>
                  {new Date(item.at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <span>
                  {phaseLabel(item.phase)} — {item.detail}
                </span>
              </li>
            ))}
          </ol>
        </Disclosure>
      )}
    </div>
  );
}

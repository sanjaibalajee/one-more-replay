"use client";
import { JobProgress } from "@/components/replay/jobs/job-progress";
import {
  active,
  phaseLabel,
  retryAdvice,
} from "@/components/replay/jobs/job-state";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { ProviderError } from "@/components/replay/shared/provider-error";
import { UsageReceipt } from "@/components/replay/usage/usage-receipt";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Job, Reel } from "@/lib/replay/types";
import { Clock3 } from "lucide-react";

export function JobActivity({
  jobs,
  busy,
  cancel,
  retry,
  openReport,
  openReel,
  reels = [],
  mode = "all",
}: {
  jobs: Job[];
  busy: boolean;
  cancel: (id: string) => void;
  retry: (job: Job) => void;
  openReport: (id: string) => void;
  openReel?: (id: string) => void;
  reels?: Reel[];
  mode?: "all" | "active" | "history";
}) {
  const running = mode === "history" ? [] : jobs.filter(active),
    recent = mode === "active" ? [] : jobs.filter((j) => !active(j)).slice(0, 3);
  if (!running.length && !recent.length) return null;
  return (
    <div className="activity-area">
      {running.map((job) => (
        <Card
          role="region"
          className="active-job"
          key={job.id}
          aria-label={`${job.kind === "collect" ? "Collection" : job.kind === "compare" ? "Comparison" : job.kind === "transcribe" ? "Transcription" : "Analysis"} job`}
        >
          <div className="active-job-heading">
            <strong>
              {job.kind === "transcribe" ? "Transcribing locally" : job.kind === "collect"
                ? "Collecting Reels"
                : job.kind === "compare"
                  ? "Comparing reports"
                  : job.kind === "resolve"
                    ? "Fetching video details"
                    : job.kind === "adapt"
                      ? "Adapting a creative pattern"
                      : job.kind === "gap"
                        ? "Finding creative opportunities"
                        : job.kind === "refine"
                          ? "Refining an idea"
                          : `Analyzing Reel ${Math.min(job.completed + 1, job.total)} of ${job.total}`}
            </strong>
            <Button
              variant="outline"
              className="btn small"
              disabled={busy}
              onClick={() => cancel(job.id)}
            >
              Cancel
            </Button>
          </div>
          <JobProgress job={job} />
          {job.kind === "analyze" && openReel && (
            <Disclosure
              className="batch-reels"
              defaultOpen={job.total > 1}
              title={<>Selected Reels</>}
            >
              {job.reelIds.map((id) => {
                const reel = reels.find((reel) => reel.id === id);
                return reel ? (
                  <Button variant="ghost" key={id} onClick={() => openReel(id)}>
                    <span>{reel.caption.slice(0, 85) || reel.shortcode}</span>
                    <small>{phaseLabel(reel.status)}</small>
                  </Button>
                ) : null;
              })}
            </Disclosure>
          )}
        </Card>
      ))}
      {recent.length > 0 && (
        <Disclosure
          className="recent-activity"
          title={
            <>
              <Clock3 size={13} />
              Recent activity<span>{recent.length} recent jobs</span>
            </>
          }
        >
          <div>
            {recent.map((job) => (
              <div className={`recent-job ${job.phase}`} key={job.id}>
                <span className="status-dot" />
                <div>
                  <strong>
                    {job.phase === "completed"
                      ? "Finished"
                      : job.phase === "cancelled"
                        ? "Cancelled"
                        : "Needs attention"}
                  </strong>
                  <p>{job.detail}</p>
                  {job.usage?.map((usage) => (
                    <UsageReceipt key={usage.id} usage={usage} />
                  ))}
                  {job.errors.length > 0 && (
                    <p className="job-error"><ProviderError message={job.errors[0]} /></p>
                  )}
                  {job.phase === "failed" && <p>{retryAdvice(job)}</p>}
                </div>
                {job.phase === "failed" && (
                  <Button
                    variant="outline"
                    className="btn small"
                    disabled={busy}
                    onClick={() => retry(job)}
                  >
                    {job.kind === "transcribe" ? "Review & retry" : "Retry"}
                  </Button>
                )}
                {job.kind === "analyze" &&
                  job.phase === "completed" &&
                  job.reelIds.length === 1 &&
                  openReel && (
                    <Button
                      variant="outline"
                      className="btn small"
                      onClick={() => openReel(job.reelIds[0])}
                    >
                      Open analysis
                    </Button>
                  )}
                {job.resultId && (
                  <Button
                    variant="outline"
                    className="btn small"
                    onClick={() => openReport(job.resultId!)}
                  >
                    {job.kind === "transcribe" ? "Open video" : "Open report"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Disclosure>
      )}
    </div>
  );
}

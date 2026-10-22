import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertMediaAvailable } from "./media-lock";
import { getJobs, getReel, saveReel } from "./store";
import { transcriptContentVersion, transcriptEditVersion } from "./transcript";

export const transcriptActions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("transcript-save"),
    reelId: z.string().min(1).max(100),
    expectedRevision: z.string().min(1).max(1000),
    lines: z.array(z.string().trim().max(4000)).max(2000),
  }),
  z.object({
    action: z.literal("transcript-reset"),
    reelId: z.string().min(1).max(100),
    expectedRevision: z.string().min(1).max(1000),
  }),
]);

export function handleTranscript(
  input: z.infer<typeof transcriptActions>,
): Response {
  assertMediaAvailable([input.reelId]);
  const reel = getReel(input.reelId);
  if (!reel?.evidence || reel.evidence.transcript.status !== "completed") {
    throw new Error("This video has no editable transcript. Analyze it first.");
  }
  if (
    getJobs().some(
      (job) =>
        job.reelIds.includes(reel.id) &&
        !["completed", "cancelled", "failed"].includes(job.phase),
    )
  ) {
    throw new Error(
      "Wait for this video's active job before correcting its transcript.",
    );
  }
  if (transcriptEditVersion(reel) !== input.expectedRevision) {
    throw new Error(
      "The transcript or video changed in another view. Your edits were not saved. Reload the transcript before trying again.",
    );
  }
  if (input.action === "transcript-reset") {
    saveReel({ ...reel, transcriptReview: undefined });
    return Response.json({ ok: true });
  }
  const original = reel.evidence.transcript;
  if (input.lines.length !== original.segments.length)
    throw new Error(
      "Keep the original transcript segments and timing. Reload the transcript before saving.",
    );
  if (input.lines.reduce((size, text) => size + text.length, 0) > 100000)
    throw new Error("Keep the transcript under 100,000 characters.");
  const corrections = input.lines.flatMap((text, index) =>
    text === original.segments[index].text ? [] : [{ index, text }],
  );
  saveReel({
    ...reel,
    transcriptReview: corrections.length
      ? {
          revision: randomUUID(),
          sourceRevision: transcriptContentVersion(original),
          mediaRevision: reel.mediaRevision || "",
          updatedAt: new Date().toISOString(),
          corrections,
        }
      : undefined,
  });
  return Response.json({ ok: true, correctedLines: corrections.length });
}

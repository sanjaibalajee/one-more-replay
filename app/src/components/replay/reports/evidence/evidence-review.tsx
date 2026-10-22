"use client";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { evidenceQuality } from "@/lib/replay/evidence-quality";
import { analysisEvidence } from "@/lib/replay/transcript";
import type { Reel } from "@/lib/replay/types";
import styles from "./evidence.module.css";

export function EvidenceReview({
  reel,
  review,
}: {
  reel: Reel;
  review: () => void;
}) {
  if (!reel.evidence) return null;
  const evidence = analysisEvidence(reel, reel.evidence),
    quality = evidenceQuality(evidence);
  return (
    <div className={styles.quality}>
      <div className={styles.heading}>
        <div>
          <h3>Evidence check</h3>
          <p>
            {quality.frameCount} frames · {quality.openingFrames} in the opening
            · {evidence.transcript.segments.length} transcript lines
          </p>
        </div>
        {quality.flaggedSegments.length > 0 && (
          <Button variant="outline" size="sm" onClick={review}>
            Check {quality.flaggedSegments.length}{" "}
            {quality.flaggedSegments.length === 1 ? "line" : "lines"}
          </Button>
        )}
      </div>
      <Disclosure title={<>What the analysis can see</>}>
        <p>
          Images are individual samples. The largest gap between visual samples
          is {quality.largestGap.toFixed(1)}s. Scene changes are estimates;
          audio delivery, music and continuous motion are not directly analyzed.
        </p>
        {!!quality.notes.length && (
          <ul>
            {quality.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        <p>
          {evidence.transcript.reviewed
            ? "New analysis uses your transcript corrections. Existing reports retain their original evidence."
            : "Transcript text is speech recognition. Listen to important lines before relying on a quote."}
        </p>
      </Disclosure>
    </div>
  );
}

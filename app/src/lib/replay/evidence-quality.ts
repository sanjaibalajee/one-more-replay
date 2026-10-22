import { recognitionFlags } from "./transcript";
import type { MediaEvidence } from "./types";

export function evidenceQuality(evidence: MediaEvidence) {
  const times = [...new Set(evidence.frames.map((frame) => frame.seconds))]
    .filter(
      (time) => Number.isFinite(time) && time >= 0 && time <= evidence.duration,
    )
    .sort((a, b) => a - b);
  const bounds = [0, ...times, evidence.duration];
  const largestGap = bounds
    .slice(1)
    .reduce((largest, time, i) => Math.max(largest, time - bounds[i]), 0);
  const flaggedSegments = evidence.transcript.segments.flatMap(
    (segment, index) => (recognitionFlags(segment).length ? [index] : []),
  );
  const openingFrames = times.filter((time) => time <= 3).length;
  const notes: string[] = [];
  if (!times.length) notes.push("No readable frames are available.");
  if (evidence.duration >= 3 && openingFrames < 3)
    notes.push(
      "The opening has few sampled frames. Brief text or gestures may be missing.",
    );
  if (largestGap > Math.max(3, evidence.duration * 0.15))
    notes.push(
      `There is a ${largestGap.toFixed(1)}s gap between visual samples. Movement inside that gap is not directly observed.`,
    );
  if (evidence.hasAudio && evidence.transcript.status !== "completed")
    notes.push("Audio is present, but speech was not transcribed.");
  else if (evidence.hasAudio && !evidence.transcript.text.trim())
    notes.push(
      "No speech was recognized. This does not prove the audio is silent.",
    );
  if (flaggedSegments.length)
    notes.push(
      `${flaggedSegments.length} transcript ${flaggedSegments.length === 1 ? "line needs" : "lines need"} a wording check. Recognition signals are not an accuracy score.`,
    );
  if (
    evidence.transcript.languageProbability !== undefined &&
    evidence.transcript.languageProbability < 0.7
  )
    notes.push(
      "Automatic language detection was uncertain. Check the transcript language before relying on quotes.",
    );
  return {
    frameCount: times.length,
    openingFrames,
    largestGap,
    flaggedSegments,
    notes,
  };
}

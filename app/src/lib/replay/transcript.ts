import { subtitleCues } from "./transcript-timing";
import type {
  MediaEvidence,
  Reel,
  Transcript,
  TranscriptSegment,
} from "./types";

// A deterministic content version for stale-edit detection, not a security token.
export function transcriptContentVersion(transcript: Transcript): string {
  const text = JSON.stringify([
    transcript.language,
    transcript.engine,
    transcript.model,
    transcript.status,
    transcript.text,
    transcript.segments.map(({ start, end, text, words }) => words?.length ? [start, end, text, words.map(word => [word.start, word.end, word.text])] : [start, end, text]),
  ]);
  let hash = BigInt("14695981039346656037");
  const prime = BigInt("1099511628211");
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `transcript-${hash.toString(36)}`;
}

export function applicableReview(reel: Reel, evidence = reel.evidence) {
  const review = reel.transcriptReview;
  return evidence &&
    review &&
    review.mediaRevision === (reel.mediaRevision || "") &&
    review.sourceRevision === transcriptContentVersion(evidence.transcript)
    ? review
    : undefined;
}

export function currentTranscript(
  reel: Reel,
  evidence = reel.evidence,
): Transcript | null {
  if (!evidence) return null;
  const review = applicableReview(reel, evidence);
  if (!review) return evidence.transcript;
  const corrections = new Map(
    review.corrections.map((row) => [row.index, row.text]),
  );
  const segments = evidence.transcript.segments.map((segment, index) =>
    corrections.has(index)
      ? { ...segment, words: undefined, text: corrections.get(index)!, reviewed: true }
      : segment,
  );
  return {
    ...evidence.transcript,
    segments,
    text: segments
      .map((row) => row.text)
      .filter(Boolean)
      .join(" "),
    reviewed: true,
    note: "Your corrections are used for new analysis. Original recognition output and segment timing are preserved. Unedited lines may still contain recognition errors.",
  };
}

export function transcriptEditVersion(reel: Reel): string | null {
  if (!reel.evidence) return null;
  return JSON.stringify([
    reel.mediaRevision || "",
    transcriptContentVersion(reel.evidence.transcript),
    applicableReview(reel)?.revision || null,
  ]);
}

export function analysisEvidence(
  reel: Reel,
  evidence: MediaEvidence,
): MediaEvidence {
  return { ...evidence, transcript: currentTranscript(reel, evidence)! };
}

export function transcriptChangedSinceReport(reel: Reel): boolean {
  const transcript = currentTranscript(reel);
  if (!reel.analysis || !transcript) return false;
  if (reel.analysis.transcriptRevision) {
    return (
      reel.analysis.transcriptRevision !== transcriptContentVersion(transcript)
    );
  }
  const saved = reel.analysis.sources?.filter(
    (source) => source.kind === "transcript",
  );
  if (!saved) return Boolean(applicableReview(reel));
  const current = transcript.segments.flatMap((segment, index) =>
    segment.text.trim()
      ? [{ id: `T${index + 1}`, text: segment.text, seconds: segment.start }]
      : [],
  );
  return (
    saved.length !== current.length ||
    current.some(
      (row) =>
        !saved.some(
          (source) =>
            source.id === row.id &&
            source.text === row.text &&
            source.seconds === row.seconds,
        ),
    )
  );
}

export function recognitionFlags(segment: TranscriptSegment): string[] {
  if (segment.reviewed) return [];
  const flags: string[] = [];
  if (segment.avgLogProb !== undefined && segment.avgLogProb < -1)
    flags.push("Recognition was uncertain");
  if (segment.noSpeechProb !== undefined && segment.noSpeechProb > 0.6)
    flags.push("Speech may be unclear or absent");
  if (segment.compressionRatio !== undefined && segment.compressionRatio > 2.4)
    flags.push("Recognition may contain repetition");
  return flags;
}

export function transcriptSrt(transcript: Transcript): string {
  const stamp = (seconds: number) => {
    const total = Math.max(0, Math.round(seconds * 1000));
    return `${String(Math.floor(total / 3600000)).padStart(2, "0")}:${String(Math.floor(total / 60000) % 60).padStart(2, "0")}:${String(Math.floor(total / 1000) % 60).padStart(2, "0")},${String(total % 1000).padStart(3, "0")}`;
  };
  return subtitleCues(transcript)
    .map(
      (row, index) =>
        `${index + 1}\n${stamp(row.start)} --> ${stamp(row.end)}\n${row.text.replace(/\r?\n/g, " ").replace(/-->/g, "→")}\n`,
    )
    .join("\n");
}

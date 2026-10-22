import type { Transcript, TranscriptSegment, TranscriptWord } from "./types";

export const normalizeSpeech = (text: string) =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();

// Only trust timing attached to the exact recognized words. Editing a line
// invalidates its word alignment; segment timing remains available.
export function timedWords(
  segment: TranscriptSegment,
): TranscriptWord[] | null {
  const words = segment.words;
  if (segment.reviewed || !words?.length) return null;
  if (
    words.some(
      (word, i) =>
        !Number.isFinite(word.start) ||
        !Number.isFinite(word.end) ||
        word.start < segment.start - 0.1 ||
        word.end > segment.end + 0.1 ||
        word.end <= word.start ||
        (i > 0 && word.start < words[i - 1].end - 0.01),
    )
  )
    return null;
  return normalizeSpeech(words.map((word) => word.text).join("")) ===
    normalizeSpeech(segment.text)
    ? words
    : null;
}

export function openingSpeech(transcript: Transcript) {
  return transcript.segments.flatMap((segment, index) => {
    if (!segment.text.trim() || segment.start >= 3) return [];
    const words = timedWords(segment);
    const text = words
      ? words
          .filter((word) => word.start < 3)
          .map((word) => word.text)
          .join("")
          .trim()
      : segment.text;
    return text
      ? [
          {
            id: `T${index + 1}`,
            text,
            timing: words ? "estimated-words" : "segment-only",
          },
        ]
      : [];
  });
}

export function subtitleCues(
  transcript: Transcript,
): Pick<TranscriptSegment, "start" | "end" | "text">[] {
  return transcript.segments.flatMap((segment) => {
    if (!segment.text.trim() || segment.end <= segment.start) return [];
    const words = timedWords(segment);
    if (!words)
      return [{ start: segment.start, end: segment.end, text: segment.text }];
    const cues: Pick<TranscriptSegment, "start" | "end" | "text">[] = [];
    let group: TranscriptWord[] = [];
    const flush = () => {
      if (group.length && group.at(-1)!.end > group[0].start)
        cues.push({
          start: group[0].start,
          end: group.at(-1)!.end,
          text: group
            .map((word) => word.text)
            .join("")
            .trim(),
        });
      group = [];
    };
    for (const word of words) {
      if (
        group.length &&
        (word.start - group.at(-1)!.end > 0.7 ||
          word.end - group[0].start > 5 ||
          [...group, word]
            .map((w) => w.text)
            .join("")
            .trim().length > 72)
      )
        flush();
      group.push(word);
      if (/[.!?。！？]$/.test(word.text.trim())) flush();
    }
    flush();
    return cues;
  });
}

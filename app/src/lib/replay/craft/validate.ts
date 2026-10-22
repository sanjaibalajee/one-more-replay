import type { EvidenceSource } from "../evidence";
import type { CraftNote } from "./schema";

export function validateCraftNotes(
  notes: CraftNote[],
  sources: EvidenceSource[],
  duration: number,
): void {
  if (new Set(notes.map((note) => note.technique)).size !== notes.length)
    throw new Error(
      "The report repeated the same creative technique. Retry analysis.",
    );
  for (const note of notes) {
    if (
      note.evidenceIds.some((id) => !sources.some((source) => source.id === id))
    )
      throw new Error(
        "A creative technique cited evidence that was not supplied. Retry analysis.",
      );
    const creative = sources.filter(
      (source) =>
        note.evidenceIds.includes(source.id) &&
        ["frame", "transcript"].includes(source.kind),
    );
    if (!creative.length)
      throw new Error(
        "Creative techniques need frame or transcript evidence, not public counts alone. Retry analysis.",
      );
    if (note.status !== "observed") continue;
    const frames = creative.filter(
      (source) => source.kind === "frame" && source.seconds !== null,
    );
    const speech = creative.filter(
      (source) => source.kind === "transcript" && source.seconds !== null,
    );
    if (
      note.technique === "before-after" &&
      new Set(frames.map((source) => source.seconds)).size < 2
    )
      throw new Error(
        "An observed before/after needs two different visual moments. Retry analysis.",
      );
    if (note.technique === "demonstrated-proof" && !frames.length)
      throw new Error(
        "An observed demonstration needs visual evidence; speech alone is a claim. Retry analysis.",
      );
    if (
      note.technique === "result-first" &&
      !creative.some((source) => source.seconds !== null && source.seconds < 3)
    )
      throw new Error(
        "An observed result-first opening needs opening evidence. Retry analysis.",
      );
    if (
      note.technique === "visual-verbal" &&
      !frames.some((frame) =>
        speech.some(
          (segment) =>
            frame.seconds! >= segment.seconds! - 1 &&
            frame.seconds! <= (segment.endSeconds ?? segment.seconds!) + 1,
        ),
      )
    )
      throw new Error(
        "Observed words/image coordination needs visual and transcript evidence from the same moment. Retry analysis.",
      );
    if (
      note.technique === "information-progress" &&
      new Set(
        creative
          .map((source) => source.seconds)
          .filter((seconds) => seconds !== null),
      ).size < 2
    )
      throw new Error(
        "Observed progression needs more than one supplied moment. Retry analysis.",
      );
    if (
      note.technique === "curiosity-payoff" &&
      new Set(
        creative
          .map((source) => source.seconds)
          .filter((seconds) => seconds !== null),
      ).size < 2
    )
      throw new Error(
        "An observed curiosity/payoff needs the question and a later resolution moment. Retry analysis.",
      );
    if (
      note.technique === "motivated-ending" &&
      !creative.some(
        (source) =>
          source.seconds !== null &&
          (source.endSeconds ?? source.seconds) >= duration * 0.75,
      )
    )
      throw new Error(
        "An observed ending needs evidence from the closing part of the video. Retry analysis.",
      );
  }
}

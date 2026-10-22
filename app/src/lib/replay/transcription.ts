import path from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { PYTHON, ROOT } from "./paths";
import { run } from "./process";
import type { Transcript } from "./types";
import { transcriptionLanguages } from "./transcription-languages";

export const transcriptionOptions = z.object({
  model: z.enum(["tiny", "base", "small", "medium", "large-v3", "turbo"]),
  language: z
    .string()
    .refine(
      (value) => value === "" || transcriptionLanguages.includes(value),
      "Choose a supported spoken language.",
    ),
});
const wordSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
  probability: z.number().min(0).max(1).optional(),
});
export const transcriptSchema = z.object({
  text: z.string(),
  language: z.string().nullable(),
  languageProbability: z.number().min(0).max(1).optional(),
  segments: z.array(
    z.object({
      start: z.number().nonnegative(),
      end: z.number().nonnegative(),
      text: z.string(),
      words: z.array(wordSchema).optional(),
      avgLogProb: z.number().optional(),
      noSpeechProb: z.number().min(0).max(1).optional(),
      compressionRatio: z.number().nonnegative().optional(),
    }),
  ),
  engine: z.string(),
  model: z.string(),
  status: z.enum(["completed", "no-audio", "unavailable"]),
  note: z.string(),
});

export async function transcribeVideo(
  video: string,
  options: { model: string; language: string },
  duration: number,
  signal: AbortSignal,
): Promise<Transcript> {
  if (!existsSync(video)) throw new Error("The saved video file is missing. Supply its video file again, then retry transcription.");
  const audio = path.join(path.dirname(video), "audio.wav");
  await run(
    "ffmpeg",
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      video,
      "-vn",
      "-ar",
      "16000",
      "-ac",
      "1",
      audio,
    ],
    { signal },
  );
  try {
    const result = await run(
      PYTHON,
      [
        path.join(ROOT, "scripts/transcribe.py"),
        audio,
        "--model",
        options.model,
        "--language",
        options.language,
      ],
      { signal, timeout: 15 * 60000 },
    );
    const transcript = transcriptSchema.parse(JSON.parse(result.stdout));
    if (
      transcript.status !== "completed" ||
      transcript.segments.some(
        (segment, index) =>
          segment.end < segment.start ||
          segment.end > duration + 0.5 ||
          (index > 0 &&
            segment.start < transcript.segments[index - 1].end - 0.1),
      )
    )
      throw new Error("Recognition returned invalid segment timing.");
    return transcript;
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      `Whisper couldn't transcribe the audio. Check the language and local media setup, then retry. ${error instanceof Error ? error.message : ""}`,
    );
  }
}

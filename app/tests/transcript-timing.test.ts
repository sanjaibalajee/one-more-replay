import test from "node:test";
import assert from "node:assert/strict";
import {
  openingSpeech,
  normalizeSpeech,
  subtitleCues,
  timedWords,
} from "../src/lib/replay/transcript-timing";
import {
  currentTranscript,
  transcriptContentVersion,
  transcriptSrt,
} from "../src/lib/replay/transcript";
import { evidenceSources, validateAnalysis } from "../src/lib/replay/evidence";
import {
  analysisSchema,
  storedAnalysisSchema,
  type Transcript,
  type Reel,
  type MediaEvidence,
} from "../src/lib/replay/types";
import { reportFixture } from "./fixtures/report";
import { transcriptSchema } from "../src/lib/replay/transcription";

const transcript: Transcript = {
  text: "Synthetic words. The payoff is later.",
  language: "en",
  engine: "faster-whisper",
  model: "base",
  status: "completed",
  note: "Fixture",
  segments: [
    {
      start: 0,
      end: 9,
      text: "Synthetic words. The payoff is later.",
      words: [
        { start: 0, end: 1, text: "Synthetic" },
        { start: 1, end: 2, text: " words." },
        { start: 5, end: 5.5, text: " The" },
        { start: 5.5, end: 6, text: " payoff" },
        { start: 6, end: 7, text: " is" },
        { start: 7, end: 9, text: " later." },
      ],
    },
  ],
};
const evidence: MediaEvidence = {
  width: 180,
  height: 320,
  warnings: [],
  transcript,
  duration: 12,
  frames: [{ file: "frame-0.jpg", seconds: 0 }],
  sceneChanges: [],
  hasAudio: true,
};
const reel = {
  id: "timing",
  evidence,
  views: null,
  likes: null,
  comments: null,
} as Reel;

test("word timing prevents a late phrase inside the first ASR segment becoming the hook", () => {
  assert.equal(transcriptSchema.parse(transcript).segments[0].words?.length, 6);
  assert.deepEqual(openingSpeech(transcript), [
    { id: "T1", text: "Synthetic words.", timing: "estimated-words" },
  ]);
  const report = analysisSchema.parse(reportFixture());
  validateAnalysis(report, evidence, evidenceSources(reel, evidence));
  report.hook.spokenHook = "The payoff is later.";
  assert.throws(
    () => validateAnalysis(report, evidence, evidenceSources(reel, evidence)),
    /cited opening/,
  );
});

test("corrections invalidate word alignment without inventing timing for new words", () => {
  const corrected = currentTranscript({
    ...reel,
    transcriptReview: {
      revision: "new",
      sourceRevision: transcriptContentVersion(transcript),
      mediaRevision: "",
      updatedAt: "now",
      corrections: [{ index: 0, text: "Corrected speech." }],
    },
  })!;
  assert.equal(corrected.segments[0].words, undefined);
  assert.equal(timedWords(corrected.segments[0]), null);
  assert.equal(openingSpeech(corrected)[0].timing, "segment-only");
  assert.deepEqual(subtitleCues(corrected), [
    { start: 0, end: 9, text: "Corrected speech." },
  ]);
  assert.equal(transcript.segments[0].words?.length, 6);
  const bad = structuredClone(transcript.segments[0]);
  bad.words![1].start = 0;
  assert.equal(timedWords(bad), null);
  const mismatch = { ...transcript.segments[0], text: "Different words" };
  assert.equal(timedWords(mismatch), null);
  const zeroDuration = structuredClone(transcript);
  zeroDuration.segments[0].words![0].end = 0;
  assert.equal(timedWords(zeroDuration.segments[0]), null);
  assert.equal(subtitleCues(zeroDuration)[0].text, transcript.text);
  assert.notEqual(normalizeSpeech("கால்"), normalizeSpeech("கல்"));
});

test("subtitles split at sentences and pauses using original word boundaries", () => {
  assert.deepEqual(subtitleCues(transcript), [
    { start: 0, end: 2, text: "Synthetic words." },
    { start: 5, end: 9, text: "The payoff is later." },
  ]);
  assert.equal(
    transcriptSrt(transcript),
    "1\n00:00:00,000 --> 00:00:02,000\nSynthetic words.\n\n2\n00:00:05,000 --> 00:00:09,000\nThe payoff is later.\n",
  );
  const retimed = structuredClone(transcript);
  retimed.segments[0].words![0].end = 0.9;
  assert.notEqual(
    transcriptContentVersion(retimed),
    transcriptContentVersion(transcript),
  );
});

test("new editorial decisions require grounded preservation and a test, while old reports remain readable", () => {
  const old = JSON.parse(JSON.stringify(reportFixture()));
  delete old.editorial.keep;
  delete old.editorial.nextTest;
  assert.ok(storedAnalysisSchema.safeParse(old).success);
  assert.equal(analysisSchema.safeParse(old).success, false);
  const report = analysisSchema.parse(reportFixture());
  report.editorial.nextTest.evidenceIds = ["F999"];
  assert.throws(
    () => validateAnalysis(report, evidence, evidenceSources(reel, evidence)),
    /not supplied/,
  );
  const metricsOnly = analysisSchema.parse(reportFixture());
  metricsOnly.editorial.keep.evidenceIds = ["M_views"];
  const counted = { ...reel, views: 100 };
  assert.throws(
    () =>
      validateAnalysis(
        metricsOnly,
        evidence,
        evidenceSources(counted, evidence),
      ),
    /counts alone/,
  );
});

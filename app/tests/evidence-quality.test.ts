import test from "node:test";
import assert from "node:assert/strict";
import { evidenceQuality } from "../src/lib/replay/evidence-quality";
import { evidenceSources, validateAnalysis } from "../src/lib/replay/evidence";
import { frameTimes } from "../src/lib/replay/media";
import {
  analysisSchema,
  type MediaEvidence,
  type Reel,
} from "../src/lib/replay/types";
import { reportFixture } from "./fixtures/report";

const evidence: MediaEvidence = {
  duration: 12,
  width: 180,
  height: 320,
  hasAudio: true,
  frames: [
    { file: "opening.jpg", seconds: 0 },
    { file: "end.jpg", seconds: 11.9 },
  ],
  sceneChanges: [],
  transcript: {
    text: "Synthetic words. A later quote.",
    language: "en",
    languageProbability: 0.4,
    engine: "fixture",
    model: "base",
    status: "completed",
    note: "Synthetic fixture",
    segments: [
      { start: 0, end: 3, text: "Synthetic words.", avgLogProb: -1.4 },
      {
        start: 8,
        end: 11,
        text: "A later quote.",
        noSpeechProb: 0.8,
        compressionRatio: 3,
      },
    ],
  },
  warnings: [],
};
const reel = {
  id: "quality-fixture",
  caption: "Synthetic evidence",
  collectedAt: "2026-10-22T00:00:00Z",
  views: null,
  likes: null,
  comments: null,
} as Reel;

test("input checks expose gaps and uncertain recognition without inventing an accuracy or virality score", () => {
  const quality = evidenceQuality(evidence);
  assert.deepEqual(quality.flaggedSegments, [0, 1]);
  assert.equal(quality.largestGap, 11.9);
  assert.ok(quality.notes.some((note) => note.includes("language detection")));
  assert.equal("score" in quality, false);
  const older = structuredClone(evidence);
  older.transcript.segments.forEach((row) => {
    delete row.avgLogProb;
    delete row.noSpeechProb;
    delete row.compressionRatio;
  });
  assert.deepEqual(
    evidenceQuality(older).flaggedSegments,
    [],
    "Missing confidence is unknown, not a low-confidence measurement",
  );
});

test("a real quote from later in the video cannot become its opening hook or cite a frame as speech", () => {
  const sources = evidenceSources(reel, evidence);
  const late = analysisSchema.parse(reportFixture());
  late.hook.spokenHook = "A later quote.";
  late.hook.evidenceIds = ["T2"];
  assert.throws(
    () => validateAnalysis(late, evidence, sources),
    /cited opening/,
  );
  const noSpeechSource = analysisSchema.parse(reportFixture());
  noSpeechSource.hook.evidenceIds = ["F1"];
  assert.throws(
    () => validateAnalysis(noSpeechSource, evidence, sources),
    /exact excerpt/,
  );
});

test("timed claims require the right evidence kind at that moment and story beats stay in order", () => {
  const sources = evidenceSources(reel, evidence);
  const wrongTime = analysisSchema.parse(reportFixture());
  wrongTime.observations[0].timestampSeconds = 9;
  assert.throws(
    () => validateAnalysis(wrongTime, evidence, sources),
    /at its timestamp/,
  );
  const wrongKind = analysisSchema.parse(reportFixture());
  wrongKind.observations[0].evidenceIds = ["T1"];
  assert.throws(
    () => validateAnalysis(wrongKind, evidence, sources),
    /matching visual/,
  );
  const speech = analysisSchema.parse(reportFixture());
  speech.observations[0] = {
    category: "script",
    timestampSeconds: 2,
    detail: "Supplied opening words",
    evidenceIds: ["T1"],
  };
  validateAnalysis(speech, evidence, sources);
  speech.beats.push({ ...speech.beats[0], startSeconds: 2, endSeconds: 8 });
  assert.throws(
    () => validateAnalysis(speech, evidence, sources),
    /chronological/,
  );
});

test("rapid opening cuts receive frames inside each short shot within the fixed image budget", () => {
  const cuts = [0.16, 0.21, 0.8, 1.3, 2.2, 2.6, 4.7, 8, 12];
  const times = frameTimes(15, cuts);
  assert.ok(
    times.some((time) => time > 0.16 && time < 0.21),
    "Do not sample beyond the next cut in a 50ms shot",
  );
  assert.ok(
    times.some((time) => time > 2.2 && time < 2.6),
    "Previously uncovered opening shots are no longer excluded",
  );
  assert.ok(times.length <= 20);
  assert.equal(times.at(-1), 14.9);
  for (const duration of [0.02, 0.2, 1, 3, 60, 600]) {
    const result = frameTimes(
      duration,
      Array.from({ length: 200 }, (_, index) => (index * duration) / 200),
    );
    assert.ok(result.length <= 20);
    assert.ok(result.every((time) => time >= 0 && time < duration));
    assert.equal(new Set(result).size, result.length);
  }
});

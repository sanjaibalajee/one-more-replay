import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { reportFixture } from "./fixtures/report";
import {
  analysisEvidence,
  currentTranscript,
  transcriptChangedSinceReport,
  transcriptContentVersion,
  transcriptEditVersion,
  transcriptSrt,
} from "../src/lib/replay/transcript";
import { evidenceSources } from "../src/lib/replay/evidence";
import { buildCatalogueSearch } from "../src/lib/replay/catalogue-search";
import type {
  Job,
  MediaEvidence,
  Reel,
  Settings,
} from "../src/lib/replay/types";

const directory = mkdtempSync(path.join(tmpdir(), "replay-transcript-"));
process.env.REPLAY_DATA_DIR = directory;
const store = await import("../src/lib/replay/store");
const { handleTranscript, transcriptActions } = await import(
  "../src/lib/replay/transcript-api"
);
const { analysisPrompt } = await import("../src/lib/replay/intelligence");
const { reelMarkdown } = await import("../src/lib/replay/export");
const { reserveUpload } = await import("../src/lib/replay/media-lock");
after(() => {
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});
const account = store.addAccount("transcript_fixture");
const evidence: MediaEvidence = {
  duration: 12,
  width: 180,
  height: 320,
  hasAudio: true,
  frames: [{ file: "frame-0.jpg", seconds: 0 }],
  sceneChanges: [],
  transcript: {
    text: "Synthetic words. Tea on the table.",
    segments: [
      { start: 0, end: 3, text: "Synthetic words.", avgLogProb: -1.5 },
      { start: 4, end: 8, text: "Tea on the table." },
    ],
    language: "en",
    engine: "test",
    model: "base",
    status: "completed",
    note: "Synthetic fixture.",
  },
  warnings: [],
};
function fixture(id: string): Reel {
  const reel: Reel = {
    id,
    accountId: account.id,
    shortcode: id,
    url: "",
    caption: "Synthetic review fixture",
    thumbnail: "",
    videoUrl: "",
    views: null,
    likes: null,
    comments: null,
    postedAt: null,
    collectedAt: "2026-10-22T00:00:00Z",
    mediaRevision: "original-media",
    source: "upload",
    status: "completed",
    error: null,
    starred: false,
    evidence: structuredClone(evidence),
    analysis: reportFixture(),
    analysisProvider: "Synthetic provider",
    analyzedAt: "2026-10-22T00:00:00Z",
  };
  reel.analysis!.sources = evidenceSources(reel, reel.evidence!);
  store.saveReel(reel);
  return reel;
}
function save(reel: Reel, lines: string[]) {
  return handleTranscript(
    transcriptActions.parse({
      action: "transcript-save",
      reelId: reel.id,
      expectedRevision: transcriptEditVersion(reel),
      lines,
    }),
  );
}

test("corrections improve model inputs and search while original report citations, ASR, timing and usage stay intact", async () => {
  const original = fixture("corrected");
  const report = JSON.stringify(original.analysis),
    raw = JSON.stringify(original.evidence);
  assert.equal(
    save(original, ["A ceramic kettle.", "Tea on the table."]).status,
    200,
  );
  const saved = store.getReel(original.id)!;
  assert.equal(
    currentTranscript(saved)?.text,
    "A ceramic kettle. Tea on the table.",
  );
  assert.equal(JSON.stringify(saved.analysis), report);
  assert.equal(JSON.stringify(saved.evidence), raw);
  assert.deepEqual(
    currentTranscript(saved)?.segments.map((row) => [row.start, row.end]),
    [
      [0, 3],
      [4, 8],
    ],
  );
  assert.equal(transcriptChangedSinceReport(saved), true);
  const supplied = analysisEvidence(saved, saved.evidence!);
  assert.equal(
    evidenceSources(saved, supplied).find((source) => source.id === "T1")
      ?.origin,
    "user-reviewed",
  );
  const prompt = analysisPrompt(saved, saved.evidence!, {
    brandContext: "",
  } as Settings);
  assert.match(prompt, /A ceramic kettle/);
  assert.doesNotMatch(prompt, /Synthetic words\./);
  assert.match(
    buildCatalogueSearch([saved], [account]).get(saved.id)!,
    /ceramic kettle/,
  );
  const markdown = reelMarkdown(saved);
  assert.match(markdown, /Transcript used for this report/);
  assert.match(markdown, /Synthetic words\./);
  assert.doesNotMatch(markdown, /ceramic kettle/);
  assert.equal(store.getUsage().length, 0);
  store.ingest([{ ...original, views: 300 }]);
  assert.equal(
    currentTranscript(store.getReel(original.id)!)?.segments[0].text,
    "A ceramic kettle.",
  );
  assert.equal(
    store.getJobs().length,
    0,
    "Saving a correction must never enqueue inference",
  );
  const refreshed = {
    ...saved,
    analysis: {
      ...saved.analysis!,
      transcriptRevision: transcriptContentVersion(supplied.transcript),
    },
  };
  assert.equal(transcriptChangedSinceReport(refreshed), false);
});

test("stale views, replaced media and a newly transcribed source cannot overwrite or reuse old corrections", () => {
  const original = fixture("stale-review");
  save(original, ["Corrected line.", "Tea on the table."]);
  assert.throws(
    () => save(original, ["Stale tab edit.", "Tea on the table."]),
    /changed in another view/,
  );
  const saved = store.getReel(original.id)!;
  assert.equal(
    currentTranscript({ ...saved, mediaRevision: "replaced-media" })
      ?.segments[0].text,
    "Synthetic words.",
  );
  const retranscribed = {
    ...saved,
    evidence: {
      ...saved.evidence!,
      transcript: {
        ...saved.evidence!.transcript,
        text: "A new recognition result.",
        segments: [{ start: 0, end: 2, text: "A new recognition result." }],
      },
    },
  };
  assert.equal(
    currentTranscript(retranscribed)?.text,
    "A new recognition result.",
  );
  store.saveReel(retranscribed);
  assert.throws(
    () => save(saved, ["Corrected line.", "Tea on the table."]),
    /changed in another view/,
  );
});

test("clearing hallucinated speech keeps evidence IDs stable and original wording can be restored", () => {
  const original = fixture("cleared-line");
  save(original, ["", "Tea on the table."]);
  const saved = store.getReel(original.id)!;
  const supplied = analysisEvidence(saved, saved.evidence!);
  const sources = evidenceSources(saved, supplied);
  assert.ok(!sources.some((source) => source.id === "T1"));
  assert.equal(
    sources.find((source) => source.id === "T2")?.text,
    "Tea on the table.",
  );
  assert.match(
    transcriptSrt(supplied.transcript),
    /^1\n00:00:04,000 --> 00:00:08,000\nTea on the table\./,
  );
  handleTranscript(
    transcriptActions.parse({
      action: "transcript-reset",
      reelId: saved.id,
      expectedRevision: transcriptEditVersion(saved),
    }),
  );
  assert.equal(
    currentTranscript(store.getReel(saved.id)!)?.text,
    original.evidence!.transcript.text,
  );
  assert.equal(transcriptChangedSinceReport(store.getReel(saved.id)!), false);
});

test("active jobs and uploads block transcript changes, and the API cannot retime or add source segments", () => {
  const original = fixture("busy-review");
  const now = new Date().toISOString();
  const job: Job = {
    id: "review-blocker",
    kind: "analyze",
    accountId: null,
    reelIds: [original.id],
    phase: "queued",
    detail: "Synthetic queued fixture",
    completed: 0,
    total: 1,
    errors: [],
    createdAt: now,
    updatedAt: now,
    resultId: null,
    params: {},
  };
  store.saveJob(job);
  assert.throws(
    () => save(original, ["Changed", "Tea on the table."]),
    /active job/,
  );
  store.saveJob({ ...job, phase: "cancelled" });
  assert.throws(
    () => save(original, ["One missing segment"]),
    /segments and timing/,
  );
  const release = reserveUpload(original.id);
  try {
    assert.throws(
      () => save(original, ["Changed", "Tea on the table."]),
      /being replaced/,
    );
  } finally {
    release();
  }
});

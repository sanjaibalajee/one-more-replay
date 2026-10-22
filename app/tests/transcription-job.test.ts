import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type {
  Job,
  Reel,
  MediaEvidence,
  Settings,
} from "../src/lib/replay/types";
import { reportFixture } from "./fixtures/report";
import {
  transcriptContentVersion,
  transcriptEditVersion,
} from "../src/lib/replay/transcript";

const directory = mkdtempSync(path.join(tmpdir(), "replay-transcribe-job-"));
process.env.REPLAY_DATA_DIR = directory;
const mode = path.join(directory, "mode"),
  python = path.join(directory, "python");
writeFileSync(
  python,
  `#!${process.execPath}\nconst fs=require('node:fs'); const mode=fs.readFileSync(${JSON.stringify(mode)},'utf8'); if(mode==='fail'){process.stderr.write('fixture recognition failure');process.exit(1)} if(mode==='wait'){setInterval(()=>{},1000)} else console.log(JSON.stringify({text:'New words.',language:'ta',segments:[{start:0,end:1.8,text:'New words.',words:[{start:0,end:0.8,text:'New'},{start:0.9,end:1.8,text:' words.'}]}],engine:'faster-whisper',model:'small',status:'completed',note:'Synthetic recognizer output'}));\n`,
  { mode: 0o700 },
);
process.env.REPLAY_PYTHON = python;
const store = await import("../src/lib/replay/store");
const { mediaDir } = await import("../src/lib/replay/paths");
const { extractEvidence } = await import("../src/lib/replay/media");
const { handleTranscript, transcriptActions } =
  await import("../src/lib/replay/transcript-api");
const { cancelJob } = await import("../src/lib/replay/jobs");
const account = store.addAccount("transcription_job_fixture");
const id = "transcription-job",
  dir = mediaDir(id);
const evidence: MediaEvidence = {
  samplingVersion: 3,
  duration: 2,
  width: 180,
  height: 320,
  frames: [{ file: "frame-v3-1-90.jpg", seconds: 1.9 }],
  hasAudio: true,
  sceneChanges: [],
  warnings: [],
  transcript: {
    text: "Old words.",
    language: "en",
    engine: "faster-whisper",
    model: "base",
    status: "completed",
    note: "Fixture",
    segments: [{ start: 0, end: 2, text: "Old words." }],
  },
};
execFileSync("ffmpeg", [
  "-nostdin",
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=s=180x320:r=15:d=2",
  "-f",
  "lavfi",
  "-i",
  "sine=duration=2",
  "-c:v",
  "libx264",
  "-c:a",
  "aac",
  "-shortest",
  path.join(dir, "video.mp4"),
]);
writeFileSync(path.join(dir, evidence.frames[0].file), "fixture frame");
writeFileSync(path.join(dir, "evidence.json"), JSON.stringify(evidence));
const fixture = (): Reel => ({
  id,
  accountId: account.id,
  shortcode: id,
  url: "",
  caption: "Synthetic retry",
  thumbnail: "",
  videoUrl: "",
  views: null,
  likes: null,
  comments: null,
  postedAt: null,
  collectedAt: "now",
  mediaRevision: "original",
  source: "upload",
  status: "completed",
  error: null,
  starred: false,
  evidence: structuredClone(evidence),
  analysis: reportFixture(),
  analysisProvider: "Fixture",
  analyzedAt: "now",
});
const retry = (reel: Reel, replaceCorrections = false) =>
  handleTranscript(
    transcriptActions.parse({
      action: "transcript-retry",
      reelId: reel.id,
      expectedRevision: transcriptEditVersion(reel),
      options: { model: "small", language: "ta" },
      replaceCorrections,
    }),
  );
async function finished(id: string) {
  for (let i = 0; i < 100; i++) {
    const job = store.getJob(id)!;
    if (["failed", "completed", "cancelled"].includes(job.phase)) return job;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("Timed out waiting for local transcription fixture");
}
after(() => {
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});

test("local retry needs explicit replacement, publishes no LLM usage and keeps report citations", async () => {
  writeFileSync(mode, "success");
  const reel = fixture();
  reel.transcriptReview = {
    revision: "review",
    sourceRevision: transcriptContentVersion(evidence.transcript),
    mediaRevision: "original",
    updatedAt: "now",
    corrections: [{ index: 0, text: "My corrected words." }],
  };
  store.saveReel(reel);
  assert.throws(() => retry(reel), /replaces your wording/);
  const job: Job = await retry(reel, true).json();
  assert.throws(() => retry(reel, true), /active job/);
  assert.equal((await finished(job.id)).phase, "completed");
  const saved = store.getReel(id)!;
  assert.deepEqual(saved.analysis, reel.analysis);
  assert.equal(saved.analyzedAt, reel.analyzedAt);
  assert.equal(saved.transcriptReview, undefined);
  assert.equal(saved.evidence?.transcript.text, "New words.");
  assert.equal(saved.evidence?.transcript.segments[0].words?.length, 2);
  assert.deepEqual(saved.evidence?.transcriptionSettings, {
    model: "small",
    language: "ta",
  });
  assert.equal(store.getJob(job.id)?.usage?.length || 0, 0);
  assert.equal(store.getJob(job.id)?.execution, undefined);
  assert.deepEqual(store.getUsage(), []);
  // Reanalysis must not silently return the stale manifest or global model/language.
  const reused = await extractEvidence(
    saved,
    { whisperModel: "base", language: "en" } as Settings,
    new AbortController().signal,
    () => {},
  );
  assert.equal(reused.transcript.text, "New words.");
  assert.equal(reused.transcript.model, "small");
});

test("failed and cancelled retries leave transcript, corrections and report unchanged", async () => {
  const reel = fixture();
  store.saveReel(reel);
  writeFileSync(mode, "fail");
  const failed: Job = await retry(reel).json();
  assert.equal((await finished(failed.id)).phase, "failed");
  assert.deepEqual(store.getReel(id), reel);
  writeFileSync(mode, "wait");
  const waiting: Job = await retry(reel).json();
  await new Promise((resolve) => setTimeout(resolve, 200));
  cancelJob(waiting.id);
  assert.equal((await finished(waiting.id)).phase, "cancelled");
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.deepEqual(store.getReel(id), reel);
  assert.equal(
    transcriptActions.safeParse({
      action: "transcript-retry",
      reelId: id,
      expectedRevision: transcriptEditVersion(reel),
      options: { model: "small", language: "notalanguage" },
    }).success,
    false,
  );
});

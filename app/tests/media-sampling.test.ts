import test, { after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import type { MediaEvidence, Reel, Settings } from "../src/lib/replay/types";

const temporary = mkdtempSync(path.join(tmpdir(), "replay-sampling-"));
process.env.REPLAY_DATA_DIR = temporary;
const { mediaDir } = await import("../src/lib/replay/paths");
const { extractEvidence, samplingComplete } = await import("../src/lib/replay/media");
after(() => rmSync(temporary, { recursive: true, force: true }));

test("upgrading cached sampling preserves saved report frames and caches the complete new evidence", async () => {
  const reel = { id: "sampling-fixture" } as Reel;
  const dir = mediaDir(reel.id);
  execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=180x320:r=15:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(dir, "video.mp4")]);
  writeFileSync(path.join(dir, "frame-00.jpg"), "Saved report's original frame");
  const cached: MediaEvidence = { duration: 2, width: 180, height: 320, hasAudio: false, frames: [{file: "frame-00.jpg", seconds: 0}], sceneChanges: [], transcript: {text: "", segments: [], language: null, engine: "none", model: "", status: "no-audio", note: "Synthetic fixture"}, warnings: [] };
  writeFileSync(path.join(dir, "evidence.json"), JSON.stringify(cached));
  const phases: string[] = [];
  const evidence = await extractEvidence(reel, {whisperModel: "base", language: ""} as Settings, new AbortController().signal, (_phase, detail) => phases.push(detail));
  assert.ok(samplingComplete(evidence));
  assert.ok(evidence.frames.every(frame => /^frame-v3-/.test(frame.file)));
  assert.equal(readFileSync(path.join(dir, "frame-00.jpg"), "utf8"), "Saved report's original frame");
  assert.ok(evidence.frames.some(frame => frame.seconds >= 1.75));
  assert.ok(phases.some(detail => detail.startsWith("Extracting frame")));
  phases.length = 0;
  assert.deepEqual(await extractEvidence(reel, {whisperModel: "base", language: ""} as Settings, new AbortController().signal, (_phase, detail) => phases.push(detail)), evidence);
  assert.deepEqual(phases, ["Checking saved frames and transcript."]);
});

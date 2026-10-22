// Manually run with a synthetic video. Uses the signed-in Codex subscription.
import assert from "node:assert/strict";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Reel } from "../src/lib/replay/types";
process.env.REPLAY_DATA_DIR = path.resolve(`../.local/live-${Date.now()}`);
const { addAccount, getJob, getReel, saveReel, saveSettings } = await import("../src/lib/replay/store");
const { mediaDir } = await import("../src/lib/replay/paths");
const { enqueue } = await import("../src/lib/replay/jobs");
const { reelMarkdown } = await import("../src/lib/replay/export");
saveSettings({ brief: { business: "Synthetic test brief: a bicycle repair shop teaching simple maintenance, with no fabricated customer claims.", audience: "New cyclists who want to understand basic repairs.", language: "English", tone: "Clear and calm", constraints: "One person, one phone, a workshop bench, 30 minutes. No paid actors or special equipment.", goal: "Qualified repair enquiries" } });
const account = addAccount("local_fixture");
const id = `local_${randomUUID()}`;
await copyFile(path.resolve(process.argv[2] || "../.local/fixtures/replay-test.mp4"), path.join(mediaDir(id), "video.mp4"));
const reel: Reel = { id, accountId: account.id, shortcode: "synthetic-integration-fixture", url: "", caption: "A synthetic integration test video made locally. No real social-media performance exists for this clip.", thumbnail: "", videoUrl: "", views: null, likes: null, comments: null, postedAt: null, collectedAt: new Date().toISOString(), source: "upload", status: "idle", error: null, starred: false, evidence: null, analysis: null, analysisProvider: null, analyzedAt: null };
saveReel(reel);
const job = enqueue("analyze", null, [id]);
let last = "";
for (let i = 0; i < 900; i++) {
  const current = getJob(job.id)!;
  if (current.phase !== last) { console.log(current.phase, current.detail); last = current.phase; }
  if (current.phase === "failed") throw new Error(current.errors.join("\n"));
  if (current.phase === "completed") {
    const result = getReel(id)!;
    assert.equal(result.analysis?.version, 2); assert.equal(result.analysis.suggestedAngles.length, 3); assert.ok(result.analysis.sources?.length); assert.ok(result.analysis.findings?.some(f => f.kind === "distinctive")); assert.ok(result.evidence?.frames.length);
    assert.equal(result.evidence.transcript.status, "completed");
    assert.ok(result.evidence.transcript.text.toLowerCase().includes("synthetic"));
    assert.ok(reelMarkdown(result).includes("## Observed evidence"));
    console.log(JSON.stringify({ provider: result.analysisProvider, duration: result.evidence.duration, frames: result.evidence.frames.length, transcript: result.evidence.transcript.text, concepts: result.analysis.suggestedAngles.map(idea => ({ title: idea.idea, opening: idea.opening, resources: idea.resources, shots: idea.shotList?.length })), history: current.history?.map(stage => stage.phase), title: result.analysis.title, summary: result.analysis.summary, dataDirectory: process.env.REPLAY_DATA_DIR }, null, 2));
    break;
  }
  if (i === 899) throw new Error("Live analysis timed out.");
  await new Promise(resolve => setTimeout(resolve, 1000));
}

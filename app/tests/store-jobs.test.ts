import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Job } from "../src/lib/replay/types";
const directory = mkdtempSync(path.join(tmpdir(), "replay-tests-"));
process.env.REPLAY_DATA_DIR = directory;
const store = await import("../src/lib/replay/store");
const { normalizeReel } = await import("../src/lib/replay/catalogue");
const { cancelJob, initializeQueue, enqueue } = await import("../src/lib/replay/jobs");
after(() => { store.db().close(); rmSync(directory, { recursive: true, force: true }); });
const account = store.addAccount("replay_fixture");
const fixture = () => normalizeReel({ url: "https://instagram.com/reel/Fixture123/", caption: "Synthetic test fixture", videoPlayCount: 100 }, account.id, "import")!;
const analysis = { title: "Synthetic report fixture", summary: "Test only.", hook: { label: "test", spokenHook: "test", visualHook: "test", explanation: "test" }, beats: [], observations: [], hypotheses: [], pacing: "test", payoff: "test", cta: "test", transferablePatterns: [], suggestedAngles: [], limitations: ["Synthetic fixture."] };
function job(id: string, phase: Job["phase"]): Job { const now = new Date().toISOString(); return { id, kind: "analyze", accountId: null, reelIds: [fixture().id], phase, detail: "Test", completed: 0, total: 1, errors: [], createdAt: now, updatedAt: now, resultId: null, params: {} }; }

test("account insertion is idempotent and imports refresh metadata without losing reports", () => {
  assert.equal(store.addAccount("@REPLAY_FIXTURE").id, account.id);
  const reel = { ...fixture(), analysis, status: "completed" as const, starred: true };
  store.saveReel(reel); store.ingest([{ ...fixture(), views: 500 }]);
  const saved = store.getReel(reel.id)!;
  assert.equal(saved.views, 500); assert.equal(saved.analysis?.title, analysis.title); assert.equal(saved.starred, true); assert.equal(saved.status, "completed");
  assert.equal(store.getReels().length, 1);
});
test("public snapshots never expose configured provider secrets", () => {
  store.saveSettings({ apifyToken: "apify_api_test_secret", openaiKey: "sk-test-secret", provider: "codex" });
  const publicData = JSON.stringify(store.snapshot());
  assert.ok(!publicData.includes("apify_api_test_secret")); assert.ok(!publicData.includes("sk-test-secret"));
  assert.equal(store.publicSettings().hasApifyToken, true); assert.equal(store.publicSettings().hasOpenaiKey, true);
});
test("queued cancellation keeps existing reports and media metadata", () => {
  store.saveJob(job("cancel-fixture", "queued")); cancelJob("cancel-fixture");
  assert.equal(store.getJob("cancel-fixture")?.phase, "cancelled");
  assert.equal(store.getReel(fixture().id)?.analysis?.title, analysis.title);
});
test("server restart marks interrupted work retryable without losing its report", () => {
  store.saveReel({ ...store.getReel(fixture().id)!, status: "analyzing" });
  store.saveJob(job("restart-fixture", "analyzing")); initializeQueue();
  assert.equal(store.getJob("restart-fixture")?.phase, "failed");
  assert.equal(store.getReel(fixture().id)?.status, "failed");
  assert.ok(store.getReel(fixture().id)?.analysis);
});
test("a saved analysis is reused without calling a model", async () => {
  const queued = enqueue("analyze", null, [fixture().id]);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(store.getJob(queued.id)?.phase, "completed");
  assert.equal(store.getJob(queued.id)?.completed, 1);
});

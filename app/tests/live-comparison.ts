// Explicit integration check using one real synthetic report and a labeled duplicate fixture.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
process.env.REPLAY_DATA_DIR = path.resolve(process.argv[2]);
const { getReels, getJob, getComparison, saveReel } = await import("../src/lib/replay/store");
const { enqueue } = await import("../src/lib/replay/jobs");
const first = getReels().find(r => r.analysis)!; assert.ok(first);
const second = { ...first, id: `local_${randomUUID()}`, caption: "Intentional duplicate of the same synthetic integration fixture. Not independent evidence of any performance pattern." };
saveReel(second);
const job = enqueue("compare", null, [first.id, second.id]);
for (let i = 0; i < 720; i++) {
  const current = getJob(job.id)!;
  if (current.phase === "failed") throw new Error(current.errors.join("\n"));
  if (current.phase === "completed") { const result = getComparison(current.resultId!)!; assert.ok(result.report.title); console.log(JSON.stringify({ id: result.id, provider: result.provider, title: result.report.title, summary: result.report.summary, limitations: result.report.limitations }, null, 2)); break; }
  if (i === 719) throw new Error("Comparison timed out.");
  await new Promise(resolve => setTimeout(resolve, 1000));
}

import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../src/lib/replay/process";
test("process cancellation stops a running child and reports cancellation", async () => {
  const controller = new AbortController();
  const pending = run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { signal: controller.signal });
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(pending, /Cancelled/);
});
test("process timeouts stop work instead of silently leaving it running", async () => {
  await assert.rejects(run(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { timeout: 100 }), /timed out/);
});

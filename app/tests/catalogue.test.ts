import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHandle, normalizeReel, performanceFor, safeCdnUrl, safeInstagramUrl } from "../src/lib/replay/catalogue";
import { frameTimes, samplingComplete, SAMPLING_VERSION } from "../src/lib/replay/media";
import type { MediaEvidence } from "../src/lib/replay/types";
import { guard } from "../src/lib/replay/http";

test("normalizes handles and profile URLs without accepting post URLs or other sites", () => {
  assert.equal(normalizeHandle(" @Replay.Test_ "), "replay.test_");
  assert.equal(normalizeHandle("https://www.instagram.com/Replay.Test/reels/?hl=en"), "replay.test");
  for (const input of ["https://evil.example/user", "https://instagram.com/reel/ABCD/", "foo/bar", "", "x".repeat(31), "a..b"]) assert.throws(() => normalizeHandle(input));
});
test("canonicalizes Reel URLs and rejects arbitrary media destinations", () => {
  assert.equal(safeInstagramUrl("https://instagram.com/reel/abc_123/?tracking=1"), "https://www.instagram.com/reel/abc_123/");
  for (const url of ["http://instagram.com/reel/123/", "https://127.0.0.1/reel/123/", "https://instagram.com/not-a-reel"]) assert.throws(() => safeInstagramUrl(url));
  assert.ok(safeCdnUrl("https://scontent.cdninstagram.com/v/test.mp4"));
  for (const url of ["http://scontent.cdninstagram.com/a", "https://cdninstagram.com.evil.example/a", "https://127.0.0.1/a", "https://scontent.cdninstagram.com:444/a"]) assert.throws(() => safeCdnUrl(url));
});
const row = (views?: number) => normalizeReel({ url: "https://instagram.com/reel/TestFixture/", caption: "Synthetic fixture", videoPlayCount: views }, "account", "import")!;
test("preserves unknown counts and removes unsafe CDN links", () => {
  const reel = normalizeReel({ url: "https://instagram.com/reel/Test/", thumbnail: "http://localhost/private", videoUrl: "https://evil.example/video.mp4", likesCount: -1, commentsCount: 0 }, "account", "import")!;
  assert.equal(reel.views, null); assert.equal(reel.likes, null); assert.equal(reel.comments, 0); assert.equal(reel.videoUrl, ""); assert.equal(reel.thumbnail, "");
  assert.equal(normalizeReel({ url: "https://instagram.com/p/Test/", type: "Image" }, "a", "import"), null);
});
test("different Reel URLs keep distinct stable IDs and actual shortcodes", () => {
  const first = normalizeReel({ url: "https://instagram.com/reel/FirstFixture/" }, "a", "import")!;
  const second = normalizeReel({ url: "https://instagram.com/reel/SecondFixture/" }, "a", "import")!;
  assert.equal(first.shortcode, "FirstFixture"); assert.notEqual(first.id, second.id);
  assert.equal(first.id, normalizeReel({ url: "https://www.instagram.com/reel/FirstFixture/?x=y" }, "a", "apify")!.id);
});
test("baseline excludes the target, unknown counts, other accounts, and uploads", () => {
  const target = { ...row(10000), id: "target" };
  const others = [100, 200, 300, 400, 500].map((views, i) => ({ ...row(views), id: String(i) }));
  const result = performanceFor(target, [target, ...others, { ...row(), id: "unknown" }, { ...row(999999), id: "other", accountId: "other" }, { ...row(999999), id: "upload", source: "upload" }]);
  assert.equal(result.medianViews, 300); assert.equal(result.sampleSize, 5); assert.equal(result.multiple, 10000 / 300);
  assert.equal(performanceFor(target, others.slice(0, 4)).multiple, null);
  assert.equal(performanceFor(target, others.map(r => ({ ...r, views: 0 }))).multiple, null);
});
test("frame sampling covers the hook and the end without timestamps beyond duration", () => {
  const times = frameTimes(60);
  assert.deepEqual(times.slice(0, 5), [0, 0.5, 1, 2, 3]);
  assert.ok(times.at(-1)! > 59); assert.ok(times.length <= 18);
  for (const length of [0.2, 1, 3, 15, 600]) assert.ok(frameTimes(length).every(t => t >= 0 && t < length));
});
test("scene-aware sampling stays bounded and stale evidence cannot omit the closing moment", () => {
  const times = frameTimes(41.7, [6.13, 7.53, 12.66, 19.46, 24.76, 33.13, 38.9]);
  assert.ok(times.length <= 20);
  assert.equal(times.at(-1), 41.6);
  assert.ok(times.includes(6.21), "sample the scene change that falls between uniform frames");
  const old = { duration: 41.7, frames: [{ file: "frame-16.jpg", seconds: 38.4 }] } as MediaEvidence;
  assert.equal(samplingComplete(old), false);
  assert.equal(samplingComplete({ ...old, samplingVersion: SAMPLING_VERSION }), false);
  assert.equal(samplingComplete({ ...old, samplingVersion: SAMPLING_VERSION, frames: [{ file: "frame-v2-41-60.jpg", seconds: 41.6 }] }), true);
});
test("local API guard rejects cross-origin and public-host requests", () => {
  guard(new Request("http://127.0.0.1:3210/api/replay"));
  guard(new Request("http://localhost:3210/api/replay", { headers: { host: "127.0.0.1:3210", origin: "http://127.0.0.1:3210" } }));
  assert.throws(() => guard(new Request("http://127.0.0.1:3210/api/replay", { headers: { origin: "https://evil.example" } })));
  assert.throws(() => guard(new Request("https://public.example/api/replay")));
  assert.throws(() => guard(new Request("http://127.0.0.1:3210/api/replay", { headers: { "sec-fetch-site": "cross-site" } })));
});

test("similar baselines match duration and age, falling back visibly when peers are scarce", () => {
  const dates = { postedAt: "2026-10-01T00:00:00Z", collectedAt: "2026-10-10T00:00:00Z" };
  const target = { ...row(10000), ...dates, durationSeconds: 30, id: "target" };
  const peers = [100, 200, 300, 400, 500].map((views, i) => ({ ...row(views), ...dates, durationSeconds: 25 + i, id: `peer-${i}` }));
  const wrongLength = { ...row(999999), ...dates, durationSeconds: 120, id: "long" };
  const young = { ...row(999999), ...dates, postedAt: "2026-10-09T12:00:00Z", durationSeconds: 30, id: "young" };
  const result = performanceFor(target, [...peers, wrongLength, young]);
  assert.equal(result.cohort, "similar"); assert.equal(result.medianViews, 300); assert.equal(result.sampleSize, 5);
  assert.equal(result.ageDays, 9); assert.equal(result.quality, "weak"); assert.equal(result.standout, true);
  const fallback = performanceFor(target, [...peers.slice(0, 4), wrongLength, young]);
  assert.equal(fallback.cohort, "account"); assert.match(fallback.note, /broader account/);
});

test("pair comparisons flag mismatched format, length, age and account, without guessing missing fields", async () => {
  const { comparisonContext } = await import("../src/lib/replay/catalogue");
  const first = { ...row(10000), id: "a", durationSeconds: 20 };
  const second = { ...row(500), id: "b", durationSeconds: 100, accountId: "other" };
  const context = comparisonContext([first, second]);
  assert.equal(context.quality, "weak");
  assert.ok(context.pairs[0].reasons.some(reason => reason.includes("1.5×")));
  assert.ok(context.pairs[0].reasons.some(reason => reason.includes("format")));
  assert.ok(context.pairs[0].reasons.some(reason => reason.includes("age")));
  assert.equal(context.rows[0].format, null);
});

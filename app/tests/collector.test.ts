import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { collectReels } from "../src/lib/replay/collector";

test("collection sends the documented account/limit contract and retains every valid returned Reel", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); calls.push({ url, init });
    return Response.json(url.includes("/runs?") ? { data: { id: "test-run", status: "SUCCEEDED", defaultDatasetId: "test-dataset" } } : [
      { url: "https://instagram.com/reel/FixtureOne/", videoPlayCount: 200 },
      { url: "https://instagram.com/reel/FixtureTwo/", videoPlayCount: 100 },
      { url: "https://instagram.com/p/PhotoFixture/", type: "Image" },
      { url: "https://instagram.com/reel/OtherOwnerFixture/", owner:{username:"another_creator"}, videoPlayCount:999999 },
    ]);
  });
  try {
    const result = await collectReels("fixture", "test-account", 50, "test-token", new AbortController().signal, () => {});
    assert.equal(result.reels.length, 2); assert.notEqual(result.reels[0].id, result.reels[1].id);
    assert.ok(calls[0].url.includes("apify~instagram-reel-scraper/runs?maxItems=50"));
    const body = JSON.parse(String(calls[0].init?.body));
    assert.deepEqual(body.username, ["fixture"]); assert.equal(body.resultsLimit, 50); assert.equal(body.includeTranscript, false);
    assert.match(result.note, /does not guarantee complete account coverage/);
  } finally { mock.restoreAll(); }
});
test("collection reports missing credits without inventing an empty successful catalogue", async () => {
  mock.method(globalThis, "fetch", async () => new Response("", { status: 402 }));
  try { await assert.rejects(collectReels("fixture", "a", 50, "test-token", new AbortController().signal, () => {}), /needs scraping credits/); }
  finally { mock.restoreAll(); }
});

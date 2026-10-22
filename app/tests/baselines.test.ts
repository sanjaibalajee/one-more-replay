import test from "node:test";
import assert from "node:assert/strict";
import { cataloguePerformances } from "../src/lib/replay/baselines";
import { performanceFor } from "../src/lib/replay/catalogue";
import type { Reel } from "../src/lib/replay/types";
import { reportFixture } from "./fixtures/report";

test("indexed baselines preserve peer exclusions, missing dimensions, medians and fallback decisions", () => {
  let seed = 1234567;
  const next = (max: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
  const reels = Array.from({length: 700}, (_, i) => ({
    id: `fixture_${i}`, accountId: `account_${next(2)}`, creatorKey: next(4) ? `creator_${next(3)}` : undefined,
    platform: next(5) ? "instagram" : "youtube", source: ["import","link","upload"][next(3)],
    durationSeconds: next(5) ? [10,15,20,30,45,60,90,120][next(8)] : null,
    views: next(9) ? next(200) : null, postedAt: next(6) ? "2026-09-01T00:00:00Z" : null,
    collectedAt: next(4) ? "2026-10-22T00:00:00Z" : "2026-09-01T12:00:00Z",
    analysis: next(5) ? {...reportFixture(),format:["demonstration","tutorial","other"][next(3)]} : null,
    evidence: null,
  } as Reel));
  const indexed = cataloguePerformances(reels);
  for (const reel of reels) assert.deepEqual(indexed.get(reel.id), performanceFor(reel, reels), reel.id);
});
test("a 5,000-Reel catalogue supports distinct duration windows without per-Reel sorting", t => {
  const reels = Array.from({length:5000},(_,i)=>({id:`large_${i}`,accountId:"one",source:"import",platform:"instagram",durationSeconds:10+i/100,views:i%137,postedAt:"2026-09-01T00:00:00Z",collectedAt:"2026-10-22T00:00:00Z",analysis:{...reportFixture(),format:"demonstration"},evidence:null} as Reel));
  const start = performance.now(), indexed = cataloguePerformances(reels);
  t.diagnostic(`5000 distinct-duration baselines: ${Math.round(performance.now()-start)} ms`);
  assert.equal(indexed.size,5000);
  for(const i of [0,1,99,1000,2500,4999]) assert.deepEqual(indexed.get(reels[i].id),performanceFor(reels[i],reels));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCatalogueSearch,
  catalogueMatches,
} from "../src/lib/replay/catalogue-search";
import {
  scriptLength,
  scriptText,
  scriptMarkdown,
} from "../src/lib/replay/script";
import { mergeActivity } from "../src/components/replay/workspace/merge-activity";
import { reportFixture } from "./fixtures/report";
import type { Job, Reel, Snapshot } from "../src/lib/replay/types";
import { restoreDraftState } from "../src/components/replay/ideas/draft-state";
import type { IdeaSession } from "../src/lib/replay/idea-types";

test("creator search covers saved evidence, notes and reports, including Unicode and separated query terms", () => {
  const reel = {
    id: "search",
    accountId: "creator",
    caption: "A recipe",
    shortcode: "Source123",
    annotation: {
      notes: "Try a quieter opening",
      tags: ["weekend"],
      hookType: "unknown",
      ctaType: "unknown",
    },
    analysis: reportFixture(),
    evidence: {
      transcript: { text: "புதிதாக தொடங்கலாம். An unexpected ingredient." },
    },
  } as Reel;
  const index = buildCatalogueSearch([reel], []);
  assert.ok(catalogueMatches(index.get(reel.id), "weekend QUIETER"));
  assert.ok(catalogueMatches(index.get(reel.id), "unexpected ingredient"));
  assert.ok(catalogueMatches(index.get(reel.id), "புதிதாக"));
  assert.ok(catalogueMatches(index.get(reel.id), reel.analysis!.title));
  assert.ok(catalogueMatches(index.get(reel.id), "Ｓｏｕｒｃｅ１２３"));
  assert.ok(catalogueMatches(index.get(reel.id), "  "));
  assert.equal(
    catalogueMatches(index.get(reel.id), "unavailable words"),
    false,
  );
});
test("background activity retains unchanged catalogue objects and never overwrites report payloads", () => {
  const reel = {
    id: "reel",
    status: "analyzing",
    error: null,
    analysis: reportFixture(),
  } as Reel;
  const job = {
    id: "job",
    phase: "analyzing",
    detail: "Writing report",
    usage: [],
  } as unknown as Job;
  const snapshot = { reels: [reel], jobs: [job] } as Snapshot;
  assert.equal(
    mergeActivity(snapshot, {
      reels: [{ id: reel.id, status: reel.status, error: null }],
      jobs: [structuredClone(job)],
    }),
    snapshot,
  );
  const progress = mergeActivity(snapshot, {
    reels: [],
    jobs: [{ ...job, detail: "Finishing report" }],
  });
  assert.notEqual(progress, snapshot);
  assert.equal(progress.reels, snapshot.reels);
  const updated = mergeActivity(snapshot, {
    reels: [
      { id: reel.id, status: "completed", error: null, analysis: null } as Reel,
    ],
    jobs: [job],
  });
  assert.notEqual(updated.reels, snapshot.reels);
  assert.equal(updated.reels[0].analysis, reel.analysis);
  assert.equal(snapshot.reels[0].status, "analyzing");
});
test("spoken-length and export use the current script, preserve Unicode and exclude title and production notes", () => {
  const draft = {
    title: "A long descriptive title",
    hook: "One small change.",
    body: "Make it today.",
    cta: "",
    notes: "Camera instructions are not spoken.",
  };
  assert.equal(scriptText(draft), "One small change.\n\nMake it today.");
  assert.deepEqual(scriptLength(draft), {
    words: 6,
    fastSeconds: 2,
    slowSeconds: 3,
  });
  assert.ok(scriptMarkdown(draft).includes("## Production notes"));
  assert.ok(!scriptMarkdown(draft).includes("## CTA"));
  assert.ok(
    scriptLength({ ...draft, hook: "", body: "இன்று தொடங்கலாம்." }).words > 0,
  );
  assert.equal(
    scriptLength({ ...draft, hook: "", body: "", cta: "" }).words,
    0,
  );
});
test("saving a stage retains an unsent question while a new reply replaces stale script edits", () => {
  const draft = {
    title: "Draft",
    hook: "Opening",
    body: "Saved script",
    cta: "",
    notes: "",
  };
  const session = {
    draft,
    updatedAt: "new",
    messages: [],
    stage: "ready",
  } as unknown as IdeaSession;
  const cached = {
    version: "old",
    draft: { ...draft, body: "Stale script" },
    message: "Make it shorter",
    messageCount: 0,
    stage: "posted",
    tab: "conversation",
    chat: true,
  };
  const restored = restoreDraftState(session, cached);
  assert.equal(restored.draft.body, "Saved script");
  assert.equal(restored.stage, "ready");
  assert.equal(restored.message, "Make it shorter");
  assert.equal(restored.tab, "conversation");
  assert.equal(
    restoreDraftState(
      { ...session, messages: [{ id: "reply" } as never] },
      cached,
    ).message,
    "",
  );
  assert.equal(
    restoreDraftState(session, {
      ...cached,
      version: "new",
      draft: { ...draft, body: "" },
    }).draft.body,
    "",
  );
  assert.equal(
    restoreDraftState(session, {
      ...cached,
      version: "new",
      draft: { ...draft, body: "x".repeat(6000) },
    }).draft.body,
    "Saved script",
  );
});

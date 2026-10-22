import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { reportFixture } from "./fixtures/report";
import type { Reel } from "../src/lib/replay/types";
const directory = mkdtempSync(path.join(tmpdir(), "replay-ideas-"));
process.env.REPLAY_DATA_DIR = directory;
const store = await import("../src/lib/replay/store");
const { handleIdea } = await import("../src/lib/replay/idea-api");
after(() => {
  store.db().close();
  rmSync(directory, { recursive: true, force: true });
});
const account = store.addAccount("idea_fixture"),
  now = "2026-10-22T00:00:00Z";
const report = {
  ...reportFixture(),
  sources: [
    {
      id: "F1",
      kind: "frame" as const,
      label: "Frame",
      seconds: 0,
      text: "Synthetic source evidence",
    },
  ],
};
const reel: Reel = {
  id: "idea_source",
  accountId: account.id,
  shortcode: "IdeaSource",
  url: "",
  caption: "Synthetic fixture",
  thumbnail: "",
  videoUrl: "",
  views: null,
  likes: null,
  comments: null,
  postedAt: null,
  collectedAt: now,
  source: "upload",
  status: "completed",
  error: null,
  starred: false,
  evidence: null,
  analysis: report,
  analysisProvider: "fixture",
  analyzedAt: now,
};
store.saveReel(reel);
test("opening and saving a report idea use no model, preserve source versions and detect conflicting edits", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Opening/saving must not call a model");
  };
  try {
    const response = handleIdea({
      action: "idea-start",
      sourceKind: "reel",
      sourceId: reel.id,
      conceptIndex: 0,
    });
    const session = await response.json();
    assert.equal(response.status, 201);
    assert.equal(session.messages.length, 0);
    assert.equal(session.reportVersions[reel.id], now);
    const duplicate = await handleIdea({
      action: "idea-start",
      sourceKind: "reel",
      sourceId: reel.id,
      conceptIndex: 0,
    }).json();
    assert.equal(duplicate.id, session.id);
    const draft = { ...session.draft, body: "A manually edited script." };
    handleIdea({
      action: "idea-save",
      id: session.id,
      draft,
      expectedUpdatedAt: session.updatedAt,
    });
    assert.equal(store.getIdea(session.id)?.savedDraft?.body, draft.body);
    assert.throws(
      () =>
        handleIdea({
          action: "idea-save",
          id: session.id,
          draft,
          expectedUpdatedAt: "stale",
        }),
      /another view/,
    );
    assert.equal(store.getUsage().length, 0);
    assert.equal(store.getJobs().length, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("own ideas save without AI, retries are idempotent, and stage edits preserve concurrency and source state", async () => {
  const { randomUUID } = await import("node:crypto");
  const { ideaActions, handleIdea } = await import(
    "../src/lib/replay/idea-api"
  );
  const id = randomUUID(),
    text =
      "A slow Sunday breakfast\nShow the ingredients, then the first bite.";
  const originalFetch = globalThis.fetch,
    before = { usage: store.getUsage().length, jobs: store.getJobs().length };
  globalThis.fetch = async () => {
    throw new Error("Own ideas and stages must not call a model");
  };
  try {
    const response = handleIdea(
      ideaActions.parse({ action: "idea-create", id, text }),
    );
    assert.equal(response.status, 201);
    const session = await response.json();
    assert.equal(session.sourceKind, "manual");
    assert.equal(session.savedDraft.body, text);
    assert.equal(session.stage, "draft");
    assert.deepEqual(session.reelIds, []);
    assert.equal(
      (await handleIdea({ action: "idea-create", id, text }).json()).id,
      id,
    );
    assert.equal(store.getIdeas().filter((idea) => idea.id === id).length, 1);
    assert.throws(
      () => handleIdea({ action: "idea-create", id, text: "Changed retry" }),
      /already created/,
    );
    handleIdea({
      action: "idea-save",
      id,
      draft: {
        ...session.draft,
        hook: "Make breakfast worth slowing down for.",
      },
      stage: "ready",
      expectedUpdatedAt: session.updatedAt,
    });
    const ready = store.getIdea(id)!;
    assert.equal(ready.stage, "ready");
    assert.equal(
      ready.savedDraft?.hook,
      "Make breakfast worth slowing down for.",
    );
    assert.equal(ready.original.hook, "");
    assert.throws(
      () =>
        handleIdea({
          action: "idea-save",
          id,
          draft: session.draft,
          stage: "posted",
          expectedUpdatedAt: session.updatedAt,
        }),
      /another view/,
    );
    assert.equal(store.getIdea(id)?.stage, "ready");
    assert.throws(() =>
      ideaActions.parse({
        action: "idea-save",
        id,
        draft: ready.draft,
        stage: "scheduled",
        expectedUpdatedAt: ready.updatedAt,
      }),
    );
    assert.equal(store.getUsage().length, before.usage);
    assert.equal(store.getJobs().length, before.jobs);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("idea replies are queued, measured, saved separately and leave the source report intact", async () => {
  const session = store.getIdeas().find((idea) => idea.sourceKind === "reel")!,
    savedBody = session.savedDraft!.body;
  store.saveSettings({
    provider: "openai",
    openaiKey: "sk-synthetic-ideas",
    openaiModel: "gpt-6.1-sol",
  });
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (request, init) => {
    assert.match(String(request), /^https:\/\/api.openai.com\//);
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.match(JSON.stringify(body), /Make it shorter/);
    assert.match(JSON.stringify(body), /Synthetic source evidence/);
    assert.ok(!JSON.stringify(body).includes('"input_image"'));
    return Response.json({
      id: "fixture",
      object: "response",
      model: "gpt-6.1-sol",
      usage: {
        input_tokens: 1000,
        output_tokens: 200,
        input_tokens_details: { cached_tokens: 500 },
        output_tokens_details: { reasoning_tokens: 50 },
      },
      output: [
        {
          type: "message",
          id: "msg",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                reply: "Here is a shorter version.",
                draft: { ...session.draft, body: "Shorter script." },
              }),
              annotations: [],
            },
          ],
        },
      ],
    });
  };
  try {
    const response = handleIdea({
      action: "idea-message",
      id: session.id,
      message: "Make it shorter",
    });
    assert.equal(response.status, 202);
    const job = await response.json();
    assert.throws(
      () =>
        handleIdea({
          action: "idea-message",
          id: session.id,
          message: "Duplicate click",
        }),
      /current reply/,
    );
    for (
      let i = 0;
      i < 200 && !["completed", "failed"].includes(store.getJob(job.id)!.phase);
      i++
    )
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      store.getJob(job.id)?.phase,
      "completed",
      store.getJob(job.id)?.detail,
    );
    assert.equal(calls, 1);
    const updated = store.getIdea(session.id)!;
    assert.equal(updated.messages.length, 2);
    assert.equal(updated.messages[1].role, "assistant");
    assert.equal(updated.messages[1].usage?.totalTokens, 1200);
    assert.equal(updated.draft.body, "Shorter script.");
    assert.equal(updated.savedDraft?.body, savedBody);
    assert.deepEqual(store.getReel(reel.id)?.analysis, report);
    handleIdea({
      action: "idea-save",
      id: updated.id,
      draft: updated.draft,
      expectedUpdatedAt: updated.updatedAt,
    });
    assert.equal(
      store.getIdea(updated.id)?.savedDraft?.body,
      "Shorter script.",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("explicit chat on an own idea completes as one request without requiring a source Reel", async () => {
  const session = store
    .getIdeas()
    .find((idea) => idea.sourceKind === "manual")!;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      id: "manual-reply",
      object: "response",
      model: "gpt-6.1-sol",
      output: [
        {
          type: "message",
          id: "msg",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                reply: "Try this shorter version.",
                draft: {
                  ...session.draft,
                  hook: "One quiet minute.",
                  body: "Put the kettle on and leave the phone down.",
                },
              }),
              annotations: [],
            },
          ],
        },
      ],
    });
  };
  try {
    const response = handleIdea({
      action: "idea-message",
      id: session.id,
      message: "Make this shorter",
      draft: session.draft,
      stage: "ready",
      expectedUpdatedAt: session.updatedAt,
    });
    const job = await response.json();
    assert.equal(job.total, 1);
    assert.deepEqual(job.reelIds, []);
    for (
      let i = 0;
      i < 200 && !["completed", "failed"].includes(store.getJob(job.id)!.phase);
      i++
    )
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(
      store.getJob(job.id)?.phase,
      "completed",
      store.getJob(job.id)?.detail,
    );
    assert.equal(calls, 1);
    assert.equal(store.getIdea(session.id)?.draft.hook, "One quiet minute.");
    assert.equal(
      store.getIdea(session.id)?.savedDraft?.hook,
      session.savedDraft?.hook,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

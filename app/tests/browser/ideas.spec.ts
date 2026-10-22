import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { reportFixture } from "../fixtures/report";
import type { Snapshot, Reel } from "../../src/lib/replay/types";
import type { IdeaSession } from "../../src/lib/replay/idea-types";
import type { ModelUsage } from "../../src/lib/replay/usage-types";

test("optional idea chat preserves edits, saves exact drafts and exposes model usage without automatic AI work", async ({
  page,
  request,
}) => {
  const data: Snapshot = await (await request.get("/api/replay")).json();
  const now = "2026-10-22T00:00:00.000Z",
    errors: string[] = [],
    actions: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const reel: Reel = {
    id: "idea-ui-source",
    accountId: "idea-ui-account",
    shortcode: "IdeaUI",
    url: "https://www.instagram.com/reel/IdeaUI/",
    caption: "Synthetic idea fixture",
    thumbnail: "",
    videoUrl: "",
    views: null,
    likes: null,
    comments: null,
    postedAt: null,
    collectedAt: now,
    source: "import",
    platform: "instagram",
    status: "completed",
    error: null,
    starred: false,
    evidence: null,
    analysis: {
      ...reportFixture(),
      sources: [
        {
          id: "F1",
          kind: "frame",
          label: "Opening frame",
          seconds: 0,
          text: "Synthetic object on a workbench.",
        },
      ],
    },
    analysisProvider: "Synthetic fixture",
    analyzedAt: now,
  };
  data.accounts = [
    {
      id: reel.accountId,
      username: "synthetic_idea",
      label: "Synthetic idea fixture",
      role: "own",
      createdAt: now,
      lastFetchedAt: null,
      requestedLimit: 0,
      lastFetchedCount: 0,
      collectionNote: "Synthetic UI fixture",
      reelCount: 1,
    },
  ];
  data.reels = [reel];
  data.jobs = [];
  data.ideas = [];
  data.collections = [];
  data.research = [];
  data.comparisons = [];
  data.settings.provider = "openai";
  data.settings.openaiModel = "gpt-6.1-sol";
  let version = 0;
  const receipt: ModelUsage = {
    id: "usage-fixture",
    createdAt: now,
    provider: "openai",
    model: "gpt-6.1-sol",
    modelSource: "reported",
    operation: "idea_refinement",
    inputTokens: 1000,
    cachedInputTokens: 500,
    outputTokens: 200,
    reasoningTokens: 50,
    totalTokens: 1200,
    estimatedUsd: 0.0042,
    costKind: "api-estimate",
    pricingAsOf: now,
    priceModel: "gpt-6.1-sol",
    pricingSource: "Synthetic UI fixture",
    serviceTier: "default",
    note: "Synthetic usage fixture; no real model call.",
    outcome: "response",
  };
  await page.route("**/api/replay?activity=1", (route) =>
    route.fulfill({ json: { revision: data.revision, jobs: [], reels: [] } }),
  );
  await page.route("**/api/replay", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: data });
    const input = route.request().postDataJSON();
    actions.push(input.action);
    let session = data.ideas![0];
    if (input.action === "idea-start") {
      const concept = reel.analysis!.suggestedAngles[0];
      session ||= {
        id: "idea-ui-conversation",
        sourceKind: "reel",
        sourceId: reel.id,
        conceptIndex: 0,
        sourceTitle: reel.analysis!.title,
        reelIds: [reel.id],
        reportVersions: { [reel.id]: now },
        sourcesByReel: { [reel.id]: reel.analysis!.sources! },
        original: {
          title: concept.idea,
          hook: concept.opening,
          body: concept.body!,
          cta: concept.cta!,
          notes: concept.rationale || "",
        },
        draft: {
          title: concept.idea,
          hook: concept.opening,
          body: concept.body!,
          cta: concept.cta!,
          notes: concept.rationale || "",
        },
        savedAt: null,
        messages: [],
        createdAt: now,
        updatedAt: now,
      } satisfies IdeaSession;
      data.ideas = [session];
      return route.fulfill({ json: session });
    }
    if (input.action === "idea-save") {
      expect(input.expectedUpdatedAt).toBe(session.updatedAt);
      session.draft = input.draft;
      session.savedDraft = structuredClone(input.draft);
      session.savedAt = now;
    } else if (input.action === "idea-message") {
      expect(input.expectedUpdatedAt).toBe(session.updatedAt);
      expect(input.draft.body).toBe("My manually edited script.");
      session.messages.push(
        { id: "user-1", role: "user", text: input.message, createdAt: now },
        {
          id: "assistant-1",
          role: "assistant",
          text: "Here is a shorter opening for your workbench setup.",
          createdAt: now,
          usage: receipt,
        },
      );
      session.draft = { ...input.draft, hook: "Watch this one small change." };
    } else
      throw new Error(
        `Unexpected action ${input.action}; no paid model calls are allowed in this test.`,
      );
    session.updatedAt = new Date(Date.parse(now) + ++version).toISOString();
    await route.fulfill({ json: { id: session.id } });
  });
  await page.route("**/api/replay/usage", (route) =>
    route.fulfill({
      json: {
        records: [
          receipt,
          {
            ...receipt,
            id: "subscription-fixture",
            provider: "codex",
            model: null,
            modelSource: "unknown",
            estimatedUsd: null,
            costKind: "api-equivalent",
            note: "Default model was not reported.",
          },
        ],
        summary: [
          {
            provider: "openai",
            model: receipt.model,
            requests: 1,
            inputTokens: 1000,
            cachedInputTokens: 500,
            outputTokens: 200,
            unknownUsage: 0,
            knownCosts: 1,
            estimatedUsd: receipt.estimatedUsd,
          },
        ],
        pricing: { fetchedAt: now, models: {} },
      },
    }),
  );
  await page.goto(`/?reel=${reel.id}`);
  await page.getByRole("tab", { name: "Ideas", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit idea", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Ask for a revision", exact: true }).click();
  await expect(page.locator(".workspace-page")).toContainText(
    "Each send uses OpenAI API billing",
  );
  expect(actions).toEqual(["idea-start"]);
  await page
    .getByLabel("Body", { exact: true })
    .fill("My manually edited script.");
  await page
    .getByLabel("What would you like to change?")
    .fill("Make the opening shorter");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.goto("/?idea=idea-ui-conversation");
  await expect(page.getByLabel("Body", { exact: true })).toHaveValue(
    "My manually edited script.",
  );
  await expect(page.getByLabel("What would you like to change?")).toHaveValue(
    "Make the opening shorter",
  );
  await page
    .getByRole("button", { name: "Save to Inspiration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved to Inspiration", exact: true }),
  ).toBeDisabled();
  expect(actions).toEqual(["idea-start", "idea-save"]);
  await page
    .getByLabel("What would you like to change?")
    .fill("Make the opening shorter");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByLabel("Hook", { exact: true })).toHaveValue(
    "Watch this one small change.",
  );
  await expect(
    page.getByText("1,200 tokens used", { exact: false }),
  ).toBeVisible();
  expect(data.ideas![0].savedDraft!.hook).toBe("Synthetic opening 1");
  expect(actions.filter((action) => action === "idea-message")).toHaveLength(1);
  await page
    .getByRole("button", { name: "Source report", exact: true })
    .click();
  await page.getByRole("tab", { name: "Ideas", exact: true }).click();
  await page.getByRole("button",{name:"Actions for concept 1",exact:true}).click();
  await page
    .getByRole("menuitem", { name: "Save idea", exact: true })
    .first()
    .click();
  await expect(page.locator(".concept-actions [role=status]").first()).toHaveText("Saved to Inspiration");
  await page.getByRole("button", {name:"Actions for concept 1",exact:true}).click();
  await expect(page.getByRole("menuitem", {name:"Saved to Inspiration",exact:true})).toBeDisabled();
  await page.keyboard.press("Escape");
  expect(actions.filter((action) => action === "idea-save")).toHaveLength(1);
  expect(data.ideas![0].savedDraft!.hook).toBe("Synthetic opening 1");
  await page
    .getByRole("button", { name: "Edit idea", exact: true })
    .first()
    .click();
  mkdirSync(path.resolve("../.local/qa"), { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByLabel("Appearance", { exact: true }).selectOption(theme);
    await page.goto("/?idea=idea-ui-conversation");
    await expect(page.getByLabel("Hook", { exact: true })).toHaveValue(
      "Watch this one small change.",
    );
    const saveColors = await page
      .getByRole("button", { name: "Save to Inspiration", exact: true })
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { foreground: style.color, background: style.backgroundColor };
      });
    expect(saveColors.foreground).not.toBe(saveColors.background);
    await page
      .locator(".workspace-page")
      .evaluate((el) =>
        Promise.all(
          el
            .getAnimations()
            .map((animation) => animation.finished.catch(() => {})),
        ),
      );
    await page.screenshot({
      path: path.resolve(`../.local/qa/idea-chat-${theme}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const pageDimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 12)
      .map((el) => ({
        className: el.className,
        width: el.getBoundingClientRect().width,
        right: el.getBoundingClientRect().right,
      })),
  }));
  expect(
    pageDimensions.scroll,
    JSON.stringify(pageDimensions),
  ).toBeLessThanOrEqual(pageDimensions.width);
  const dimensions = await page.locator(".workspace-page").evaluate((el) => ({
    width: el.clientWidth,
    scroll: el.scrollWidth,
    overflowing: Array.from(el.querySelectorAll("*"))
      .filter(
        (child) =>
          child.getBoundingClientRect().right >
          el.getBoundingClientRect().right + 1,
      )
      .map((child) => ({
        tag: child.tagName,
        slot: child.getAttribute("data-slot"),
        className: child.className,
        width: child.getBoundingClientRect().width,
      }))
      .slice(0, 12),
  }));
  expect(dimensions.scroll, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.width,
  );
  await page.screenshot({
    path: path.resolve("../.local/qa/idea-chat-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Your draft", exact: true }).click();
  await page
    .getByRole("button", { name: "Save to Inspiration", exact: true })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Inspiration", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My drafts", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".saved-idea-hook")).toHaveText(
    "Watch this one small change.",
  );
  await page
    .getByRole("button", { name: "Open draft", exact: true })
    .click();
  await page.getByRole("tab", { name: "Your draft", exact: true }).click();
  await expect(page.getByLabel("Body", { exact: true })).toHaveValue(
    "My manually edited script.",
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", {name:"More",exact:true}).click(); await page.getByRole("menuitem", {name:"Usage & costs",exact:true}).click();
  await expect(
    page.getByRole("heading", { name: "Usage & costs", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".analytics-table")).toContainText("gpt-6.1-sol");
  await expect(page.locator(".analytics-table")).toContainText("$0.004200");
  await expect(page.locator(".usage-model-cards")).toBeVisible();
  await expect(page.locator(".usage-model-cards")).toContainText("$0.004200");
  await expect(page.locator(".usage-history").last()).toContainText(
    "API equivalent: Unavailable",
  );
  await page.screenshot({
    path: path.resolve("../.local/qa/usage-costs-mobile.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Reel, Snapshot } from "../../src/lib/replay/types";

test("selection, connection choices and disclosures work from the keyboard without submitting model work", async ({
  page,
  request,
}) => {
  const data: Snapshot = await (await request.get("/api/replay")).json();
  const now = "2026-10-22T00:00:00Z",
    actions: string[] = [],
    errors: string[] = [];
  const account = {
    id: "luma-account",
    username: "synthetic_creator",
    label: "Synthetic UI fixture",
    role: "competitor" as const,
    createdAt: now,
    lastFetchedAt: null,
    requestedLimit: 0,
    lastFetchedCount: 0,
    collectionNote: "Synthetic fixture",
    reelCount: 3,
  };
  data.accounts = [account];
  data.reels = [0, 1, 2].map(
    (index) =>
      ({
        id: `luma-${index}`,
        accountId: account.id,
        shortcode: `Luma${index}`,
        url: `https://www.instagram.com/reel/Luma${index}/`,
        caption: `Synthetic layout fixture ${index + 1}`,
        thumbnail: "",
        videoUrl: "",
        views: null,
        likes: null,
        comments: null,
        postedAt: null,
        collectedAt: now,
        source: "import",
        platform: "instagram",
        status: "idle",
        error: null,
        starred: false,
        evidence: null,
        analysis: null,
        analysisProvider: null,
        analyzedAt: null,
      }) satisfies Reel,
  );
  data.jobs = [];
  data.comparisons = [];
  data.research = [];
  data.collections = [];
  data.ideas = [];
  data.settings.provider = "codex";
  data.settings.hasApifyToken = false;
  data.settings.hasOpenaiKey = false;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/replay?activity=1", (route) =>
    route.fulfill({ json: { revision: data.revision, jobs: [], reels: [] } }),
  );
  await page.route("**/api/replay", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: data });
    actions.push(route.request().postDataJSON().action);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  const first = page.getByRole("checkbox", {
    name: "Select Reel Luma0",
    exact: true,
  });
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  const firstBatch = page.getByRole("checkbox", {
    name: "Select first 3",
    exact: true,
  });
  await expect(firstBatch).toHaveAttribute("aria-checked", "mixed");
  await firstBatch.focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("checkbox", { name: /^Select Reel Luma/ }),
  ).toHaveCount(3);
  for (const checkbox of await page
    .getByRole("checkbox", { name: /^Select Reel Luma/ })
    .all())
    await expect(checkbox).toBeChecked();
  mkdirSync(path.resolve("../.local/qa"), { recursive: true });
  await page.screenshot({
    path: path.resolve("../.local/qa/luma-library-light.png"),
    fullPage: true,
  });
  await page.getByRole("button", {name:"More",exact:true}).click(); await page.getByRole("menuitem", {name:"Connections",exact:true}).click();
  const codex = page.getByRole("radio", { name: /Codex subscription/ }),
    api = page.getByRole("radio", { name: /OpenAI API/ });
  await codex.focus();
  await page.keyboard.down("ArrowRight");
  await expect(api).toBeFocused();
  await page.keyboard.up("ArrowRight");
  await expect(api).toBeChecked();
  await expect(api).toBeFocused();
  await page
    .getByRole("button", { name: "Use another model ID", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByLabel("Custom model ID", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Custom model ID", { exact: true })
    .fill("synthetic-custom-model");
  await page
    .getByRole("button", { name: "Use another model ID", exact: true })
    .click();
  await expect(
    page.getByLabel("Custom model ID", { exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Use another model ID", exact: true })
    .click();
  await expect(page.getByLabel("Custom model ID", { exact: true })).toHaveValue(
    "synthetic-custom-model",
  );
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance", { exact: true }).selectOption(theme);
    await page.screenshot({
      path: path.resolve(`../.local/qa/luma-connections-${theme}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.resolve("../.local/qa/luma-connections-mobile.png"),
    fullPage: true,
  });
  expect(actions).toEqual([]);
  expect(errors).toEqual([]);
});

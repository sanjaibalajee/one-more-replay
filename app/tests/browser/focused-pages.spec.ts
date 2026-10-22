import { test, expect } from "@playwright/test";
import { reportFixture } from "../fixtures/report";
import type { Reel, Snapshot } from "../../src/lib/replay/types";

test("focused pages preserve history, keep secondary controls closed, and never start AI on navigation", async ({
  page,
  request,
}) => {
  const data: Snapshot = await (await request.get("/api/replay")).json();
  const actions: string[] = [];
  const reel = {
    id: "focused-fixture",
    accountId: "focused-account",
    shortcode: "FocusedFixture",
    url: "https://www.instagram.com/reel/FocusedFixture/",
    caption: "Synthetic editorial navigation fixture",
    thumbnail: "",
    videoUrl: "",
    views: null,
    likes: null,
    comments: null,
    postedAt: null,
    collectedAt: "2026-10-22T00:00:00Z",
    source: "import",
    status: "completed",
    error: null,
    starred: false,
    evidence: null,
    analysis: reportFixture(),
    analysisProvider: "Synthetic fixture",
    analyzedAt: "2026-10-22T00:00:00Z",
  } satisfies Reel;
  data.reels = [reel];
  data.accounts = [];
  data.jobs = [];
  data.comparisons = [];
  data.research = [];
  data.ideas = [];
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
  await expect(
    page.getByRole("button", { name: "Add link", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add link", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add a video link", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".reel-card")).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Report ready", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: reel.analysis.title, exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText(reel.analysis.editorial.verdict, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(reel.analysis.editorial.changes[0].example, {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Your notes", { exact: true }),
  ).not.toBeVisible();
  await expect(
    page
      .getByRole("tablist", { name: "Report sections", exact: true })
      .getByRole("tab"),
  ).toHaveCount(3);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Reel library", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: reel.analysis.title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(reel.analysis.editorial.verdict, { exact: true }),
  ).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(actions).toEqual([]);
});

import { test, expect } from "@playwright/test";

test("own ideas move from capture to filming with no automatic model work", async ({
  page,
  request,
}) => {
  const actions: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/replay"
    )
      actions.push(request.postDataJSON().action);
  });
  await page.goto("/?view=inspiration");
  await page.getByRole("button", { name: "New idea", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByLabel("What would you like to make?", { exact: true })
    .fill(
      "A quieter morning\nPut the kettle on and leave your phone down for a moment.",
    );
  await page.getByRole("button", { name: "Save idea", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "A quieter morning",
  );
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).not.toBeVisible();
  await page
    .getByLabel("Hook", { exact: true })
    .fill("Before you check your phone, try this.");
  await page.getByLabel("Draft stage", { exact: true }).selectOption("ready");
  await page
    .getByRole("button", { name: "Save to Inspiration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved to Inspiration", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Read script", exact: true }).click();
  const reader = page.getByRole("region", {
    name: "Script to read",
    exact: true,
  });
  await expect(reader).toBeFocused();
  await reader.press("Space");
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => reader.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await reader.press("Space");
  await expect(
    page.getByRole("button", { name: "Start scrolling", exact: true }),
  ).toBeVisible();
  await reader.press("Escape");
  await expect(
    page.getByRole("button", { name: "Read script", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(page.getByLabel("Draft stage", { exact: true })).toHaveValue(
    "ready",
  );
  await page
    .getByRole("button", { name: "Ask for a revision", exact: true })
    .click();
  await page
    .getByLabel("What would you like to change?", { exact: true })
    .fill("Make this a little shorter");
  await page
    .getByRole("button", { name: "Close idea chat", exact: true })
    .click();
  await page.getByLabel("Draft stage", { exact: true }).selectOption("posted");
  await page
    .getByRole("button", { name: "Save to Inspiration", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved to Inspiration", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Ask for a revision", exact: true })
    .click();
  await expect(
    page.getByLabel("What would you like to change?", { exact: true }),
  ).toHaveValue("Make this a little shorter");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page
    .getByLabel("Filter draft stage", { exact: true })
    .selectOption("posted");
  await expect(
    page.getByRole("region", { name: "My drafts", exact: true }),
  ).toContainText("A quieter morning");
  const snapshot = await (await request.get("/api/replay")).json();
  const saved = snapshot.ideas.find(
    (idea: { draft: { title: string } }) =>
      idea.draft.title === "A quieter morning",
  );
  expect(saved.sourceKind).toBe("manual");
  expect(saved.stage).toBe("posted");
  expect(saved.messages).toEqual([]);
  expect(actions).toEqual(["idea-create", "idea-save", "idea-save"]);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

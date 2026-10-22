import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { reportFixture } from "../fixtures/report";
import { evidenceSources } from "../../src/lib/replay/evidence";
import type { MediaEvidence, Reel } from "../../src/lib/replay/types";

test("add a competitor, import its catalogue, and analyze only the selected Reels", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/"); await expect(page.getByRole("heading", { name: "Reel library", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click(); await page.getByRole("menuitem", {name:"Add account",exact:true}).click();
  await page.getByLabel("Instagram account").fill("@replay_fixture");
  await page.getByRole("button", { name: "Add account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "@replay_fixture" })).toBeVisible();
  const rows = Array.from({ length: 8 }, (_, i) => ({ url: `https://www.instagram.com/reel/SyntheticFixture${i}/`, caption: `Synthetic test fixture ${i}: a different opening for the same idea.`, ownerUsername: "replay_fixture", timestamp: new Date(Date.UTC(2026, 8, i + 1)).toISOString(), videoPlayCount: 1000 + i * 700, likesCount: 50 + i, commentsCount: i }));
  await page.getByRole("button",{name:"Manage account",exact:true}).click(); await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Apify JSON export").setInputFiles({ name: "fixtures.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(rows)) });
  await page.getByRole("button", { name: "Import Reels", exact: true }).click();
  await expect(page.locator(".reel-card")).toHaveCount(8);
  await page.getByRole("checkbox", { name: "Select Reel SyntheticFixture0", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select Reel SyntheticFixture2", exact: true }).check();
  let analyzed: string[] = [];
  await page.route("**/api/replay", async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      if (body.action === "analyze") { analyzed = body.reelIds; await route.fulfill({ status: 202, json: { id: "synthetic-job" } }); return; }
    }
    await route.continue();
  });
  mkdirSync(path.resolve("../.local/qa"), { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.resolve("../.local/qa/library.png"), fullPage: true });
  await page.getByRole("button", { name: "Analyze 2 Reels" }).click();
  await expect.poll(() => analyzed.length).toBe(2);
  const snapshot = await (await page.request.get("/api/replay")).json();
  expect(analyzed.sort()).toEqual(snapshot.reels.filter((r: { shortcode: string }) => ["SyntheticFixture0", "SyntheticFixture2"].includes(r.shortcode)).map((r: { id: string }) => r.id).sort());
  await page.getByRole("button", { name: "Save Reel", exact: true }).first().click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.locator(".reel-card")).toHaveCount(1);
  await page.reload(); await page.getByRole("button", { name: "Saved", exact: true }).click();
  await expect(page.locator(".reel-card")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", {name:"More",exact:true}).click(); await page.getByRole("menuitem", {name:"Connections",exact:true}).click();
  await expect(page.getByRole("heading", { name: "Choose your analyst" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Codex subscription/ })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve("../.local/qa/mobile-connections.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("local APIs reject invalid input and cross-site mutation", async ({ request }) => {
  const invalid = await request.post("/api/replay", { data: { action: "account", handle: "https://evil.example/account" } }); expect(invalid.status()).toBe(400);
  const crossSite = await request.post("/api/replay", { headers: { Origin: "https://evil.example" }, data: { action: "account", handle: "must_not_exist" } }); expect(crossSite.status()).toBe(400);
  const publicData = await (await request.get("/api/replay")).json();
  expect(publicData.accounts.some((a: { username: string }) => a.username === "must_not_exist")).toBe(false);
  expect(publicData.settings.openaiKey).toBeUndefined(); expect(publicData.settings.apifyToken).toBeUndefined();
  const image = await request.get("/api/proxy-image?url=http://127.0.0.1/private"); expect(image.status()).toBe(400);
});

test("local video uploads are playable MP4s and support byte-range seeking", async ({ request }) => {
  const file = path.resolve("../.local/qa/upload-fixture.mp4");
  mkdirSync(path.dirname(file), { recursive: true });
  execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0xdce6d3:s=180x320:r=10:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", file]);
  const upload = await request.post("/api/replay/upload", { multipart: { file: { name: "synthetic-fixture.mp4", mimeType: "video/mp4", buffer: readFileSync(file) }, caption: "Synthetic upload fixture" } });
  expect(upload.status()).toBe(201); const { id } = await upload.json();
  const range = await request.get(`/api/replay/media/${id}/video.mp4`, { headers: { Range: "bytes=0-127" } });
  expect(range.status()).toBe(206); expect((await range.body()).length).toBe(128); expect(range.headers()["content-range"]).toMatch(/^bytes 0-127\//);
  const invalidRange = await request.get(`/api/replay/media/${id}/video.mp4`, { headers: { Range: "bytes=999999999-" } }); expect(invalidRange.status()).toBe(416);
});

test("model picker, reasoning levels, creative brief and dark mode persist", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload(); await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue("dark");
  await page.getByRole("button", {name:"More",exact:true}).click(); await page.getByRole("menuitem", {name:"Connections",exact:true}).click();
  await page.getByRole("radio", { name: /OpenAI API/ }).check();
  await page.getByLabel("OpenAI model", { exact: true }).selectOption("gpt-6.1-sol");
  expect(await page.getByLabel("Reasoning effort").locator("option").allTextContents()).not.toContain("None");
  await page.getByLabel("Reasoning effort").selectOption("high");
  await page.getByLabel("OpenAI model", { exact: true }).selectOption("gpt-6-luna");
  expect(await page.getByLabel("Reasoning effort").locator("option").allTextContents()).toContain("None");
  await page.getByLabel("Creator, niche and offer").fill("Synthetic fixture: a small repair shop.");
  await page.getByLabel("Audience", { exact: true }).fill("New cyclists who need simple repairs.");
  await page.getByLabel("Content language").fill("Tamil and English");
  await page.getByLabel("Tone", { exact: true }).fill("Direct and calm");
  await page.getByLabel("Production constraints").fill("One person, a phone, 30 minutes in the shop.");
  await page.getByLabel("Goal", { exact: true }).fill("Qualified repair enquiries");
  await page.getByRole("button", { name: "Save connections", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await page.reload(); await page.getByRole("button", {name:"More",exact:true}).click(); await page.getByRole("menuitem", {name:"Connections",exact:true}).click();
  await expect(page.getByLabel("OpenAI model", { exact: true })).toHaveValue("gpt-6-luna");
  await expect(page.getByLabel("Reasoning effort")).toHaveValue("high");
  await expect(page.getByLabel("Production constraints")).toHaveValue("One person, a phone, 30 minutes in the shop.");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve("../.local/qa/connections-dark.png"), fullPage: true });
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await page.getByRole("radio", { name: /Codex subscription/ }).check();
  await page.getByRole("button", { name: "Save connections", exact: true }).click();
});

test("evidence links seek the player, ideas show shot lists, closing and reopening stays playable", async ({ page, request }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const file = path.resolve("../.local/qa/playback-fixture.mp4");
  mkdirSync(path.dirname(file), { recursive: true });
  execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=180x320:r=15:d=12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
  const upload = await request.post("/api/replay/upload", { multipart: { file: { name: "playback-fixture.mp4", mimeType: "video/mp4", buffer: readFileSync(file) } } });
  expect(upload.status()).toBe(201); const { id } = await upload.json();
  const snapshot = await (await request.get("/api/replay")).json();
  const reel: Reel = snapshot.reels.find((r: Reel) => r.id === id);
  const evidence: MediaEvidence = { duration: 12, width: 180, height: 320, hasAudio: true, frames: [{ file: "frame-00.jpg", seconds: 0 }, { file: "frame-01.jpg", seconds: 5 }], sceneChanges: [], transcript: { text: "Synthetic words.", segments: [{ start: 0, end: 3, text: "Synthetic words." }], language: "en", engine: "fixture", model: "base", status: "completed", note: "Synthetic UI fixture." }, warnings: ["Synthetic UI fixture, not live research."] };
  reel.evidence = evidence; reel.analysis = reportFixture(); reel.analysis.hook.evidenceIds = ["F2", "T1"]; reel.analysis.sources = evidenceSources(reel, evidence); reel.status = "completed";
  await page.route("**/api/replay", route => route.request().method() === "GET" ? route.fulfill({ json: snapshot }) : route.continue());
  await page.route("**/frame-*.jpg", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S9sAAAAASUVORK5CYII=", "base64") }));
  await page.goto(`/?reel=${id}`);
  const video = page.getByLabel("Reel video", { exact: true });
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  await page.getByRole("button",{name:"Hook, body & ending",exact:true}).click(); await page.locator(".hook-link").click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(5);
  await video.evaluate((v: HTMLVideoElement) => v.pause());
  await expect(page.locator(".evidence-focus")).toContainText("Frame 2");
  await page.getByRole("tab", { name: "Ideas", exact: true }).click();
  await expect(page.locator(".idea")).toHaveCount(3); await expect(page.locator(".shot")).toHaveCount(9);
  await page.getByRole("tab", {name:"Evidence",exact:true}).click(); await page.getByLabel("Evidence view", {exact:true}).selectOption("transcript");
  await page.locator(".transcript>button").click(); await expect(page.locator(".evidence-focus blockquote")).toHaveText("Synthetic words.");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: path.resolve("../.local/qa/evidence-report-light.png"), fullPage: true });
  for (let i = 0; i < 4; i++) {
    await video.evaluate((v: HTMLVideoElement) => { v.currentTime = 9; void v.play().catch(() => {}); });
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.locator(".workspace-page")).not.toBeVisible();
    await page.locator(".reel-card").filter({ has: page.getByRole("checkbox", { name: `Select Reel ${reel.id}`, exact: true }) }).getByRole("button", { name: /^Open Reel:/ }).click();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);
  }
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.goto(`/?reel=${id}`); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: path.resolve("../.local/qa/evidence-report-dark.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.resolve("../.local/qa/evidence-report-mobile.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("processing stages and collection cost review are clear without starting paid work", async ({ page, request }) => {
  const snapshot = await (await request.get("/api/replay")).json();
  const now = new Date().toISOString();
  snapshot.jobs = [{ id: "synthetic-running", kind: "analyze", reelIds: ["synthetic-reel"], accountId: null, params: {}, phase: "transcribing", currentReelId: "synthetic-reel", createdAt: now, updatedAt: now, phaseStartedAt: now, completed: 0, total: 2, detail: "Synthetic fixture: Whisper is running locally.", errors: [], resultId: null, history: [{ phase: "downloading", detail: "Saved file.", at: now, reelId: "synthetic-reel" }, { phase: "extracting", detail: "Frames ready.", at: now, reelId: "synthetic-reel" }, { phase: "transcribing", detail: "Whisper running.", at: now, reelId: "synthetic-reel" }] }];
  await page.route("**/api/replay", route => route.request().method() === "GET" ? route.fulfill({ json: snapshot }) : route.abort());
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Analysis job" })).toContainText("Analyzing Reel 1 of 2");
  await expect(page.locator(".pipeline [aria-current=step]")).toHaveText("Transcript");
  await expect(page.getByText("Synthetic fixture: Whisper is running locally.", { exact: true })).toBeVisible();
  await page.screenshot({ path: path.resolve("../.local/qa/processing.png"), fullPage: true });
  await page.getByRole("button", { name: /@replay_fixture/ }).first().click();
  await page.getByRole("button",{name:"Manage account",exact:true}).click(); await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const dialog = page.locator(".workspace-page"); await expect(dialog).toContainText("additional charges"); await expect(dialog).toContainText("not limited to new posts");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("comparison limits and evidence links open the exact supporting moment", async ({ page, request }) => {
  const snapshot = await (await request.get("/api/replay")).json();
  const original: Reel = snapshot.reels.find((reel: Reel) => reel.source === "upload" && reel.durationSeconds! >= 10);
  expect(original).toBeTruthy();
  original.analysis = reportFixture(); original.analyzedAt = "2026-10-21T12:00:00Z";
  original.evidence = { duration: 12, width: 180, height: 320, hasAudio: false, frames: [{ file: "frame-00.jpg", seconds: 5 }], sceneChanges: [], transcript: { text: "", segments: [], language: null, engine: "none", model: "", status: "no-audio", note: "Synthetic fixture." }, warnings: [] };
  original.analysis.sources = evidenceSources(original, original.evidence);
  const second = { ...original, id: "local_comparison_copy", caption: "Synthetic comparison copy." }; snapshot.reels.push(second);
  snapshot.comparisons = [{ id: "comparison-fixture", reelIds: [original.id, second.id], provider: "Synthetic UI fixture", createdAt: original.analyzedAt, reportVersions: { [original.id]: original.analyzedAt, [second.id]: original.analyzedAt }, sourcesByReel: { [original.id]: original.analysis.sources, [second.id]: original.analysis.sources }, context: { quality: "weak", reasons: ["Synthetic fixture with no performance baseline."], pairs: [{ leftId: original.id, rightId: second.id, comparable: false, reasons: ["Missing performance context."] }], rows: [original, second].map(reel => ({ reelId: reel.id, ageDays: null, durationSeconds: 12, format: "demonstration", multiple: null, sampleSize: 0, cohort: "insufficient" })) }, report: { title: "Synthetic comparison fixture", summary: "A weak comparison for UI testing.", patterns: [{ pattern: "A concrete example", reelIds: [original.id, second.id], evidence: "Synthetic frame references.", howToAdapt: "Try a controlled demonstration.", examples: [{ reelId: original.id, evidenceIds: ["F1"] }, { reelId: second.id, evidenceIds: ["F1"] }] }], differences: ["Synthetic difference."], nextExperiments: ["One controlled test."], limitations: ["Synthetic UI data."] } }];
  await page.route("**/api/replay", route => route.request().method() === "GET" ? route.fulfill({ json: snapshot }) : route.continue());
  await page.route("**/frame-*.jpg", route => route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S9sAAAAASUVORK5CYII=", "base64") }));
  await page.goto("/?report=comparison-fixture");
  await expect(page.locator(".workspace-page")).toContainText("Weak performance comparison");
  await expect(page.locator(".comparison-table tbody tr")).toHaveCount(2);
  await page.locator(".comparison-evidence .evidence-link").first().click();
  await expect(page.locator(".evidence-focus")).toContainText("Frame 1 · 0:05");
  await expect.poll(() => page.getByLabel("Reel video", { exact: true }).evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThanOrEqual(5);
});

test("primary button text stays readable on hover and focus across light and dark screens", async ({ page }) => {
  await page.goto("/");
  async function check(button: ReturnType<typeof page.locator>) {
    await button.hover();
    const readContrast = () => button.evaluate(async element => {
      void getComputedStyle(element).backgroundColor;
      await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
      const style = getComputedStyle(element);
      const luminance = (color: string) => { const rgb = (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number).map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2]; };
      const foreground = luminance(style.color), background = luminance(style.backgroundColor);
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    });
    expect(await readContrast()).toBeGreaterThanOrEqual(4.5);
    await page.mouse.move(0, 0); await button.focus();
    expect(await readContrast()).toBeGreaterThanOrEqual(4.5);
    await expect(button).toBeFocused(); await expect(button).toBeVisible();
  }
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Appearance", { exact: true }).selectOption(theme);
    await check(page.getByRole("button",{name:"Add",exact:true}));
    await page.getByRole("button",{name:"Add",exact:true}).click(); await page.getByRole("menuitem",{name:"Add account",exact:true}).click();
    await check(page.locator(".workspace-page").locator(".btn.primary"));
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", {name:"More",exact:true}).click(); await page.getByRole("menuitem", {name:"Connections",exact:true}).click();
    await check(page.locator(".settings-footer .btn.primary"));
    await page.getByRole("button", { name: /^Reel library/ }).click();
  }
});

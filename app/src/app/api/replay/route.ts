import { ideaActions, handleIdea } from "@/lib/replay/idea-api";
import { researchActions, handleResearch } from "@/lib/replay/research-api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { activity, addAccount, getAccount, getReel, ingest, publicSettings, privateSettings, saveAccount, saveReel, saveSettings, snapshot } from "@/lib/replay/store";
import { fetchProfileImage } from "@/lib/replay/profile";
import { normalizeReel, ownerFromRow } from "@/lib/replay/catalogue";
import { cancelJob, enqueue, initializeQueue } from "@/lib/replay/jobs";
import { readiness } from "@/lib/replay/intelligence";
import { apiError, body, guard } from "@/lib/replay/http";
import { reasoningConfig, supportedEfforts } from "@/lib/replay/models";
import { codexModels } from "@/lib/replay/codex-models";
import type { Reel } from "@/lib/replay/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ids = z.array(z.string().min(1).max(100)).min(1).max(10).transform(value => [...new Set(value)]);
const effort = z.enum(["default", "none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);
const brief = z.object({ business: z.string().max(3000), audience: z.string().max(2000), language: z.string().max(100), tone: z.string().max(500), constraints: z.string().max(2000), goal: z.string().max(500) });
const actions = z.discriminatedUnion("action", [
  z.object({ action:z.literal("profile"),accountId:z.string() }),
  z.object({ action: z.literal("account"), handle: z.string().min(1).max(200), role: z.enum(["own", "competitor", "inspiration"]).default("competitor") }),
  z.object({ action: z.literal("collect"), accountId: z.string(), limit: z.number().int().min(10).max(1000).default(50) }),
  z.object({ action: z.literal("import"), accountId: z.string(), rows: z.array(z.record(z.string(), z.unknown())).min(1).max(1000) }),
  z.object({ action: z.literal("analyze"), reelIds: ids, force: z.boolean().default(false), brandContext: z.string().max(8000).optional() }),
  z.object({ action: z.literal("compare"), reelIds: ids, brandContext: z.string().max(8000).optional() }),
  z.object({ action: z.literal("cancel"), jobId: z.string() }),
  z.object({ action: z.literal("star"), reelId: z.string(), starred: z.boolean() }),
  z.object({ action: z.literal("settings"), provider: z.enum(["codex", "openai"]), codexModel: z.string().max(100), openaiModel: z.string().max(100), whisperModel: z.enum(["tiny", "base", "small", "medium", "large-v3", "turbo"]), language: z.string().max(12).regex(/^[a-z-]*$/), brandContext: z.string().max(8000), brief: brief.optional(), codexEffort: effort.optional(), openaiEffort: effort.optional(), apifyToken: z.string().max(500).optional(), openaiKey: z.string().max(500).optional() }),
]);
export async function GET(request: Request) {
  try { guard(request); initializeQueue(); const params = new URL(request.url).searchParams; return NextResponse.json(params.has("health") ? await readiness() : params.has("activity") ? activity() : snapshot(), { headers: { "Cache-Control": "no-store" } }); }
  catch (err) { return apiError(err); }
}
export async function POST(request: Request) {
  try {
    guard(request); const raw = await body(request); initializeQueue();
    if (raw && typeof raw.action === "string" && raw.action.startsWith("idea-")) return handleIdea(ideaActions.parse(raw));
    const research = researchActions.safeParse(raw);
    if (research.success) return handleResearch(research.data);
    if (raw && typeof raw === "object" && "action" in raw && ["role","link","resolve","annotate","collection","collection-delete","collection-add","collection-remove","adapt","gap"].includes(String(raw.action))) throw research.error;
    const input = actions.parse(raw);
    if(input.action==="profile") return NextResponse.json(await fetchProfileImage(input.accountId,request.signal));
    if (input.action === "account") return NextResponse.json(addAccount(input.handle, input.role), { status: 201 });
    if (input.action === "collect") {
      const account = getAccount(input.accountId);
      if (!account || account.kind === "inbox" || account.username === "local_uploads") throw new Error("Choose an Instagram creator account to collect.");
      if (!publicSettings().hasApifyToken) throw new Error("Add your Apify token in Connections, or import a JSON export for this account.");
      return NextResponse.json(enqueue("collect", input.accountId, [], { limit: input.limit }), { status: 202 });
    }
    if (input.action === "import") {
      const account = getAccount(input.accountId); if (!account || account.kind === "inbox") throw new Error("Choose an Instagram creator account for a JSON import.");
      const mismatched = input.rows.some(row => ownerFromRow(row).username && ownerFromRow(row).username !== account.username);
      if (mismatched) throw new Error("This export includes another account. Import only this account's Reels to keep the baseline accurate.");
      const reels = input.rows.map(row => normalizeReel(row, account.id, "import")).filter((r): r is Reel => r !== null);
      if (!reels.length) throw new Error("No valid Instagram Reel rows found. Use an Apify JSON export containing url, caption, timestamp, and performance counts.");
      ingest(reels);
      saveAccount({ ...account, lastFetchedAt: new Date().toISOString(), lastFetchedCount: reels.length, requestedLimit: input.rows.length, collectionNote: `Imported ${reels.length} Reel rows from a local JSON export. Account coverage is limited to this file.` });
      return NextResponse.json({ imported: reels.length, skipped: input.rows.length - reels.length });
    }
    if (input.action === "analyze" || input.action === "compare") {
      const reels = input.reelIds.map(getReel);
      if (reels.some(r => !r)) throw new Error("One of the selected Reels no longer exists.");
      if (input.action === "compare" && (reels.length < 2 || reels.some(r => !r?.analysis))) throw new Error("Select at least two Reels with completed reports to compare.");
      return NextResponse.json(enqueue(input.action, null, input.reelIds, { brandContext: input.brandContext, force: input.action === "analyze" ? input.force : false }), { status: 202 });
    }
    if (input.action === "cancel") { cancelJob(input.jobId); return NextResponse.json({ ok: true }); }
    if (input.action === "star") {
      const reel = getReel(input.reelId); if (!reel) throw new Error("Reel not found.");
      saveReel({ ...reel, starred: input.starred }); return NextResponse.json({ ok: true });
    }
    const { action: _action, ...values } = input;
    void _action;
    const merged = { ...privateSettings(), ...values };
    if (merged.provider === "openai" && merged.openaiModel) reasoningConfig(merged.openaiModel, merged.openaiEffort || "default");
    if (merged.provider === "codex" && merged.codexEffort && merged.codexEffort !== "default") {
      const catalogue = await codexModels(request.signal).catch(() => []);
      const selected = merged.codexModel ? catalogue.find(m => m.id === merged.codexModel) : catalogue.find(m => m.isDefault);
      if (!(selected?.efforts || supportedEfforts(merged.codexModel, "codex")).includes(merged.codexEffort)) throw new Error("Choose a supported Codex reasoning effort.");
    }
    saveSettings(values); return NextResponse.json(publicSettings());
  } catch (err) { return apiError(err); }
}

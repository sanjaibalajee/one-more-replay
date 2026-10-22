import Database from "better-sqlite3";
import { chmodSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureLocal, LOCAL } from "./paths";
import { normalizeHandle } from "./catalogue";
import { cataloguePerformances } from "./baselines";
import type { IdeaSession } from "./idea-types";
import type { ModelUsage } from "./usage-types";
import type { Collection, ResearchReport } from "./research-types";
import type { Account, Job, PublicSettings, Reel, SavedComparison, Settings, Snapshot } from "./types";

type ReplayGlobals = typeof globalThis & { replayDb?: Database.Database; replayChanges?: { epoch: string; revision: number; baseline: number; cachedBaseline?: number; performances?: ReturnType<typeof cataloguePerformances> } };
const globals = globalThis as ReplayGlobals;
let schemaReady = false;
const changes = () => globals.replayChanges ||= { epoch: randomUUID(), revision: 0, baseline: 0 };
export const workspaceRevision = () => `${changes().epoch}:${changes().revision}`;
export function db() {
  if (!globals.replayDb) {
    ensureLocal(); const file = path.join(LOCAL, "replay.sqlite");
    const database = new Database(file);
    chmodSync(file, 0o600);
    database.pragma("journal_mode = WAL"); database.pragma("busy_timeout = 5000");
    globals.replayDb = database;
  }
  if (!schemaReady) {
    globals.replayDb.exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS reels(id TEXT PRIMARY KEY, account_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS reels_account ON reels(account_id);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS comparisons(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS collections(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS research(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS usage(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ideas(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS jobs_created ON jobs(json_extract(data, '$.createdAt'));`);
    schemaReady = true;
  }
  return globals.replayDb;
}
function all<T>(table: "accounts" | "reels" | "jobs" | "comparisons" | "collections" | "research" | "usage" | "ideas"): T[] {
  return (db().prepare(`SELECT data FROM ${table}`).all() as { data: string }[]).map(row => JSON.parse(row.data));
}
function one<T>(table: "accounts" | "reels" | "jobs" | "comparisons" | "collections" | "research" | "usage" | "ideas", id: string): T | null {
  const row = db().prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}
function put<T extends { id: string }>(table: "accounts" | "jobs" | "comparisons" | "collections" | "research" | "usage" | "ideas", item: T) {
  db().prepare(`INSERT INTO ${table}(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`).run(item.id, JSON.stringify(item));
  if (table !== "jobs" && table !== "usage") changes().revision++;
}
export const getAccount = (id: string) => one<Account>("accounts", id);
export const getReel = (id: string) => one<Reel>("reels", id);
export const getJob = (id: string) => one<Job>("jobs", id);
export const getIdea = (id: string) => one<IdeaSession>("ideas", id);
export const getIdeas = () => all<IdeaSession>("ideas").sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
export const saveIdea = (idea: IdeaSession) => { const previous = getIdea(idea.id); const updatedAt = new Date(Math.max(Date.now(), previous ? Date.parse(previous.updatedAt) + 1 : 0)).toISOString(); put("ideas", { ...idea, updatedAt }); };
export const getResearch = (id:string) => one<ResearchReport>("research",id);
export const getComparison = (id: string) => one<SavedComparison>("comparisons", id);
export const getAccounts = () => all<Account>("accounts");
export const getReels = () => all<Reel>("reels");
export const getJobs = () => all<Job>("jobs").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
export const saveAccount = (account: Account) => put("accounts", account);
export const saveJob = (job: Job) => put("jobs", { ...job, updatedAt: new Date().toISOString() });
export const saveComparison = (report: SavedComparison) => put("comparisons", report);
export const getCollections = () => all<Collection>("collections").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
export const saveCollection = (value: Collection) => put("collections", value);
export const deleteCollection = (id: string) => { db().prepare("DELETE FROM collections WHERE id = ?").run(id); changes().revision++; };
export const saveResearch = (value: ResearchReport) => put("research", value);
export function addAccount(value: string, role: Account["role"] = "competitor"): Account {
  const username = normalizeHandle(value), existing = getAccounts().find(a => a.username === username);
  if (existing) return existing;
  const account: Account = { id: randomUUID(), username, label: username, createdAt: new Date().toISOString(), lastFetchedAt: null, requestedLimit: 0, lastFetchedCount: 0, role, kind: "creator", platform: "instagram", collectionNote: "No Reels collected yet." };
  saveAccount(account); return account;
}
export function saveReel(reel: Reel) {
  const previous = getReel(reel.id);
  const signature = (r: Reel | null) => r && JSON.stringify([r.accountId,r.platform,r.source,r.creatorKey,r.views,r.postedAt,r.collectedAt,r.evidence?.duration ?? r.durationSeconds,r.analysis?.format]);
  if (signature(previous) !== signature(reel)) changes().baseline++;
  const content = (r: Reel | null) => r && JSON.stringify({ ...r, status: undefined, error: undefined });
  if (content(previous) !== content(reel)) changes().revision++;
  db().prepare("INSERT INTO reels(id,account_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,data=excluded.data").run(reel.id, reel.accountId, JSON.stringify(reel));
}
export function ingest(reels: Reel[]) {
  db().transaction(() => {
    for (const incoming of reels) {
      const previous = getReel(incoming.id);
      const accountId = previous && getAccount(previous.accountId)?.kind === "inbox" && getAccount(incoming.accountId)?.kind !== "inbox" ? incoming.accountId : previous?.accountId;
      saveReel(previous ? { ...incoming, accountId: accountId!, annotation: previous.annotation, creatorKey: incoming.creatorKey || previous.creatorKey, creatorName: incoming.creatorName || previous.creatorName, creatorAvatarUrl:incoming.creatorAvatarUrl || previous.creatorAvatarUrl, durationSeconds: incoming.durationSeconds ?? previous.durationSeconds, mediaRevision: previous.mediaRevision, starred: previous.starred, status: previous.status, error: previous.error, evidence: previous.evidence, analysis: previous.analysis, analysisProvider: previous.analysisProvider, analysisUsage: previous.analysisUsage, analyzedAt: previous.analyzedAt } : incoming);
      const owner=getAccount(accountId || incoming.accountId);
      if(owner && owner.kind!=="inbox" && incoming.creatorAvatarUrl && (!incoming.creatorKey || incoming.creatorKey===`instagram:${owner.username}`)) saveAccount({...owner,profileImageUrl:incoming.creatorAvatarUrl,profileCheckedAt:new Date().toISOString(),profileError:null});
    }
  })();
}
interface PrivateSettings extends Settings { apifyToken: string; openaiKey: string }
export function privateSettings(): PrivateSettings {
  const row = db().prepare("SELECT data FROM settings WHERE id='default'").get() as { data: string } | undefined;
  const saved = row ? JSON.parse(row.data) : {};
  return { provider: "codex", codexModel: "", openaiModel: process.env.OPENAI_MODEL || "", whisperModel: "base", language: "", brandContext: "", brief: { business: "", audience: "", language: "", tone: "", constraints: "", goal: "" }, codexEffort: "medium", openaiEffort: "default", apifyToken: process.env.APIFY_API_TOKEN || "", openaiKey: process.env.OPENAI_API_KEY || "", ...saved };
}
export function publicSettings(): PublicSettings {
  const { apifyToken, openaiKey, ...settings } = privateSettings();
  return { ...settings, hasApifyToken: Boolean(apifyToken), hasOpenaiKey: Boolean(openaiKey) };
}
export function saveSettings(values: Partial<PrivateSettings>) {
  const settings = { ...privateSettings(), ...values };
  changes().revision++;
  db().prepare("INSERT INTO settings(id,data) VALUES('default',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(JSON.stringify(settings));
}
export function snapshot(): Snapshot {
  const reels = getReels(), state = changes();
  if (!state.performances || state.cachedBaseline !== state.baseline) { state.performances = cataloguePerformances(reels); state.cachedBaseline = state.baseline; }
  const counts = new Map<string, number>();
  for (const reel of reels) counts.set(reel.accountId, (counts.get(reel.accountId) || 0) + 1);
  return { ideas: getIdeas(), revision: workspaceRevision(), accounts: getAccounts().map(a => ({ ...a, reelCount: counts.get(a.id) || 0 })),
    reels: reels.map(r => ({ ...r, videoUrl: "", performance: state.performances!.get(r.id) })),
    collections: getCollections(), research: all<ResearchReport>("research").sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
    jobs: recentJobs(), comparisons: all<SavedComparison>("comparisons").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), settings: publicSettings() };
}

function recentJobs(): Job[] {
  return (db().prepare("SELECT data FROM jobs ORDER BY json_extract(data, '$.createdAt') DESC, rowid DESC LIMIT 100").all() as {data:string}[]).map(row => {
    const job = JSON.parse(row.data) as Job;
    if (job.runSettings) { const { connectionId: _connectionId, ...settings } = job.runSettings; void _connectionId; job.runSettings = settings; }
    return job;
  });
}
export function activity() {
  const jobs = recentJobs(), ids = [...new Set(jobs.flatMap(job => job.reelIds))];
  const reels = ids.length ? db().prepare(`SELECT id, json_extract(data, '$.status') AS status, json_extract(data, '$.error') AS error FROM reels WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) as Pick<Reel,'id'|'status'|'error'>[] : [];
  return { revision: workspaceRevision(), jobs, reels };
}
export function saveUsage(receipt: ModelUsage) {
  put('usage', receipt);
  changes().revision++;
  const job = receipt.jobId ? getJob(receipt.jobId) : null;
  if (job) saveJob({ ...job, usage: [...(job.usage || []), receipt] });
}
export function getUsage(limit = 500): ModelUsage[] {
  return (db().prepare('SELECT data FROM usage ORDER BY rowid DESC LIMIT ?').all(limit) as {data:string}[]).map(row => JSON.parse(row.data));
}
export function usageSummary() {
  return db().prepare(`SELECT json_extract(data, '$.provider') AS provider, json_extract(data, '$.model') AS model,
    count(*) AS requests, sum(json_extract(data, '$.inputTokens')) AS inputTokens,
    sum(json_extract(data, '$.outputTokens')) AS outputTokens, sum(json_extract(data, '$.cachedInputTokens')) AS cachedInputTokens,
    sum(CASE WHEN json_extract(data, '$.totalTokens') IS NULL OR json_extract(data, '$.cachedInputTokens') IS NULL THEN 1 ELSE 0 END) AS unknownUsage,
    count(json_extract(data, '$.estimatedUsd')) AS knownCosts, sum(json_extract(data, '$.estimatedUsd')) AS estimatedUsd
    FROM usage GROUP BY provider, model ORDER BY requests DESC`).all();
}

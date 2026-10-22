import { createHash } from "node:crypto";
import type { ComparisonContext, Performance, Reel } from "./types";

export function normalizeHandle(value: string): string {
  let handle = value.trim();
  if (/^https?:\/\//i.test(handle)) {
    const url = new URL(handle);
    if (!["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase())) throw new Error("Use an Instagram handle or profile URL.");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 1 && !(parts.length === 2 && parts[1] === "reels")) throw new Error("Enter an account, not an individual post.");
    handle = parts[0] || "";
  }
  handle = handle.replace(/^@/, "").replace(/\/$/, "").toLowerCase();
  if (!/^[a-z0-9_](?:[a-z0-9_.]{0,28}[a-z0-9_])?$/.test(handle) || handle.includes("..") || ["reel", "reels", "p", "stories", "explore", "accounts"].includes(handle)) throw new Error("Enter a valid Instagram username.");
  return handle;
}

export function safeInstagramUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase()) || !/^\/(reel|p)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) throw new Error("Use a public Instagram Reel URL.");
  return `https://www.instagram.com${url.pathname.replace(/\/$/, "")}/`;
}
export function safeCdnUrl(value: string): string {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port || url.username || url.password || !["cdninstagram.com", "fbcdn.net"].some(suffix => host === suffix || host.endsWith(`.${suffix}`))) throw new Error("Unsupported Instagram media host.");
  return url.toString();
}
const positiveNumber = (value: unknown): number | null => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; };
const nullableCount = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
export function ownerFromRow(row: Record<string,unknown>) {
  const owner=row.owner && typeof row.owner==="object" && !Array.isArray(row.owner) ? row.owner as Record<string,unknown> : {};
  return {username:String(row.ownerUsername || owner.username || "").toLowerCase(),name:String(row.ownerFullName || owner.fullName || owner.full_name || "").slice(0,150),picture:String(row.ownerProfilePicUrl || row.ownerProfilePictureUrl || owner.profilePicUrlHD || owner.profilePicUrl || owner.profile_pic_url_hd || owner.profile_pic_url || "")};
}
export function normalizeReel(row: Record<string, unknown>, accountId: string, source: "apify" | "import"): Reel | null {
  let url: string;
  try { url = safeInstagramUrl(String(row.url || row.postUrl || row.inputUrl || "")); } catch { return null; }
  if (row.type === "Image" || row.type === "Sidecar" || row.isVideo === false) return null;
  const shortcode = new URL(url).pathname.split("/").filter(Boolean)[1];
  const date = row.timestamp || row.postedAt || row.datePosted;
  const postedAt = date && Number.isFinite(Date.parse(String(date))) ? new Date(String(date)).toISOString() : null;
  const images = Array.isArray(row.images) ? row.images : [];
  let thumbnail = "", videoUrl = "";
  try { thumbnail = safeCdnUrl(String(row.displayUrl || row.thumbnailUrl || row.thumbnail || images[0] || "")); } catch { /* missing or unsupported CDN */ }
  try { videoUrl = safeCdnUrl(String(row.videoUrl || "")); } catch { /* refresh or yt-dlp can recover */ }
  const owner=ownerFromRow(row);let creatorAvatarUrl="";
  try {creatorAvatarUrl=safeCdnUrl(owner.picture);}catch{/* A real profile picture is optional. */}
  return {
    platform:"instagram",creatorKey:owner.username ? `instagram:${owner.username}` : undefined,creatorName:owner.name || undefined,creatorAvatarUrl:creatorAvatarUrl || undefined,
    id: `ig_${createHash("sha256").update(shortcode).digest("hex").slice(0, 24)}`, accountId, shortcode, url,
    caption: String(row.caption || "").slice(0, 20000), thumbnail, videoUrl,
    views: nullableCount(row.videoPlayCount ?? row.videoViewCount ?? row.playCount ?? row.views),
    likes: nullableCount(row.likesCount ?? row.likes), comments: nullableCount(row.commentsCount ?? row.comments),
    durationSeconds: positiveNumber(row.videoDuration ?? row.durationSeconds ?? row.duration),
    postedAt, collectedAt: new Date().toISOString(), source, status: "idle", error: null, starred: false,
    evidence: null, analysis: null, analysisProvider: null, analyzedAt: null,
  };
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export const durationFor = (reel: Reel): number | null => reel.evidence?.duration ?? reel.durationSeconds ?? null;
export function ageAtSnapshot(reel: Reel): number | null {
  if (!reel.postedAt) return null;
  const days = (Date.parse(reel.collectedAt) - Date.parse(reel.postedAt)) / 86400000;
  return Number.isFinite(days) && days >= 0 ? days : null;
}
const ageBucket = (days: number) => [1, 3, 7, 30, 90, 365].findIndex(limit => days < limit);
export function pairReasons(left: Reel, right: Reel): string[] {
  const reasons: string[] = [];
  const a = durationFor(left), b = durationFor(right), ageA = ageAtSnapshot(left), ageB = ageAtSnapshot(right);
  if (a === null || b === null) reasons.push("Duration is missing for one or both Reels.");
  else if (Math.min(a, b) / Math.max(a, b) < 2 / 3) reasons.push("Video lengths differ by more than 1.5×.");
  if (!left.analysis?.format || !right.analysis?.format || left.analysis.format === "other" || right.analysis.format === "other") reasons.push("A specific format has not been identified for both Reels.");
  else if (left.analysis.format !== right.analysis.format) reasons.push("The creative formats differ.");
  if (ageA === null || ageB === null) reasons.push("Post age is unavailable.");
  else if (ageBucket(ageA) !== ageBucket(ageB)) reasons.push("Views were recorded at different post-age ranges.");
  if ((left.platform || "instagram") !== (right.platform || "instagram")) reasons.push("Different platforms have different distribution.");
  if (left.accountId !== right.accountId) reasons.push("Different accounts have different audiences and distribution.");
  return reasons;
}
export function performanceFor(reel: Reel, catalogue: Reel[]): Performance {
  const cohort = catalogue.filter(r => r.accountId === reel.accountId && ((reel.source !== "link" && r.source !== "link") || Boolean(reel.creatorKey && r.creatorKey === reel.creatorKey)) && (r.platform || "instagram") === (reel.platform || "instagram") && r.id !== reel.id && r.views !== null && r.source !== "upload");
  const duration = durationFor(reel), age = ageAtSnapshot(reel), format = reel.analysis?.format;
  const filters: string[] = [];
  if (duration !== null) filters.push("length within 1.5×");
  if (age !== null) filters.push("same post-age range at collection");
  if (format && format !== "other") filters.push(`format: ${format}`);
  const similar = cohort.filter(other => {
    const d = durationFor(other), a = ageAtSnapshot(other);
    return (duration === null || (d !== null && Math.min(duration, d) / Math.max(duration, d) >= 2 / 3))
      && (age === null || (a !== null && ageBucket(age) === ageBucket(a)))
      && (!format || format === "other" || other.analysis?.format === format);
  });
  const matched = filters.length > 0 && similar.length >= 5;
  const peers = matched ? similar : cohort;
  const medianViews = median(peers.map(r => r.views!));
  const sufficient = peers.length >= 5 && medianViews !== null && medianViews > 0 && reel.views !== null && reel.source !== "upload";
  const multiple = sufficient ? reel.views! / medianViews! : null;
  const quality = matched && duration !== null && age !== null && format && format !== "other" ? "moderate" : "weak";
  let note = sufficient ? (matched ? `Matched on ${filters.join(", ")}.` : "Too few similar Reels; using the broader account median.") : "At least 5 other Reels with views and a positive median are needed for a baseline.";
  if (sufficient && quality === "weak") note += " Missing format, duration, age, or comparable peers makes this a weak comparison.";
  note += " Cumulative views are snapshots, not age-normalized rates. Paid reach and audience differences are unknown.";
  return { medianViews, sampleSize: peers.length, multiple, note, ageDays: age, durationSeconds: duration,
    cohort: sufficient ? matched ? "similar" : "account" : "insufficient", filters: matched ? filters : [], quality,
    standout: multiple !== null && multiple >= 2, asOf: reel.collectedAt };
}
export function comparisonContext(reels: Reel[]): ComparisonContext {
  const pairs: ComparisonContext["pairs"] = [];
  for (let i = 0; i < reels.length; i++) for (let j = i + 1; j < reels.length; j++) {
    const reasons = pairReasons(reels[i], reels[j]);
    pairs.push({ leftId: reels[i].id, rightId: reels[j].id, comparable: reasons.length === 0, reasons });
  }
  const reasons = [...new Set(pairs.flatMap(pair => pair.reasons))];
  const usableBaselines = reels.every(reel => reel.performance?.multiple != null && reel.performance?.quality === "moderate");
  if (!usableBaselines) reasons.push("At least one Reel has a broad, weak or unavailable baseline; performance rankings are unreliable.");
  reasons.push("Selected Reels are a small, user-chosen sample. These comparisons cannot establish causation or control paid distribution.");
  return { quality: pairs.length && pairs.every(pair => pair.comparable) && usableBaselines ? "moderate" : "weak", reasons, pairs,
    rows: reels.map(r => ({ reelId: r.id, ageDays: ageAtSnapshot(r), durationSeconds: durationFor(r), format: r.analysis?.format || null, multiple: r.performance?.multiple ?? null, sampleSize: r.performance?.sampleSize || 0, cohort: r.performance?.cohort || "insufficient" })) };
}

import type { Account, Reel } from "./types";
import type { GapContext } from "./research-types";
import { platformFor } from "./research-types";

export const roleFor = (account: Account | undefined) => account?.role || "competitor";
export const hookFor = (reel: Reel) => reel.annotation?.hookType !== undefined && reel.annotation.hookType !== "unknown" ? reel.annotation.hookType : reel.analysis?.classification?.hookType || "unknown";
export const ctaFor = (reel: Reel) => reel.annotation?.ctaType !== undefined && reel.annotation.ctaType !== "unknown" ? reel.annotation.ctaType : reel.analysis?.classification?.ctaType || "unknown";
export const secondsFor = (reel: Reel) => reel.evidence?.duration ?? reel.durationSeconds ?? null;
export function creativePairReasons(own: Reel, peer: Reel): string[] {
  const reasons: string[] = [], a = secondsFor(own), b = secondsFor(peer);
  if (platformFor(own) !== platformFor(peer)) reasons.push("Different platforms.");
  if (a === null || b === null) reasons.push("Duration is missing.");
  else if (Math.min(a,b) / Math.max(a,b) < 2/3) reasons.push("Lengths differ by more than 1.5×.");
  if (!own.analysis?.format || !peer.analysis?.format || own.analysis.format === "other" || peer.analysis.format === "other") reasons.push("A specific format is unavailable.");
  else if (own.analysis.format !== peer.analysis.format) reasons.push("Formats differ.");
  if (own.creatorKey && own.creatorKey === peer.creatorKey || own.accountId === peer.accountId) reasons.push("These examples belong to the same creator.");
  return reasons;
}
export function gapContext(own: Reel[], competitors: Reel[]): GapContext {
  const pairs = own.flatMap(a => competitors.map(b => { const reasons = creativePairReasons(a,b); return { ownId: a.id, competitorId: b.id, matched: !reasons.length, reasons }; }));
  return { pairs, matchedPairs: pairs.filter(p=>p.matched).length, ownCount: own.length, competitorCount: competitors.length, limitations: [
    "Creative matches use platform, observed format and length within 1.5×. They do not establish an effective tactic or a performance advantage.",
    "Gaps describe only your selected, analyzed examples, not everything an account has posted. Topic and audience similarity still need human review.",
    "Post ages, audience size, distribution and paid reach differ. Raw views across creators are not a fair ranking.",
    ...(pairs.some(p=>!p.matched) ? ["Some pairs are not comparable; use their differences as exploratory ideas only."] : []),
    ...(!pairs.some(p=>p.matched) ? ["No matched pairs are available. There is insufficient evidence to assert a creative gap."] : []),
  ] };
}
export type AnalyticsDimension = "format" | "length" | "hook" | "cta";
export function analyticsGroups(reels: Reel[], dimension: AnalyticsDimension) {
  const groups = new Map<string, Reel[]>();
  for (const reel of reels) {
    const seconds = secondsFor(reel);
    const key = dimension === "format" ? reel.analysis?.format || "unknown" : dimension === "hook" ? hookFor(reel) : dimension === "cta" ? ctaFor(reel) : seconds === null ? "unknown" : seconds <= 15 ? "0–15 seconds" : seconds <= 30 ? "16–30 seconds" : seconds <= 60 ? "31–60 seconds" : "Over 60 seconds";
    groups.set(key, [...(groups.get(key) || []), reel]);
  }
  return [...groups].map(([key, items]) => {
    const usable = items.filter(r => r.performance?.quality === "moderate" && r.performance?.cohort === "similar" && r.performance.multiple != null);
    const multiples = usable.map(r => r.performance!.multiple!).sort((a,b)=>a-b), mid = Math.floor(multiples.length/2);
    return { key, count: items.length, reelIds: items.map(r=>r.id), share: reels.length ? items.length/reels.length : 0,
      baselineCount: usable.length, medianMultiple: multiples.length >= 5 ? multiples.length % 2 ? multiples[mid] : (multiples[mid-1]+multiples[mid])/2 : null,
      creators: new Set(items.map(r=>r.source === "link" ? r.creatorKey : r.accountId).filter(Boolean)).size, unknownCreators:items.filter(r=>r.source==="link" && !r.creatorKey).length };
  }).sort((a,b)=>b.count-a.count || a.key.localeCompare(b.key));
}

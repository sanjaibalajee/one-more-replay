import { ageAtSnapshot, durationFor } from "./catalogue";
import type { Performance, Reel } from "./types";

type Stats = { count: number; median: number | null };
const ageBucket = (days: number) => [1, 3, 7, 30, 90, 365].findIndex(limit => days < limit);
const lowerBound = (values: number[], value: number) => {
  let lo = 0, hi = values.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (values[mid] < value) lo = mid + 1; else hi = mid; }
  return lo;
};
function excluding(values: number[], target: number | null): Stats {
  const removed = target === null ? -1 : lowerBound(values, target);
  const count = values.length - (removed >= 0 ? 1 : 0);
  const at = (i: number) => values[i + (removed >= 0 && i >= removed ? 1 : 0)];
  return { count, median: count ? count % 2 ? at(count >>> 1) : (at((count >>> 1) - 1) + at(count >>> 1)) / 2 : null };
}
// Order statistics for a sliding duration window. No peer list is sorted per Reel.
class ViewCounts {
  private tree: number[];
  count = 0;
  constructor(private values: number[]) { this.tree = Array(values.length + 1).fill(0); }
  add(value: number, delta: number) {
    this.count += delta;
    for (let i = lowerBound(this.values, value) + 1; i < this.tree.length; i += i & -i) this.tree[i] += delta;
  }
  private at(rank: number) {
    let index = 0;
    for (let step = 2 ** Math.floor(Math.log2(this.values.length || 1)); step; step >>= 1) {
      const next = index + step;
      if (next < this.tree.length && this.tree[next] < rank) { index = next; rank -= this.tree[next]; }
    }
    return this.values[index];
  }
  stats(): Stats {
    return { count: this.count, median: this.count ? this.count % 2 ? this.at((this.count + 1) / 2) : (this.at(this.count / 2) + this.at(this.count / 2 + 1)) / 2 : null };
  }
}
function result(reel: Reel, broad: Stats, similar: Stats): Performance {
  const duration = durationFor(reel), age = ageAtSnapshot(reel), format = reel.analysis?.format;
  const filters: string[] = [];
  if (duration !== null) filters.push("length within 1.5×");
  if (age !== null) filters.push("same post-age range at collection");
  if (format && format !== "other") filters.push(`format: ${format}`);
  const matched = filters.length > 0 && similar.count >= 5, peers = matched ? similar : broad;
  const sufficient = peers.count >= 5 && peers.median !== null && peers.median > 0 && reel.views !== null && reel.source !== "upload";
  const multiple = sufficient ? reel.views! / peers.median! : null;
  const quality = matched && duration !== null && age !== null && format && format !== "other" ? "moderate" : "weak";
  let note = sufficient ? matched ? `Matched on ${filters.join(", ")}.` : "Too few similar Reels; using the broader account median." : "At least 5 other Reels with views and a positive median are needed for a baseline.";
  if (sufficient && quality === "weak") note += " Missing format, duration, age, or comparable peers makes this a weak comparison.";
  note += " Cumulative views are snapshots, not age-normalized rates. Paid reach and audience differences are unknown.";
  return { medianViews: peers.median, sampleSize: peers.count, multiple, note, ageDays: age, durationSeconds: duration,
    cohort: sufficient ? matched ? "similar" : "account" : "insufficient", filters: matched ? filters : [], quality,
    standout: multiple !== null && multiple >= 2, asOf: reel.collectedAt };
}
export function cataloguePerformances(reels: Reel[]): Map<string, Performance> {
  const pools = new Map<string, { rows: Reel[]; ids: Set<string>; values: number[] }>();
  const creatorRows = new Map<string, Reel[]>(), linkedRows = new Map<string, Reel[]>(), catalogueRows = new Map<string, Reel[]>();
  const keyFor = (r: Reel) => JSON.stringify([r.accountId, r.platform || "instagram"]);
  for (const r of reels) if (r.views !== null && r.source !== "upload") {
    const key = keyFor(r);
    if (r.creatorKey) {
      const creator = JSON.stringify([key, r.creatorKey]);
      if (!creatorRows.has(creator)) creatorRows.set(creator, []); creatorRows.get(creator)!.push(r);
      if (r.source === "link") { if (!linkedRows.has(creator)) linkedRows.set(creator, []); linkedRows.get(creator)!.push(r); }
    }
    if (r.source !== "link") { if (!catalogueRows.has(key)) catalogueRows.set(key, []); catalogueRows.get(key)!.push(r); }
  }
  const broad = new Map<string, Stats>();
  const groups = new Map<string, { rows: Reel[]; targets: Reel[]; ids: Set<string> }>();
  for (const reel of reels) {
    const account = keyFor(reel), creator = JSON.stringify([account, reel.creatorKey]);
    const links = reel.creatorKey ? linkedRows.get(creator) || [] : [];
    const poolKey = JSON.stringify([account, reel.source === "link", reel.source === "link" || links.length ? reel.creatorKey || null : null]);
    if (!pools.has(poolKey)) {
      const rows = reel.source === "link" ? reel.creatorKey ? creatorRows.get(creator) || [] : [] : [...(catalogueRows.get(account) || []), ...links];
      pools.set(poolKey, { rows, ids: new Set(rows.map(r => r.id)), values: rows.map(r => r.views!).sort((a, b) => a - b) });
    }
    const pool = pools.get(poolKey)!;
    broad.set(reel.id, excluding(pool.values, pool.ids.has(reel.id) ? reel.views : null));
    const age = ageAtSnapshot(reel), bucket = age === null ? null : ageBucket(age), format = reel.analysis?.format;
    const specificFormat = format && format !== "other" ? format : null;
    const groupKey = JSON.stringify([poolKey, bucket, specificFormat]);
    if (!groups.has(groupKey)) {
      const rows = pool.rows.filter(r => (bucket === null || (ageAtSnapshot(r) !== null && ageBucket(ageAtSnapshot(r)!) === bucket)) && (!specificFormat || r.analysis?.format === specificFormat));
      groups.set(groupKey, { rows, targets: [], ids: new Set(rows.map(r => r.id)) });
    }
    groups.get(groupKey)!.targets.push(reel);
  }
  const output = new Map<string, Performance>();
  for (const group of groups.values()) {
    const allValues = group.rows.map(r => r.views!).sort((a, b) => a - b);
    const rows = group.rows.map(r => ({ r, duration: durationFor(r) })).filter((x): x is { r: Reel; duration: number } => x.duration !== null && x.duration > 0).sort((a, b) => a.duration - b.duration);
    const counts = new ViewCounts([...new Set(allValues)]), present = new Set<string>();
    let left = 0, right = 0;
    const targets = [...group.targets].sort((a, b) => (durationFor(a) ?? -1) - (durationFor(b) ?? -1));
    for (const reel of targets) {
      const duration = durationFor(reel);
      let similar: Stats;
      if (duration === null) similar = excluding(allValues, group.ids.has(reel.id) ? reel.views : null);
      else if (!(duration > 0)) similar = { count: 0, median: null };
      else {
        while (right < rows.length && (rows[right].duration <= duration || duration / rows[right].duration >= 2 / 3)) {
          const row = rows[right++]; counts.add(row.r.views!, 1); present.add(row.r.id);
        }
        while (left < right && rows[left].duration < duration && rows[left].duration / duration < 2 / 3) {
          const row = rows[left++]; counts.add(row.r.views!, -1); present.delete(row.r.id);
        }
        const self = present.has(reel.id);
        if (self) counts.add(reel.views!, -1);
        similar = counts.stats();
        if (self) counts.add(reel.views!, 1);
      }
      output.set(reel.id, result(reel, broad.get(reel.id)!, similar));
    }
  }
  return output;
}

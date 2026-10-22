import { normalizeReel, ownerFromRow } from "./catalogue";
import type { Reel } from "./types";

const API = "https://api.apify.com/v2";
const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const onAbort = () => { clearTimeout(timer); reject(new Error("Cancelled.")); };
  const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
  if (signal.aborted) onAbort(); else signal.addEventListener("abort", onAbort, { once: true });
});
export async function collectReels(username: string, accountId: string, limit: number, token: string, signal: AbortSignal, progress: (detail: string) => void): Promise<{ reels: Reel[]; note: string }> {
  if (!token) throw new Error("Add an Apify token in Connections, or import an existing Apify JSON export.");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  async function api<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API}${endpoint}`, { ...init, headers, signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]), cache: "no-store" });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("Apify rejected the token or this actor is unavailable to your account. Check Connections.");
      if (response.status === 402) throw new Error("Apify needs scraping credits. Your saved research is unchanged.");
      throw new Error(`Apify returned HTTP ${response.status}. Retry collection later.`);
    }
    return response.json() as Promise<T>;
  }
  type ActorRun = { id: string; status: string; defaultDatasetId: string; statusMessage?: string };
  let runId: string | null = null;
  try {
    const started = await api<{ data: ActorRun }>(`/acts/apify~instagram-reel-scraper/runs?maxItems=${limit}`, { method: "POST", body: JSON.stringify({ username: [username], resultsLimit: limit, includeTranscript: false, skipPinnedPosts: false }) });
    let actorRun = started.data; runId = actorRun.id;
    const deadline = Date.now() + 15 * 60000;
    while (!["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(actorRun.status)) {
      if (Date.now() > deadline) throw new Error("Collection exceeded 15 minutes. Retry with a smaller fetch limit.");
      progress(`Collecting @${username} · up to ${limit} Reels · ${actorRun.status.toLowerCase()}`);
      await wait(2500, signal);
      actorRun = (await api<{ data: ActorRun }>(`/actor-runs/${runId}`)).data;
    }
    if (actorRun.status !== "SUCCEEDED") throw new Error(`Instagram collection ${actorRun.status.toLowerCase()}. The account may be private, unavailable, or rate limited.`);
    const rows = await api<Record<string, unknown>[]>(`/datasets/${actorRun.defaultDatasetId}/items?clean=true&limit=${limit}`);
    const reels = [...new Map(rows.filter(row=>!ownerFromRow(row).username || ownerFromRow(row).username===username).map(row => normalizeReel(row, accountId, "apify")).filter((r): r is Reel => r !== null).map(r => [r.id, r])).values()];
    return { reels, note: `Received ${reels.length} Reels from a request for up to ${limit}. ${reels.length >= limit ? "The fetch limit was reached; increase it to look for older Reels." : "The provider returned fewer than requested; this does not guarantee complete account coverage."} Refreshing with a larger limit re-fetches earlier results and may use additional Apify credits.` };
  } catch (err) {
    if (runId) await fetch(`${API}/actor-runs/${runId}/abort`, { method: "POST", headers, signal: AbortSignal.timeout(5000) }).catch(() => {});
    throw err;
  }
}

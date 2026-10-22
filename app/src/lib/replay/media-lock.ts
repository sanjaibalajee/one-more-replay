import { getJobs, getReel } from "./store";

// One server process; reservations survive route-module duplication and hot reloads.
const globals = globalThis as typeof globalThis & { replayUploads?: Map<string, symbol> };
const uploads = () => globals.replayUploads ||= new Map<string, symbol>();
export function assertMediaAvailable(ids: string[]) {
  if (ids.some(id => uploads().has(id))) throw new Error("A selected video is being replaced. Wait for its upload to finish.");
}
export function reserveUpload(id: string): () => void {
  assertMediaAvailable([id]);
  if (uploads().size >= 2) throw new Error("Two uploads are already processing. Wait for one to finish.");
  const reel = getReel(id);
  if ((reel && !["idle", "completed", "failed", "cancelled"].includes(reel.status)) || getJobs().some(job => !["completed", "failed", "cancelled"].includes(job.phase) && job.reelIds.includes(id))) {
    throw new Error("Wait for this video's active job before replacing its file.");
  }
  const reservation = Symbol(id);
  uploads().set(id, reservation);
  return () => { if (uploads().get(id) === reservation) uploads().delete(id); };
}

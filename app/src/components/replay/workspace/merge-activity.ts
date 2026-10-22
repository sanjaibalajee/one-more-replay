import type { Job, Reel, Snapshot } from "@/lib/replay/types";
export interface Activity {
  jobs: Job[];
  reels: Pick<Reel, "id" | "status" | "error">[];
}

// Keep the catalogue and its cached search index stable when only job progress changes.
export function mergeActivity(previous: Snapshot, next: Activity): Snapshot {
  const states = new Map(next.reels.map((reel) => [reel.id, reel]));
  let changed = false;
  const reels = previous.reels.map((reel) => {
    const state = states.get(reel.id);
    if (!state || (state.status === reel.status && state.error === reel.error))
      return reel;
    changed = true;
    return { ...reel, status: state.status, error: state.error };
  });
  const jobsChanged =
    JSON.stringify(previous.jobs) !== JSON.stringify(next.jobs);
  if (!changed && !jobsChanged) return previous;
  return {
    ...previous,
    jobs: jobsChanged ? next.jobs : previous.jobs,
    reels: changed ? reels : previous.reels,
  };
}

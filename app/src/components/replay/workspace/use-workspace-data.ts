"use client";
import { active } from "@/components/replay/jobs/job-state";
import type { Job, Readiness, Snapshot } from "@/lib/replay/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { mergeActivity } from "./merge-activity";

export function useWorkspaceData() {
  const [data, setData] = useState<Snapshot | null>(null),
    [health, setHealth] = useState<Readiness | null>(null);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const revision = useRef<string | undefined>(undefined);
  const refreshing = useRef<Promise<void> | null>(null),
    refreshRequested = useRef(false);
  const refresh = useCallback((): Promise<void> => {
    refreshRequested.current = true;
    if (!refreshing.current)
      refreshing.current = (async () => {
        do {
          refreshRequested.current = false;
          const response = await fetch("/api/replay", { cache: "no-store" });
          if (!response.ok)
            throw new Error(
              "Couldn't load your research. Check that the local server is running.",
            );
          const next: Snapshot = await response.json();
          revision.current = next.revision;
          setData(next);
        } while (refreshRequested.current);
      })().finally(() => {
        refreshing.current = null;
      });
    return refreshing.current;
  }, []);
  const checkHealth = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch("/api/replay?health=1", {
        cache: "no-store",
        signal,
      });
      if (r.ok && !signal?.aborted) setHealth(await r.json());
    } catch {
      /* Keep the connection unchecked when the server is unavailable. */
    }
  }, []);
  const working = data?.jobs.some(active) || false;
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        await refreshing.current;
        if (controller.signal.aborted) return;
        const response = await fetch("/api/replay?activity=1", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not refresh job activity.");
        const next: {
          revision: string;
          jobs: Job[];
          reels: Pick<Snapshot["reels"][number], "id" | "status" | "error">[];
        } = await response.json();
        if (controller.signal.aborted) return;
        if (refreshing.current) await refreshing.current;
        else if (next.revision !== revision.current) await refresh();
        else
          setData((previous) => {
            if (!previous) return previous;
            return mergeActivity(previous, next);
          });
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Could not refresh activity.",
          );
      } finally {
        if (!controller.signal.aborted)
          timer = setTimeout(() => void poll(), working ? 2000 : 15000);
      }
    };
    timer = setTimeout(() => void poll(), working ? 2000 : 15000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [refresh, working]);

  async function act<T = unknown>(
    payload: Record<string, unknown>,
  ): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Something went wrong.");
      await refresh();
      return result as T;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { data, health, error, setError, busy, refresh, checkHealth, act };
}

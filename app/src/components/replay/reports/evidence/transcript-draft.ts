"use client";
import { useMemo, useSyncExternalStore } from "react";

const eventName = "replay-transcript-draft";
const memory = new Map<string, string | null>();
const keyFor = (id: string) => `replay:transcript-draft:${id}`;
export interface TranscriptDraft {
  expectedRevision: string;
  lines: string[];
}
const subscribe = (callback: () => void) => {
  window.addEventListener(eventName, callback);
  return () => window.removeEventListener(eventName, callback);
};
function read(id: string) {
  if (memory.has(id)) return memory.get(id) ?? null;
  try {
    return sessionStorage.getItem(keyFor(id)) ?? memory.get(id) ?? null;
  } catch {
    return memory.get(id) ?? null;
  }
}
export function saveTranscriptDraft(id: string, draft: TranscriptDraft | null) {
  if (draft) memory.set(id, JSON.stringify(draft));
  else memory.set(id, null);
  try {
    if (draft) sessionStorage.setItem(keyFor(id), JSON.stringify(draft));
    else sessionStorage.removeItem(keyFor(id));
  } catch {
    /* Keep edits in memory if browser storage is unavailable. */
  }
  window.dispatchEvent(new Event(eventName));
}
export function useTranscriptDraft(id: string): TranscriptDraft | null {
  const serialized = useSyncExternalStore(
    subscribe,
    () => read(id),
    () => null,
  );
  return useMemo(() => {
    if (!serialized) return null;
    try {
      const value = JSON.parse(serialized);
      return typeof value.expectedRevision === "string" &&
        value.expectedRevision.length <= 1000 &&
        Array.isArray(value.lines) &&
        value.lines.length <= 2000 &&
        value.lines.every(
          (line: unknown) => typeof line === "string" && line.length <= 4000,
        )
        ? (value as TranscriptDraft)
        : null;
    } catch {
      return null;
    }
  }, [serialized]);
}

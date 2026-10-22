"use client";

import { useSyncExternalStore } from "react";
import type { View } from "./types";

const views: View[] = [
  "library",
  "reports",
  "inspiration",
  "analytics",
  "gaps",
  "connections",
  "usage",
];
const detailKeys = [
  "reel",
  "report",
  "research",
  "idea",
  "source",
  "panel",
  "target",
  "ids",
  "limit",
] as const;
const panels = [
  "account",
  "upload",
  "import",
  "link",
  "collect",
  "collection",
  "adapt",
] as const;
type Panel = (typeof panels)[number];
type Detail = "reel" | "report" | "research" | "idea";
const changed = "replay:navigate";
const clientSnapshot = () => window.location.search;
const serverSnapshot = () => "";
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(changed, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(changed, callback);
  };
}

export function useWorkspaceNavigation() {
  const search = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const params = new URLSearchParams(search);
  const requestedView = params.get("view") as View;
  const view = views.includes(requestedView) ? requestedView : "library";
  const accountId = params.get("account") || "all";
  const detail = (["idea", "research", "report", "reel"] as const).find((key) =>
    params.get(key),
  );
  const requestedPanel = params.get("panel") as Panel;
  const panel =
    !detail && panels.includes(requestedPanel) ? requestedPanel : null;
  function update(change: (url: URL) => void, replace = false) {
    const url = new URL(window.location.href);
    change(url);
    if (url.href !== window.location.href) {
      if (replace) window.history.replaceState(null, "", url);
      else window.history.pushState({ replayNavigation: true }, "", url);
    }
    window.dispatchEvent(new Event(changed));
  }
  function show(kind: Detail, id: string | null, source?: string) {
    update((url) => {
      detailKeys.forEach((key) => url.searchParams.delete(key));
      if (id) url.searchParams.set(kind, id);
      if (source) url.searchParams.set("source", source);
    }, !id);
  }
  function navigate(nextView: View, nextAccount = accountId) {
    update((url) => {
      detailKeys.forEach((key) => url.searchParams.delete(key));
      url.searchParams.set("view", nextView);
      if (nextAccount === "all") url.searchParams.delete("account");
      else url.searchParams.set("account", nextAccount);
    });
  }
  function openPanel(
    panel: Panel,
    options: { target?: string; ids?: string[]; limit?: number } = {},
  ) {
    update((url) => {
      detailKeys.forEach((key) => url.searchParams.delete(key));
      url.searchParams.set("panel", panel);
      if (options.target) url.searchParams.set("target", options.target);
      if (options.ids?.length)
        url.searchParams.set("ids", options.ids.join(","));
      if (options.limit) url.searchParams.set("limit", String(options.limit));
    });
  }
  function back() {
    if (window.history.state?.replayNavigation) window.history.back();
    else show("reel", null);
  }
  return {
    view,
    accountId,
    source: detail === "reel" ? params.get("source") : null,
    reel: detail === "reel" ? params.get("reel") : null,
    report: detail === "report" ? params.get("report") : null,
    research: detail === "research" ? params.get("research") : null,
    idea: detail === "idea" ? params.get("idea") : null,
    navigate,
    back,
    openPanel,
    panel,
    target: params.get("target"),
    panelIds: (params.get("ids") || "")
      .split(",")
      .filter((id) => /^[a-zA-Z0-9_-]{1,100}$/.test(id))
      .slice(0, 10),
    limit: Math.min(1000, Math.max(1, Number(params.get("limit")) || 25)),
    closePanel: () => show("reel", null),
    showReel: (id: string | null, source?: string) => show("reel", id, source),
    showComparison: (id: string | null) => show("report", id),
    showResearch: (id: string | null) => show("research", id),
    showIdea: (id: string | null) => show("idea", id),
  };
}

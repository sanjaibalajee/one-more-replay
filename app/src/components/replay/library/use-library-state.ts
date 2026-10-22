"use client";
import { active } from "@/components/replay/jobs/job-state";
import type { Sort, View } from "@/components/replay/workspace/types";
import type { Snapshot } from "@/lib/replay/types";
import { useMemo, useState } from "react";
import {
  buildCatalogueSearch,
  catalogueMatches,
  catalogueTerms,
} from "@/lib/replay/catalogue-search";
export function useLibraryState(
  data: Snapshot | null,
  view: View,
  accountId: string,
) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [durationFilter, setDurationFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [page, setPage] = useState({ key: "", count: 48 });
  const [profileBusy, setProfileBusy] = useState(false);
  const searchTerms = useMemo(() => catalogueTerms(query), [query]);
  const reels = data?.reels,
    accounts = data?.accounts;
  const searchIndex = useMemo(
    () => buildCatalogueSearch(reels || [], accounts || []),
    [reels, accounts],
  );
  function toggle(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.add(id);
      return next;
    });
  }

  const currentAccount = data?.accounts.find((a) => a.id === accountId);
  const catalogue = useMemo(() => {
    if (!reels) return [];
    return reels
      .filter(
        (r) =>
          (accountId === "all" || r.accountId === accountId) &&
          (view !== "reports" || r.analysis) &&
          (!savedOnly || r.starred) &&
          (durationFilter === "all" ||
            (() => {
              const seconds = r.evidence?.duration ?? r.durationSeconds;
              return (
                seconds != null &&
                (durationFilter === "short"
                  ? seconds <= 30
                  : durationFilter === "medium"
                    ? seconds > 30 && seconds <= 60
                    : seconds > 60)
              );
            })()) &&
          (formatFilter === "all" || r.analysis?.format === formatFilter) &&
          catalogueMatches(searchIndex.get(r.id), searchTerms),
      )
      .sort((a, b) =>
        sort === "views"
          ? (b.views ?? -1) - (a.views ?? -1)
          : sort === "baseline"
            ? (b.performance?.multiple ?? -1) - (a.performance?.multiple ?? -1)
            : (b.postedAt || b.collectedAt).localeCompare(
                a.postedAt || a.collectedAt,
              ),
      );
  }, [
    reels,
    searchIndex,
    accountId,
    view,
    savedOnly,
    searchTerms,
    sort,
    durationFilter,
    formatFilter,
  ]);
  const pageKey = [
    view,
    accountId,
    query,
    sort,
    savedOnly,
    durationFilter,
    formatFilter,
  ].join("|");
  const visibleCount = page.key === pageKey ? page.count : 48;
  const firstReels = catalogue.slice(0, 10);
  const selectedFirst = firstReels.filter((reel) =>
    selected.has(reel.id),
  ).length;
  const firstSelection =
    selectedFirst === 0
      ? false
      : selectedFirst === firstReels.length
        ? true
        : ("indeterminate" as const);
  const selectedReels = data?.reels.filter((r) => selected.has(r.id)) || [],
    selectedReady = selectedReels.filter((r) => r.analysis).length;
  const selectedBusy =
    data?.jobs.some(
      (j) => active(j) && j.reelIds.some((id) => selected.has(id)),
    ) || false;

  return {
    firstSelection,
    query,
    setQuery,
    sort,
    setSort,
    savedOnly,
    setSavedOnly,
    selected,
    setSelected,
    durationFilter,
    setDurationFilter,
    formatFilter,
    setFormatFilter,
    pageKey,
    setPage,
    profileBusy,
    setProfileBusy,
    currentAccount,
    catalogue,
    visibleCount,
    selectedReels,
    selectedReady,
    selectedBusy,
    toggle,
  };
}

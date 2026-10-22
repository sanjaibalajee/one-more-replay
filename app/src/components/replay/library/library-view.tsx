"use client";
import { Disclosure } from "@/components/replay/shared/disclosure";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { active } from "@/components/replay/jobs/job-state";
import { ReelCard } from "@/components/replay/library/reel-card";
import type { Action } from "@/components/replay/shared/action";
import { ProfileAvatar } from "@/components/replay/shared/creator-identity";
import { date } from "@/components/replay/shared/format";
import type { Sort, View } from "@/components/replay/workspace/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { roles } from "@/lib/replay/research-types";
import type { Snapshot } from "@/lib/replay/types";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clapperboard,
  FileJson,
  Layers2,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  Upload,
} from "lucide-react";
import type { useLibraryState } from "./use-library-state";
export function LibraryView({
  data,
  view,
  accountId,
  library,
  busy,
  run: act,
  navigate,
  onAddLink,
  onUpload,
  onAddAccount,
  onImport,
  onCollect,
  openResearch,
  openComparison,
  openReel,
}: {
  data: Snapshot;
  view: "library" | "reports";
  accountId: string;
  library: ReturnType<typeof useLibraryState>;
  busy: boolean;
  run: Action;
  navigate: (view: View) => void;
  onAddLink: () => void;
  onUpload: () => void;
  onAddAccount: () => void;
  onImport: () => void;
  onCollect: (request: { accountId: string; limit: number }) => void;
  openResearch: (id: string) => void;
  openComparison: (id: string) => void;
  openReel: (id: string) => void;
}) {
  const {
    firstSelection,
    currentAccount,
    catalogue,
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
    profileBusy,
    setProfileBusy,
    visibleCount,
    pageKey,
    setPage,
    toggle,
  } = library;
  return (
    <>
      <div className="page-heading">
        <div className="page-title">
          {currentAccount && (
            <ProfileAvatar
              name={currentAccount.username}
              src={currentAccount.profileImageUrl}
              platform={
                currentAccount.platform ||
                (currentAccount.username === "local_uploads"
                  ? "local"
                  : "instagram")
              }
              size="large"
            />
          )}
          <div>
            <h1>
              {view === "reports"
                ? "Reports"
                : currentAccount
                  ? currentAccount.kind === "inbox"
                    ? currentAccount.label
                    : currentAccount.username === "local_uploads"
                      ? "Uploaded videos"
                      : `@${currentAccount.username}`
                  : "Reel library"}
            </h1>
            <p>
              {view === "reports"
                ? "Saved analyses and comparisons."
                : "Collect an account’s Reels, then choose what to analyze."}
            </p>
          </div>
        </div>
        {view === "library" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus size={16} />
                Add
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onAddLink}>
                <Link2 size={15} />
                Add link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onUpload}>
                <Upload size={15} />
                Upload video
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddAccount}>
                <Plus size={15} />
                Add account
              </DropdownMenuItem>
              {currentAccount && (
                <DropdownMenuItem onSelect={onImport}>
                  <FileJson size={15} />
                  Import JSON
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {view === "reports" &&
        !data.settings.brief?.business &&
        !data.settings.brandContext && (
          <div className="brief-prompt">
            <span>
              Add a creative brief to get ideas that fit your audience and
              production setup.
            </span>
            <Button
              variant="ghost"
              className="text-link"
              onClick={() => navigate("connections")}
            >
              Add brief
              <ArrowRight size={13} />
            </Button>
          </div>
        )}
      {view === "reports" && data.comparisons.length > 0 && (
        <section className="comparisons-section">
          <div className="section-heading">
            <h2>Comparisons</h2>
            <span className="muted">Saved comparisons</span>
          </div>
          <div className="comparison-list">
            {data.comparisons.map((report) => (
              <Button
                variant="ghost"
                className="comparison-preview"
                key={report.id}
                onClick={() => openComparison(report.id)}
              >
                <span className="comparison-icon">
                  <Layers2 size={19} />
                </span>
                <div>
                  <span className="eyebrow">
                    {report.reelIds.length} REELS · {date(report.createdAt)}
                  </span>
                  <h3>{report.report.title}</h3>
                  <p>{report.report.summary}</p>
                </div>
                <ArrowRight size={18} />
              </Button>
            ))}
          </div>
        </section>
      )}
      {view === "reports" && data.research.length > 0 && (
        <section className="comparisons-section">
          <div className="section-heading">
            <h2>Creative research</h2>
          </div>
          <div className="comparison-list">
            {data.research.map((r) => (
              <Button
                variant="ghost"
                className="comparison-preview"
                key={r.id}
                onClick={() => openResearch(r.id)}
              >
                <div>
                  <span className="eyebrow">
                    {r.kind === "adapt"
                      ? "Pattern adaptation"
                      : "Creative gaps"}{" "}
                    · {date(r.createdAt)}
                  </span>
                  <h3>{r.report.title}</h3>
                  <p>
                    {r.kind === "adapt" ? r.report.mechanism : r.report.summary}
                  </p>
                </div>
                <ArrowRight size={18} />
              </Button>
            ))}
          </div>
        </section>
      )}
      {currentAccount && view === "library" && (
        <Disclosure className="account-management" title={<>Manage account</>}>
          {currentAccount &&
            currentAccount.kind !== "inbox" &&
            currentAccount.username !== "local_uploads" &&
            view === "library" && (
              <div className="account-role-control">
                <Label>
                  Account role
                  <NativeSelect
                    aria-label="Account role"
                    disabled={busy}
                    value={currentAccount.role || "competitor"}
                    onChange={(e) =>
                      void act({
                        action: "role",
                        accountId: currentAccount.id,
                        role: e.target.value,
                      })
                    }
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role === "own"
                          ? "Your account"
                          : role === "competitor"
                            ? "Competitor"
                            : "Inspiration"}
                      </option>
                    ))}
                  </NativeSelect>
                </Label>
                <Button
                  variant="outline"
                  className="btn small"
                  disabled={busy}
                  onClick={() => {
                    setProfileBusy(true);
                    void act({
                      action: "profile",
                      accountId: currentAccount.id,
                    }).finally(() => setProfileBusy(false));
                  }}
                >
                  {profileBusy && <Loader2 size={13} className="spin" />}
                  {profileBusy
                    ? "Fetching photo…"
                    : currentAccount.profileImageUrl
                      ? "Refresh photo"
                      : "Fetch profile photo"}
                </Button>
                {currentAccount.role === "own" && (
                  <Button
                    variant="ghost"
                    className="text-link"
                    onClick={() => navigate("gaps")}
                  >
                    Find creative gaps
                    <ArrowRight size={13} />
                  </Button>
                )}
              </div>
            )}
          {currentAccount && view === "library" && (
            <div className="coverage-bar">
              <div>
                <strong>
                  {currentAccount.reelCount} Reels in your library
                </strong>
                <p>{currentAccount.collectionNote}</p>
              </div>
              <div className="button-row">
                {currentAccount.kind === "inbox" ? (
                  <Button
                    variant="outline"
                    className="btn small"
                    onClick={() => onAddLink()}
                  >
                    <Link2 size={13} />
                    Add another link
                  </Button>
                ) : currentAccount.username === "local_uploads" ? (
                  <Button
                    variant="outline"
                    className="btn small"
                    onClick={() => onUpload()}
                  >
                    <Upload size={13} />
                    Upload video
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="btn small"
                      disabled={
                        busy ||
                        data.jobs.some(
                          (j) => j.accountId === currentAccount.id && active(j),
                        )
                      }
                      onClick={() =>
                        onCollect({
                          accountId,
                          limit: currentAccount.requestedLimit || 50,
                        })
                      }
                    >
                      <RefreshCw size={13} />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      className="btn small"
                      disabled={
                        busy ||
                        data.jobs.some(
                          (j) => j.accountId === currentAccount.id && active(j),
                        ) ||
                        currentAccount.requestedLimit >= 1000
                      }
                      onClick={() =>
                        onCollect({
                          accountId,
                          limit: Math.min(
                            1000,
                            Math.max(50, currentAccount.requestedLimit) + 100,
                          ),
                        })
                      }
                    >
                      Load older
                      <ChevronDown size={13} />
                    </Button>
                    <Button
                      variant="outline"
                      className="btn small"
                      onClick={() => onImport()}
                    >
                      <FileJson size={13} />
                      Import
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </Disclosure>
      )}
      <div className="library-toolbar">
        <div className="library-tabs">
          <Button
            variant="ghost"
            className={!savedOnly ? "selected" : ""}
            onClick={() => setSavedOnly(false)}
          >
            {view === "reports" ? "Breakdowns" : "All Reels"}
            <span>
              {
                data.reels.filter(
                  (r) =>
                    (accountId === "all" || r.accountId === accountId) &&
                    (view !== "reports" || r.analysis),
                ).length
              }
            </span>
          </Button>
          <Button
            variant="ghost"
            className={savedOnly ? "selected" : ""}
            onClick={() => setSavedOnly(true)}
          >
            <Star size={13} />
            Saved
          </Button>
        </div>
        <div className="filter-controls">
          <Label className="search-field">
            <Search size={15} />
            <Input
              aria-label="Search Reels"
              placeholder="Captions, reports or speech…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Label>
          <Label className="sort-field">
            <SlidersHorizontal size={14} />
            <NativeSelect
              aria-label="Sort Reels"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="newest">Newest first</option>
              <option value="views">Most views</option>
              <option value="baseline">Vs. account baseline</option>
            </NativeSelect>
          </Label>
          <Disclosure
            className="advanced-filters"
            title={
              <>
                Filters
                {durationFilter !== "all" || formatFilter !== "all"
                  ? " · active"
                  : ""}
              </>
            }
          >
            <div className="filter-options">
              {" "}
              <Label>
                <NativeSelect
                  aria-label="Filter by length"
                  value={durationFilter}
                  onChange={(e) => setDurationFilter(e.target.value)}
                >
                  <option value="all">Any length</option>
                  <option value="short">Up to 30s</option>
                  <option value="medium">31–60s</option>
                  <option value="long">Over 60s</option>
                </NativeSelect>
              </Label>
              <Label>
                <NativeSelect
                  aria-label="Filter by format"
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                >
                  <option value="all">Any format</option>
                  {[
                    "talking-head",
                    "demonstration",
                    "tutorial",
                    "story",
                    "montage",
                    "interview",
                    "other",
                  ].map((format) => (
                    <option key={format} value={format}>
                      {format.replaceAll("-", " ")}
                    </option>
                  ))}
                </NativeSelect>
              </Label>
            </div>
          </Disclosure>
        </div>
      </div>
      {catalogue.length > 0 ? (
        <>
          <div className="grid-caption">
            <Label>
              <Checkbox
                checked={firstSelection}
                onCheckedChange={(checked) =>
                  setSelected(
                    checked === true
                      ? new Set(catalogue.slice(0, 10).map((r) => r.id))
                      : new Set(),
                  )
                }
              />
              Select first {Math.min(10, catalogue.length)}
            </Label>
            <span>{catalogue.length} Reels · select up to 10 at a time</span>
          </div>
          <div className="reel-grid">
            {catalogue.slice(0, visibleCount).map((reel) => (
              <ReelCard
                key={reel.id}
                reel={reel}
                account={data.accounts.find((a) => a.id === reel.accountId)}
                selected={selected.has(reel.id)}
                selectionFull={selected.size >= 10}
                toggle={() => toggle(reel.id)}
                open={() => openReel(reel.id)}
                star={() =>
                  void act({
                    action: "star",
                    reelId: reel.id,
                    starred: !reel.starred,
                  })
                }
              />
            ))}
          </div>
          {catalogue.length > visibleCount && (
            <Button
              variant="outline"
              className="btn load-more"
              onClick={() =>
                setPage({ key: pageKey, count: visibleCount + 48 })
              }
            >
              Show more · {visibleCount} of {catalogue.length}
            </Button>
          )}
          <p className="library-footnote">
            Views and engagement are public snapshots. Baselines need 5 peers.
            Similar cohorts are used when available; broad account comparisons
            are marked weak. Unknown metrics stay unknown.
          </p>
        </>
      ) : (
        <Empty className="empty-state">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Clapperboard size={36} strokeWidth={1.4} />
            </EmptyMedia>
            <EmptyTitle>
              <h2>
                {query || durationFilter !== "all" || formatFilter !== "all"
                  ? "No matching Reels"
                  : savedOnly
                    ? "No saved Reels"
                    : view === "reports"
                      ? "No reports yet"
                      : currentAccount
                        ? "No Reels collected yet"
                        : "Add your first account"}
              </h2>
            </EmptyTitle>
            <EmptyDescription>
              {query || durationFilter !== "all" || formatFilter !== "all"
                ? "Try a different search or clear the filters."
                : savedOnly
                  ? "Use the star on a Reel to save it."
                  : view === "reports"
                    ? "Select a Reel from the library and analyze it."
                    : currentAccount
                      ? "Collect this account’s public Reels or import an Apify JSON export."
                      : "Enter an Instagram handle to browse its public Reels."}
            </EmptyDescription>
          </EmptyHeader>
          <div className="button-row">
            {view === "reports" ? (
              <Button
                variant="default"
                className="btn primary"
                onClick={() => navigate("library")}
              >
                <ArrowLeft size={15} />
                Go to Reel library
              </Button>
            ) : (
              !savedOnly &&
              !query &&
              (currentAccount ? (
                <>
                  <Button
                    variant="default"
                    className="btn primary"
                    disabled={
                      busy ||
                      currentAccount.username === "local_uploads" ||
                      currentAccount.kind === "inbox"
                    }
                    onClick={() => onCollect({ accountId, limit: 50 })}
                  >
                    <RefreshCw size={15} />
                    Collect Reels
                  </Button>
                  <Button
                    variant="outline"
                    className="btn"
                    onClick={() => onImport()}
                  >
                    Import JSON
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  className="btn primary"
                  onClick={() => onAddAccount()}
                >
                  <Plus size={16} />
                  Add your first account
                </Button>
              ))
            )}
          </div>
          {!data.settings.hasApifyToken && view === "library" && !query && (
            <Button
              variant="ghost"
              className="text-link"
              onClick={() => navigate("connections")}
            >
              Set up account collection
              <ArrowRight size={13} />
            </Button>
          )}
        </Empty>
      )}
    </>
  );
}

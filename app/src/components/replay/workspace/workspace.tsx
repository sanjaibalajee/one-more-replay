"use client";
import { CollectionPicker } from "@/components/replay/collections/collection-picker";
import { JobActivity } from "@/components/replay/jobs/job-activity";
import { active } from "@/components/replay/jobs/job-state";
import { AddLink } from "@/components/replay/library/add-link-form";
import { ImportForm } from "@/components/replay/library/import-form";
import { LibraryView } from "@/components/replay/library/library-view";
import { UploadForm } from "@/components/replay/library/upload-form";
import { useLibraryState } from "@/components/replay/library/use-library-state";
import { ComparisonDetail } from "@/components/replay/reports/comparison-detail";
import { ReelDetail } from "@/components/replay/reports/reel-detail";
import { AdaptForm } from "@/components/replay/research/adapt-form";
import { ReelResearchTools } from "@/components/replay/research/reel-research-tools";
import { ResearchDetail } from "@/components/replay/research/research-detail";
import { creatorLabel } from "@/components/replay/shared/creator-identity";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { date } from "@/components/replay/shared/format";
import { WorkspacePage } from "@/components/replay/shared/workspace-page";
import { useWorkspaceNavigation } from "./use-workspace-navigation";
import { Notice } from "@/components/replay/shared/notice";
import { ViewSkeleton } from "@/components/replay/shared/view-skeleton";
import { ThemeControl } from "@/components/replay/shell/theme-control";
import { WorkspaceSidebar } from "@/components/replay/shell/workspace-sidebar";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { IdeaSession } from "@/lib/replay/idea-types";
import type { Account, Job } from "@/lib/replay/types";
import {
  ArrowRight,
  Clapperboard,
  FolderHeart,
  Layers2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState, type FormEvent } from "react";
import { useWorkspaceData } from "./use-workspace-data";

const Analytics = dynamic(() =>
  import("@/components/replay/analytics/analytics-view").then(
    (module) => module.Analytics,
  ),
);
const Connections = dynamic(() =>
  import("@/components/replay/connections/connections").then(
    (module) => module.Connections,
  ),
);
const Inspiration = dynamic(() =>
  import("@/components/replay/inspiration/inspiration-view").then(
    (module) => module.Inspiration,
  ),
);
const Gaps = dynamic(() =>
  import("@/components/replay/research/creative-gaps-view").then(
    (module) => module.Gaps,
  ),
);
const UsageView = dynamic(() =>
  import("@/components/replay/usage/usage-view").then(
    (module) => module.UsageView,
  ),
);
const IdeaChat = dynamic(
  () =>
    import("@/components/replay/ideas/idea-editor").then(
      (module) => module.IdeaChat,
    ),
  { ssr: false },
);

export function Workspace() {
  const { data, health, error, setError, busy, refresh, checkHealth, act } =
    useWorkspaceData();

  const navigation = useWorkspaceNavigation();
  const {
    view,
    accountId,
    reel: openReel,
    report: openComparison,
    research: researchId,
    idea: ideaId,
    source: initialSource,
    showReel,
    showComparison,
    showResearch,
    showIdea,
  } = navigation;
  const setView = (next: Parameters<typeof navigation.navigate>[0]) => {
    navigation.navigate(next);
  };
  const library = useLibraryState(data, view, accountId);
  const {
    selected,
    setSelected,
    setQuery,
    currentAccount,
    selectedReady,
    selectedBusy,
  } = library;
  const [handle, setHandle] = useState(""),
    [fetchLimit, setFetchLimit] = useState(25),
    [newRole, setNewRole] = useState("competitor");
  const addOpen = navigation.panel === "account",
    uploadOpen = navigation.panel === "upload",
    importOpen = navigation.panel === "import",
    linkOpen = navigation.panel === "link";
  const collectionIds =
    navigation.panel === "collection" ? navigation.panelIds : [];
  const adaptId = navigation.panel === "adapt" ? navigation.target : null;
  const collectionRequest =
    navigation.panel === "collect" && navigation.target
      ? { accountId: navigation.target, limit: navigation.limit }
      : null;
  const setAddOpen = (open: boolean) =>
    open ? navigation.openPanel("account") : navigation.closePanel();
  const setUploadOpen = (open: boolean) =>
    open ? navigation.openPanel("upload") : navigation.closePanel();
  const setImportOpen = (open: boolean) =>
    open ? navigation.openPanel("import") : navigation.closePanel();
  const setLinkOpen = (open: boolean) =>
    open ? navigation.openPanel("link") : navigation.closePanel();
  const setCollectionIds = (ids: string[]) =>
    ids.length
      ? navigation.openPanel("collection", { ids })
      : navigation.closePanel();
  const setAdaptId = (id: string | null) =>
    id
      ? navigation.openPanel("adapt", { target: id })
      : navigation.closePanel();
  const setCollectionRequest = (
    request: { accountId: string; limit: number } | null,
  ) =>
    request
      ? navigation.openPanel("collect", {
          target: request.accountId,
          limit: request.limit,
        })
      : navigation.closePanel();
  const hasPage = Boolean(
    addOpen ||
    uploadOpen ||
    importOpen ||
    linkOpen ||
    collectionIds.length ||
    adaptId ||
    collectionRequest ||
    openReel ||
    openComparison ||
    researchId ||
    ideaId,
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    void checkHealth(controller.signal);
    return () => controller.abort();
  }, [refresh, checkHealth, setError]);
  async function startIdea(
    sourceKind: "reel" | "research",
    sourceId: string,
    conceptIndex: number,
  ) {
    const result = await act<IdeaSession>({
      action: "idea-start",
      sourceKind,
      sourceId,
      conceptIndex,
    });
    if (result) showIdea(result.id);
  }
  async function saveConcept(
    sourceKind: "reel" | "research",
    sourceId: string,
    conceptIndex: number,
  ): Promise<boolean> {
    const session = await act<IdeaSession>({
      action: "idea-start",
      sourceKind,
      sourceId,
      conceptIndex,
    });
    if (session?.savedDraft) return true;
    if (session?.messages.length) {
      showIdea(session.id);
      return false;
    }
    return Boolean(
      session &&
      (await act({
        action: "idea-save",
        id: session.id,
        draft: session.draft,
        expectedUpdatedAt: session.updatedAt,
      })),
    );
  }
  function openResult(id: string) {
    if (data?.ideas?.some((idea) => idea.id === id)) showIdea(id);
    else if (data?.research.some((r) => r.id === id)) showResearch(id);
    else if (data?.reels.some((r) => r.id === id)) showReel(id);
    else showComparison(id);
  }
  function startAdapt(id: string) {
    setAdaptId(id);
  }
  function selectAccount(id: string) {
    navigation.navigate("library", id);
    setSelected(new Set());
    setQuery("");
  }
  const currentReel = data?.reels.find((r) => r.id === openReel),
    currentComparison = data?.comparisons.find((c) => c.id === openComparison);
  async function addAccount(event: FormEvent) {
    event.preventDefault();
    const account = await act<Account>({
      action: "account",
      handle,
      role: newRole,
    });
    if (!account) return;
    selectAccount(account.id);
    setAddOpen(false);
    setHandle("");
    if (data?.settings.hasApifyToken)
      await act({
        action: "collect",
        accountId: account.id,
        limit: fetchLimit,
      });
  }
  async function analyzeSelection(force = false, reelIds = [...selected]) {
    if (await act({ action: "analyze", reelIds, force }))
      setSelected(new Set());
  }
  async function retry(job: Job) {
    if (job.kind === "refine")
      await act({
        action: "idea-message",
        id: job.params.ideaSessionId,
        message: job.params.message,
        retryMessageId: job.params.messageId,
      });
    else if (job.kind === "collect")
      await act({
        action: "collect",
        accountId: job.accountId,
        limit: job.params.limit || 50,
      });
    else if (job.kind === "resolve")
      await act({ action: "resolve", reelId: job.reelIds[0] });
    else if (job.kind === "adapt")
      await act({
        action: "adapt",
        reelId: job.reelIds[0],
        topic: job.params.topic,
      });
    else if (job.kind === "gap")
      await act({
        action: "gap",
        ownIds: job.params.ownIds,
        competitorIds: job.reelIds.filter(
          (id) => !job.params.ownIds?.includes(id),
        ),
      });
    else if (job.kind === "compare")
      await act({ action: "compare", reelIds: job.reelIds });
    else
      await analyzeSelection(
        Boolean(job.params.force),
        job.reelIds.filter((id) => {
          const reel = data?.reels.find((r) => r.id === id);
          return reel && (reel.status === "failed" || !reel.analysis);
        }),
      );
  }
  return (
    <div className="replay-shell">
      <WorkspaceSidebar
        data={data}
        health={health}
        view={view}
        accountId={accountId}
        navigate={(next) => {
          setView(next);
          if (["inspiration", "analytics", "gaps"].includes(next))
            setSelected(new Set());
        }}
        selectAccount={selectAccount}
        addAccount={() => setAddOpen(true)}
      />

      <main className="replay-main">
        <header className="replay-topbar">
          <span>
            {
              {
                library: "Reel library",
                reports: "Reports",
                connections: "Connections",
                inspiration: "Inspiration",
                analytics: "Niche analytics",
                gaps: "Creative gaps",
                usage: "Usage & costs",
              }[view]
            }
          </span>
          <ThemeControl />
        </header>
        <div className="workspace-content">
          {error && (
            <Alert variant="destructive" className="error-banner">
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                <Button
                  variant="outline"
                  aria-label="Dismiss error"
                  className="icon-btn"
                  onClick={() => setError(null)}
                >
                  <X size={16} />
                </Button>
              </AlertAction>
            </Alert>
          )}
          {data && !hasPage && (
            <JobActivity
              mode="active"
              jobs={data.jobs}
              busy={busy}
              cancel={(id) => void act({ action: "cancel", jobId: id })}
              retry={(job) => void retry(job)}
              openReport={openResult}
              openReel={showReel}
              reels={data.reels}
            />
          )}
          {!hasPage &&
            (!data ? (
              <ViewSkeleton />
            ) : view === "connections" ? (
              <Connections
                settings={data.settings}
                health={health}
                save={act}
                checkHealth={checkHealth}
              />
            ) : view === "usage" ? (
              <UsageView revision={data.revision} />
            ) : view === "inspiration" ? (
              <Inspiration
                data={data}
                run={act}
                busy={busy}
                open={showReel}
                adapt={startAdapt}
                error={error}
                openIdea={showIdea}
              />
            ) : view === "analytics" ? (
              <Analytics data={data} open={showReel} />
            ) : view === "gaps" ? (
              <Gaps
                data={data}
                run={act}
                busy={busy}
                open={showReel}
                openReport={showResearch}
              />
            ) : (
              <LibraryView
                data={data}
                view={view}
                accountId={accountId}
                library={library}
                busy={busy}
                run={act}
                navigate={setView}
                onAddLink={() => setLinkOpen(true)}
                onUpload={() => setUploadOpen(true)}
                onAddAccount={() => setAddOpen(true)}
                onImport={() => setImportOpen(true)}
                onCollect={setCollectionRequest}
                openResearch={showResearch}
                openComparison={showComparison}
                openReel={showReel}
              />
            ))}
          {data && !hasPage && (
            <JobActivity
              mode="history"
              jobs={data.jobs}
              busy={busy}
              cancel={(id) => void act({ action: "cancel", jobId: id })}
              retry={(job) => void retry(job)}
              openReport={openResult}
              openReel={showReel}
              reels={data.reels}
            />
          )}
          {hasPage && !data && <ViewSkeleton />}
          <WorkspacePage
            open={addOpen}
            close={navigation.back}
            title="Add account"
            description="Enter a public Instagram account."
          >
            {error && <Notice danger>{error}</Notice>}
            <form onSubmit={addAccount} className="form-stack">
              <Label>
                Instagram account
                <Input
                  autoFocus
                  required
                  placeholder="@competitor or Instagram profile URL"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </Label>
              <Label>
                Role
                <NativeSelect
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                >
                  <option value="competitor">Competitor</option>
                  <option value="own">Your account</option>
                  <option value="inspiration">Inspiration</option>
                </NativeSelect>
              </Label>
              <Label>
                First collection
                <NativeSelect
                  value={fetchLimit}
                  onChange={(e) => setFetchLimit(Number(e.target.value))}
                >
                  {[25, 50, 100, 250, 500, 1000].map((limit) => (
                    <option key={limit} value={limit}>
                      Up to {limit} public Reels
                    </option>
                  ))}
                </NativeSelect>
              </Label>
              <Notice>
                {data?.settings.hasApifyToken
                  ? `Requests up to ${fetchLimit} Reels using Apify credits. Fewer may be returned; complete account coverage is not guaranteed. AI analysis starts after your selection.`
                  : "Add the account now, then connect Apify or import its JSON export to populate the library."}
              </Notice>
              <Button variant="default" className="btn primary" disabled={busy}>
                {busy ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <Plus size={15} />
                )}
                {data?.settings.hasApifyToken
                  ? "Add account & collect Reels"
                  : "Add account"}
              </Button>
            </form>
          </WorkspacePage>
          <WorkspacePage
            open={Boolean(collectionRequest)}
            close={navigation.back}
            title="Review collection"
            description="Collection uses Apify credits."
          >
            {collectionRequest && (
              <>
                <p>
                  Request up to <strong>{collectionRequest.limit} Reels</strong>{" "}
                  from @
                  {
                    data?.accounts.find(
                      (account) => account.id === collectionRequest.accountId,
                    )?.username
                  }
                  .
                </p>
                <Notice>
                  This fetch can revisit previously collected Reels and incur
                  additional charges. It is not limited to new posts. Apify may
                  return fewer than requested; account coverage is not
                  guaranteed.
                </Notice>
                <p className="field-note">
                  Exact charges depend on Apify’s current actor pricing and your
                  plan.{" "}
                  <a
                    href="https://apify.com/apify/instagram-reel-scraper/pricing"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View pricing
                  </a>
                </p>
                <div className="button-row">
                  <Button
                    variant="outline"
                    className="btn"
                    onClick={() => setCollectionRequest(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      void act({
                        action: "collect",
                        ...collectionRequest,
                      }).then((result) => {
                        if (result) setCollectionRequest(null);
                      })
                    }
                  >
                    Collect up to {collectionRequest.limit} Reels
                  </Button>
                </div>
              </>
            )}
          </WorkspacePage>
          <WorkspacePage
            open={importOpen}
            close={navigation.back}
            title="Import Reels"
            description={`Import an Apify JSON export for ${currentAccount ? `@${currentAccount.username}` : "an account"}.`}
          >
            {error && <Notice danger>{error}</Notice>}
            <ImportForm
              accountId={currentAccount?.id}
              busy={busy}
              run={act}
              done={() => setImportOpen(false)}
            />
          </WorkspacePage>
          <WorkspacePage
            open={uploadOpen}
            close={navigation.back}
            title="Upload video"
            description="Upload an MP4 or MOV under 150 MB and 10 minutes. Analysis runs only when you ask."
          >
            <UploadForm
              accountId={currentAccount?.id}
              done={async (id) => {
                await refresh();
                setUploadOpen(false);
                showReel(id);
              }}
            />
          </WorkspacePage>
          <WorkspacePage
            open={linkOpen}
            close={navigation.back}
            title="Add a video link"
            description="Research one public video without collecting an account."
          >
            <AddLink
              run={act}
              busy={busy}
              error={error}
              done={(id) => {
                setLinkOpen(false);
                showReel(id);
              }}
            />
          </WorkspacePage>
          <WorkspacePage
            open={collectionIds.length > 0}
            close={navigation.back}
            title="Add to collection"
          >
            {data && (
              <CollectionPicker
                data={data}
                ids={collectionIds}
                run={act}
                close={navigation.back}
                busy={busy}
                error={error}
              />
            )}
          </WorkspacePage>
          <WorkspacePage
            open={Boolean(adaptId)}
            close={navigation.back}
            title="Adapt this pattern"
            description="Three original concepts, grounded in one specific video."
          >
            {data?.reels.find((r) => r.id === adaptId) && (
              <AdaptForm
                key={adaptId}
                reel={data.reels.find((r) => r.id === adaptId)!}
                run={act}
                done={() => setAdaptId(null)}
                busy={busy}
                error={error}
                brief={data.settings.brief?.business}
              />
            )}
          </WorkspacePage>
          <WorkspacePage
            open={Boolean(researchId) && Boolean(data)}
            close={navigation.back}
            title={
              data?.research.find((r) => r.id === researchId)?.report.title ||
              "Creative research"
            }
            wide
          >
            {data?.research.find((r) => r.id === researchId) && (
              <ResearchDetail
                saved={data.research.find((r) => r.id === researchId)!}
                reels={data.reels}
                refineIdea={(index) =>
                  void startIdea("research", researchId!, index)
                }
                saveIdea={(index) =>
                  saveConcept("research", researchId!, index)
                }
                open={(id, source) => {
                  showReel(id, source);
                }}
              />
            )}
          </WorkspacePage>
          <WorkspacePage
            open={Boolean(openReel) && Boolean(data)}
            close={navigation.back}
            title={currentReel?.analysis?.title || "Reel details"}
            description={
              currentReel
                ? `${creatorLabel(
                    currentReel,
                    data?.accounts.find((a) => a.id === currentReel.accountId),
                  )} · ${date(currentReel.postedAt)}${currentReel.analysisProvider ? ` · ${currentReel.analysisProvider}` : ""}`
                : "Loading Reel…"
            }
            wide
          >
            {error && <Notice danger>{error}</Notice>}
            {currentReel?.source === "link" && (
              <div className="link-status">
                <p className="muted">
                  Saved {currentReel.platform} link ·{" "}
                  {currentReel.creatorName ||
                    "Creator details may be unavailable"}
                </p>
                <Button
                  variant="ghost"
                  className="text-link"
                  disabled={
                    busy ||
                    data?.jobs.some(
                      (j) => active(j) && j.reelIds.includes(currentReel.id),
                    )
                  }
                  onClick={() =>
                    void act({ action: "resolve", reelId: currentReel.id })
                  }
                >
                  Refresh public details
                </Button>
              </div>
            )}
            {currentReel ? (
              <ReelDetail
                initialSource={initialSource}
                key={`${currentReel.id}:${initialSource || ""}`}
                reel={currentReel}
                refineIdea={(index) =>
                  void startIdea("reel", currentReel.id, index)
                }
                saveIdea={(index) => saveConcept("reel", currentReel.id, index)}
                busy={
                  busy ||
                  Boolean(
                    data?.jobs.some(
                      (j) => active(j) && j.reelIds.includes(currentReel.id),
                    ),
                  )
                }
                analyze={(force) =>
                  void analyzeSelection(force, [currentReel.id])
                }
                refreshed={refresh}
                job={data?.jobs.find(
                  (j) => active(j) && j.reelIds.includes(currentReel.id),
                )}
              />
            ) : (
              <p className="muted">
                This Reel is not available in your library.
              </p>
            )}
            <Disclosure
              className="report-organization"
              title={<>Notes & organization</>}
            >
              {" "}
              {currentReel && (
                <ReelResearchTools
                  key={`notes:${currentReel.id}`}
                  reel={currentReel}
                  run={act}
                  busy={busy}
                  add={() => {
                    setCollectionIds([currentReel.id]);
                  }}
                  adapt={() => startAdapt(currentReel.id)}
                />
              )}
            </Disclosure>
          </WorkspacePage>
          <WorkspacePage
            open={Boolean(ideaId) && Boolean(data)}
            close={navigation.back}
            title="Your video draft"
            description="Write, rehearse and track your next video. Chat is optional."
            wide
          >
            {error && <Notice danger>{error}</Notice>}
            {data?.ideas?.find((idea) => idea.id === ideaId) &&
              (() => {
                const session = data.ideas!.find((idea) => idea.id === ideaId)!;
                return (
                  <IdeaChat
                    key={`${session.id}:${session.updatedAt}`}
                    session={session}
                    run={act}
                    busy={busy}
                    settings={data.settings}
                    job={data.jobs.find(
                      (job) =>
                        job.kind === "refine" &&
                        job.params.ideaSessionId === session.id,
                    )}
                    openSource={() => {
                      if (session.sourceKind === "reel")
                        showReel(session.sourceId);
                      else showResearch(session.sourceId);
                    }}
                  />
                );
              })()}
          </WorkspacePage>
          <WorkspacePage
            open={Boolean(openComparison) && Boolean(data)}
            close={navigation.back}
            title={currentComparison?.report.title || "Your comparison"}
            description={
              currentComparison
                ? `${currentComparison.reelIds.length} Reels · ${currentComparison.provider}`
                : "Loading…"
            }
            wide
          >
            {currentComparison && (
              <ComparisonDetail
                comparison={currentComparison}
                reels={data?.reels || []}
                open={(id, sourceId) => {
                  showReel(id, sourceId);
                }}
              />
            )}
          </WorkspacePage>
        </div>
        {!hasPage &&
          selected.size > 0 &&
          (view === "library" || view === "reports") && (
            <div className="selection-bar">
              <div>
                <span className="selection-count">{selected.size}</span>
                <strong>selected</strong>
                <Button
                  variant="ghost"
                  className="text-link"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
              </div>
              <div className="button-row">
                <Button
                  variant="outline"
                  className="btn"
                  onClick={() => setCollectionIds([...selected])}
                >
                  <FolderHeart size={15} />
                  Add to collection
                </Button>
                {selectedReady >= 2 && (
                  <Button
                    variant="outline"
                    className="btn"
                    disabled={
                      busy ||
                      selectedBusy ||
                      selectedReady < 2 ||
                      selectedReady !== selected.size
                    }
                    title="Compare at least two completed reports"
                    onClick={() =>
                      void act({
                        action: "compare",
                        reelIds: [...selected],
                      }).then((result) => {
                        if (result) setSelected(new Set());
                      })
                    }
                  >
                    <Layers2 size={15} />
                    Compare reports
                  </Button>
                )}
                <Button
                  variant="default"
                  className="btn primary"
                  disabled={
                    busy || selectedBusy || selectedReady === selected.size
                  }
                  onClick={() => void analyzeSelection()}
                >
                  <Clapperboard size={15} />
                  Analyze {selected.size - selectedReady}{" "}
                  {selected.size - selectedReady === 1 ? "Reel" : "Reels"}
                  <ArrowRight size={15} />
                </Button>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}

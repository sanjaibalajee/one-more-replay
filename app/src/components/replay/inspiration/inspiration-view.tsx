"use client";
import { Empty } from "@/components/ui/empty";
import { DraftLibrary } from "@/components/replay/ideas/draft-library";
import { IdeaCapture } from "@/components/replay/ideas/idea-capture";
/* eslint-disable @next/next/no-img-element -- Local frames and allowlisted proxy images. */
import { creator, ready } from "@/components/replay/research/helpers";
import { type Action } from "@/components/replay/shared/action";
import { CreatorIdentity } from "@/components/replay/shared/creator-identity";
import { download } from "@/components/replay/shared/download-json";
import { asset, image } from "@/components/replay/shared/media-url";
import { WorkspacePage } from "@/components/replay/shared/workspace-page";
import { Notice } from "@/components/replay/shared/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ctaFor, hookFor } from "@/lib/replay/research";
import {
  hookTypes,
  humanize,
  type Collection,
} from "@/lib/replay/research-types";
import type { Snapshot } from "@/lib/replay/types";
import {
  ArrowRight,
  Bookmark,
  Download,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export function Inspiration({
  data,
  run,
  busy,
  open,
  adapt,
  error,
  openIdea,
}: {
  data: Snapshot;
  run: Action;
  busy: boolean;
  open: (id: string) => void;
  adapt: (id: string) => void;
  error: string | null;
  openIdea?: (id: string) => void;
}) {
  const [collectionId, setCollectionId] = useState("ideas"),
    [query, setQuery] = useState(""),
    [hook, setHook] = useState("all"),
    [edit, setEdit] = useState<Collection | null>(null),
    [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [deleting, setDeleting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const current = data.collections.find((c) => c.id === collectionId),
    memberIds = new Set(data.collections.flatMap((c) => c.reelIds));
  const saved = data.reels.filter(
    (r) =>
      r.starred ||
      memberIds.has(r.id) ||
      r.annotation?.notes ||
      r.annotation?.tags.length ||
      Boolean(
        r.annotation &&
          (r.annotation.hookType !== "unknown" ||
            r.annotation.ctaType !== "unknown"),
      ),
  );
  const reels = (
    current ? data.reels.filter((r) => current.reelIds.includes(r.id)) : saved
  ).filter(
    (r) =>
      collectionId !== "ideas" &&
      (hook === "all" || hookFor(r) === hook) &&
      `${r.caption} ${r.analysis?.hook.label || ""} ${r.annotation?.notes || ""} ${r.annotation?.tags.join(" ") || ""} ${creator(r, data)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function editCollection(c: Collection | null) {
    setEdit(c);
    setCreate(true);
    setName(c?.name || "");
    setDescription(c?.description || "");
    setDeleting(false);
  }
  return (
    <>
      {!create && !capturing && (
        <>
          <div className="page-heading">
            <div>
              <h1>Inspiration</h1>
              <p>Keep useful references and turn your ideas into videos.</p>
            </div>
            <Button
              variant="default"
              className="btn primary"
              onClick={() => setCapturing(true)}
            >
              <Plus size={15} />
              New idea
            </Button>
          </div>
          <div className="collection-tabs" aria-label="Collections">
            <Button
              variant="ghost"
              className={collectionId === "ideas" ? "chosen" : ""}
              onClick={() => setCollectionId("ideas")}
            >
              My drafts{" "}
              <small>
                {(data.ideas || []).filter((idea) => idea.savedDraft).length}
              </small>
            </Button>
            <Button
              variant="ghost"
              className={collectionId === "saved" ? "chosen" : ""}
              onClick={() => setCollectionId("saved")}
            >
              Saved patterns <small>{saved.length}</small>
            </Button>
            {data.collections.map((c) => (
              <Button
                variant="ghost"
                key={c.id}
                className={collectionId === c.id ? "chosen" : ""}
                onClick={() => setCollectionId(c.id)}
              >
                {c.name}
                <small>{c.reelIds.length}</small>
              </Button>
            ))}
          </div>
          {current && (
            <div className="coverage-bar">
              <div>
                <strong>{current.name}</strong>
                <p>
                  {current.description ||
                    "Add a note about what you’re researching."}
                </p>
              </div>
              <div className="button-row">
                <Button
                  variant="outline"
                  className="btn small"
                  onClick={() => editCollection(current)}
                >
                  Edit collection
                </Button>
                <Button
                  variant="outline"
                  className="btn small"
                  onClick={() =>
                    download(
                      `one-more-replay-${current.name.replace(/[^a-z0-9]/gi, "-")}.json`,
                      {
                        collection: current,
                        videos: data.reels
                          .filter((r) => current.reelIds.includes(r.id))
                          .map((r) => ({
                            id: r.id,
                            url: r.url,
                            caption: r.caption,
                            notes: r.annotation,
                            hook: r.analysis?.hook,
                            analysis: r.analysis,
                          })),
                      },
                    )
                  }
                >
                  <Download size={13} />
                  Export
                </Button>
              </div>
            </div>
          )}
          <div className="research-filters">
            <Label>
              {collectionId === "ideas" ? "Search drafts" : "Search patterns"}
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  collectionId === "ideas"
                    ? "Titles, scripts or notes…"
                    : "Hooks, notes, tags or creators…"
                }
              />
            </Label>
            {collectionId !== "ideas" && (
              <Label>
                Hook type
                <NativeSelect
                  aria-label="Hook type"
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                >
                  <option value="all">All hooks</option>
                  {hookTypes.map((t) => (
                    <option key={t} value={t}>
                      {humanize(t)}
                    </option>
                  ))}
                </NativeSelect>
              </Label>
            )}
            {collectionId !== "ideas" && (
              <Button variant="outline" onClick={() => editCollection(null)}>
                <Plus size={14} />
                New collection
              </Button>
            )}
          </div>
          {collectionId === "ideas" && (
            <DraftLibrary
              ideas={data.ideas || []}
              query={query}
              open={openIdea}
            />
          )}
          {collectionId !== "ideas" && !reels.length && (
            <Empty className="empty-state">
              <Bookmark size={30} />
              <h2>
                {query || hook !== "all"
                  ? "No matching patterns"
                  : "Start a collection"}
              </h2>
              <p>
                Star videos or select them in the Reel library and choose Add to
                collection. Open a video to add notes and categories.
              </p>
            </Empty>
          )}
          <div className="pattern-grid">
            {reels.map((r) => {
              const src = r.evidence?.frames[0]
                ? asset(r.id, r.evidence.frames[0].file)
                : r.thumbnail
                  ? image(r.thumbnail)
                  : "";
              return (
                <article className="pattern-card" key={r.id}>
                  <Button
                    variant="ghost"
                    className="pattern-open"
                    onClick={() => open(r.id)}
                  >
                    {src && <img src={src} alt="" loading="lazy" />}
                    <span>
                      <CreatorIdentity
                        reel={r}
                        account={data.accounts.find(
                          (a) => a.id === r.accountId,
                        )}
                      />
                      <strong>
                        {r.analysis?.hook.label ||
                          r.caption.slice(0, 90) ||
                          "Unanalyzed video"}
                      </strong>
                      <span>
                        {r.analysis?.hook.spokenHook ||
                          r.caption.slice(0, 160) ||
                          "Open this video to add notes or analyze its opening."}
                      </span>
                    </span>
                  </Button>
                  <div className="pattern-meta">
                    <span>{humanize(hookFor(r))} hook</span>
                    <span>{humanize(ctaFor(r))} CTA</span>
                    {r.annotation?.tags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </div>
                  {r.annotation?.notes && (
                    <p className="pattern-notes">{r.annotation.notes}</p>
                  )}
                  <div className="button-row">
                    <Button
                      variant="outline"
                      className="btn small"
                      disabled={!ready(r) || busy}
                      onClick={() => adapt(r.id)}
                    >
                      <Sparkles size={13} />
                      Adapt pattern
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-link"
                      onClick={() => open(r.id)}
                    >
                      {ready(r) ? "Evidence & notes" : "Analyze & notes"}
                      <ArrowRight size={12} />
                    </Button>
                    {current && (
                      <Button
                        variant="outline"
                        aria-label={`Remove ${r.shortcode} from collection`}
                        className="icon-btn"
                        disabled={busy}
                        onClick={() =>
                          void run({
                            action: "collection-remove",
                            id: current.id,
                            reelIds: [r.id],
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      <WorkspacePage
        open={capturing}
        close={() => setCapturing(false)}
        title="New idea"
        description="Catch the thought now. Shape the script when you’re ready."
      >
        {error && <Notice danger>{error}</Notice>}
        {capturing && (
          <IdeaCapture
            run={run}
            busy={busy}
            created={(id) => {
              setCapturing(false);
              openIdea?.(id);
            }}
          />
        )}
      </WorkspacePage>
      <WorkspacePage
        open={create}
        close={() => setCreate(false)}
        title={edit ? "Edit collection" : "New collection"}
      >
        {error && <Notice danger>{error}</Notice>}
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run<Collection>({
              action: "collection",
              id: edit?.id,
              name,
              description,
            }).then((c) => {
              if (c) {
                setCollectionId(c.id);
                setCreate(false);
              }
            });
          }}
        >
          <Label>
            Collection name
            <Input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Label>
          <Label>
            Research note
            <Textarea
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Label>
          <Button variant="default" className="btn primary" disabled={busy}>
            Save collection
          </Button>
          {edit &&
            (deleting ? (
              <Notice>
                Delete this collection? Videos, notes and reports will be kept.
                <div className="button-row">
                  <Button
                    variant="outline"
                    type="button"
                    className="btn small"
                    disabled={busy}
                    onClick={() =>
                      void run({
                        action: "collection-delete",
                        id: edit.id,
                      }).then((r) => {
                        if (r) {
                          setCollectionId("saved");
                          setCreate(false);
                        }
                      })
                    }
                  >
                    Delete collection
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    className="btn small"
                    onClick={() => setDeleting(false)}
                  >
                    Keep it
                  </Button>
                </div>
              </Notice>
            ) : (
              <Button
                variant="ghost"
                type="button"
                className="text-link"
                onClick={() => setDeleting(true)}
              >
                Delete collection
              </Button>
            ))}
        </form>
      </WorkspacePage>
    </>
  );
}

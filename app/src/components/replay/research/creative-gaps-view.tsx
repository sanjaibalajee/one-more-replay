"use client";
import { ready } from "@/components/replay/research/helpers";
import { type Action } from "@/components/replay/shared/action";
import { CreatorIdentity } from "@/components/replay/shared/creator-identity";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { date } from "@/components/replay/shared/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { gapContext } from "@/lib/replay/research";
import {
  humanize,
  platformFor,
  platformLabel,
  roles,
} from "@/lib/replay/research-types";
import type { Snapshot } from "@/lib/replay/types";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export function Gaps({
  data,
  run,
  busy,
  open,
  openReport,
}: {
  data: Snapshot;
  run: Action;
  busy: boolean;
  open: (id: string) => void;
  openReport: (id: string) => void;
}) {
  const [ownIds, setOwn] = useState<string[]>([]),
    [peerIds, setPeers] = useState<string[]>([]);
  const accounts = data.accounts.filter(
      (a) => a.kind !== "inbox" && a.username !== "local_uploads",
    ),
    own = data.reels.filter(
      (r) => data.accounts.find((a) => a.id === r.accountId)?.role === "own",
    ),
    peers = data.reels.filter(
      (r) =>
        (data.accounts.find((a) => a.id === r.accountId)?.role ||
          "competitor") === "competitor" &&
        data.accounts.find((a) => a.id === r.accountId)?.kind !== "inbox",
    );
  const chosenOwn = own.filter((r) => ownIds.includes(r.id)),
    chosenPeers = peers.filter((r) => peerIds.includes(r.id)),
    context = gapContext(chosenOwn, chosenPeers),
    selected = chosenOwn.length + chosenPeers.length;
  function toggle(id: string, side: "own" | "peer") {
    const update = side === "own" ? setOwn : setPeers;
    update((prev) =>
      prev.includes(id)
        ? prev.filter((r) => r !== id)
        : selected < 10
          ? [...prev, id]
          : prev,
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Creative gaps</h1>
          <p>Compare your work with specific competitor examples.</p>
        </div>
      </div>
      <Disclosure
        className="role-settings"
        defaultOpen={!accounts.some((a) => a.role === "own")}
        title={<>Account roles</>}
      >
        <div className="role-list">
          {accounts.map((a) => (
            <Label key={a.id}>
              <span>@{a.username}</span>
              <NativeSelect
                aria-label={`Role for ${a.username}`}
                value={a.role || "competitor"}
                onChange={(e) =>
                  void run({
                    action: "role",
                    accountId: a.id,
                    role: e.target.value,
                  })
                }
                disabled={busy}
              >
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role === "own" ? "Your account" : humanize(role)}
                  </option>
                ))}
              </NativeSelect>
            </Label>
          ))}
        </div>
        {!accounts.length && (
          <p className="muted">
            Add your Instagram account and at least one competitor in the Reel
            library.
          </p>
        )}
      </Disclosure>
      <div className="gap-columns">
        {[
          {
            side: "own" as const,
            title: "Your examples",
            items: own,
            ids: ownIds,
          },
          {
            side: "peer" as const,
            title: "Competitor examples",
            items: peers,
            ids: peerIds,
          },
        ].map(({ side, title, items, ids }) => (
          <section key={side} className="research-section">
            <h2>{title}</h2>
            <p className="muted">
              Choose analyzed videos. {items.filter(ready).length} of{" "}
              {items.length} have evidence-linked reports.
            </p>
            <div className="gap-selection">
              {items.map((r) => (
                <div key={r.id}>
                  <Label>
                    <Checkbox
                      checked={ids.includes(r.id)}
                      disabled={
                        !ready(r) || (!ids.includes(r.id) && selected >= 10)
                      }
                      onCheckedChange={() => toggle(r.id, side)}
                    />
                    <span>
                      <CreatorIdentity
                        reel={r}
                        account={data.accounts.find(
                          (a) => a.id === r.accountId,
                        )}
                      />
                      <span>
                        {r.analysis?.title || r.caption.slice(0, 85) || "Video"}
                      </span>
                      <small>
                        {r.analysis?.format || "Format unknown"} ·{" "}
                        {r.evidence
                          ? `${Math.round(r.evidence.duration)}s`
                          : r.durationSeconds
                            ? `${Math.round(r.durationSeconds)}s`
                            : "Length unknown"}{" "}
                        · {platformLabel[platformFor(r)]}
                      </small>
                    </span>
                  </Label>
                  <Button
                    variant="ghost"
                    className="text-link"
                    onClick={() => open(r.id)}
                  >
                    {ready(r) ? "Evidence" : "Analyze first"}
                  </Button>
                </div>
              ))}
            </div>
            {!items.length && (
              <p className="research-empty">
                {side === "own"
                  ? "Mark an account as Your account above."
                  : "Mark a peer as Competitor above."}
              </p>
            )}
          </section>
        ))}
      </div>
      <div className="gap-review">
        <strong>
          {selected} / 10 videos selected · {context.matchedPairs} matched{" "}
          {context.matchedPairs === 1 ? "pair" : "pairs"}
        </strong>
        <p>
          Matched on platform, format and length within 1.5×. Topic and audience
          fit still need review. With no matched pairs, the report will offer
          exploratory tests and state that evidence is insufficient.
        </p>
        <Button
          variant="default"
          className="btn primary"
          disabled={busy || !chosenOwn.length || !chosenPeers.length}
          onClick={() =>
            void run({
              action: "gap",
              ownIds: chosenOwn.map((r) => r.id),
              competitorIds: chosenPeers.map((r) => r.id),
            }).then((r) => {
              if (r) {
                setOwn([]);
                setPeers([]);
              }
            })
          }
        >
          Find creative opportunities
          <ArrowRight size={15} />
        </Button>
        <p className="field-note">
          Uses your selected model and saved creator brief. No collection or new
          video analysis.
        </p>
      </div>
      {data.research.filter((r) => r.kind === "gap").length > 0 && (
        <section className="research-section">
          <h2>Saved gap reports</h2>
          {data.research
            .filter((r) => r.kind === "gap")
            .map((r) => (
              <Button
                variant="ghost"
                key={r.id}
                className="comparison-preview"
                onClick={() => openReport(r.id)}
              >
                <div>
                  <span className="eyebrow">
                    {date(r.createdAt)} · {r.reelIds.length} videos
                  </span>
                  <h3>{r.report.title}</h3>
                </div>
                <ArrowRight size={17} />
              </Button>
            ))}
        </section>
      )}
    </>
  );
}

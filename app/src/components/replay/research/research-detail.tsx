"use client";
import { Concept } from "@/components/replay/reports/concept-card";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { DownloadLinks } from "@/components/replay/shared/download-links";
import { clock, date } from "@/components/replay/shared/format";
import { Notice } from "@/components/replay/shared/notice";
import { UsageReceipt } from "@/components/replay/usage/usage-receipt";
import { Button } from "@/components/ui/button";
import { humanize, type ResearchReport } from "@/lib/replay/research-types";
import type { Reel } from "@/lib/replay/types";

export function ResearchDetail({
  saved,
  reels,
  open,
  refineIdea,
  saveIdea,
}: {
  saved: ResearchReport;
  reels: Reel[];
  open: (id: string, source?: string) => void;
  refineIdea?: (index: number) => void;
  saveIdea?: (index: number) => Promise<boolean>;
}) {
  const stale = saved.reelIds.some(
    (id) =>
      reels.find((r) => r.id === id)?.analyzedAt !== saved.reportVersions[id],
  );
  function refs(reelId: string, ids: string[]) {
    return (
      <div className="research-citations">
        {ids.map((id) => {
          const source = saved.sourcesByReel[reelId]?.find((s) => s.id === id);
          return (
            <Button
              variant="ghost"
              className="source-chip"
              key={id}
              onClick={() =>
                open(
                  reelId,
                  reels.find((reel) => reel.id === reelId)?.analyzedAt ===
                    saved.reportVersions[reelId]
                    ? id
                    : undefined,
                )
              }
              title={
                reels.find((reel) => reel.id === reelId)?.analyzedAt ===
                saved.reportVersions[reelId]
                  ? source?.text
                  : "Original excerpt below; open the current report without jumping to a changed source."
              }
            >
              <strong>
                {id}
                {source?.seconds != null ? ` · ${clock(source.seconds)}` : ""}
              </strong>
              <span>{source?.text || "Source unavailable"}</span>
            </Button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="report-prose research-report">
      <div className="button-row">
        <DownloadLinks id={saved.id} research />
        <small>
          {saved.provider} · {date(saved.createdAt)}
        </small>
      </div>
      <UsageReceipt usage={saved.usage} />
      {stale && (
        <Notice>
          Some videos have been re-analyzed. The evidence text below is the
          saved report’s original snapshot; opening a video shows its current
          analysis.
        </Notice>
      )}
      <Disclosure
        className="brief-snapshot"
        title={<>Creator brief used for this report</>}
      >
        <dl>
          {Object.entries(JSON.parse(saved.brief) as Record<string, unknown>)
            .filter(([, value]) => value)
            .map(([key, value]) => (
              <div key={key}>
                <dt>{humanize(key)}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
        </dl>
      </Disclosure>
      {saved.kind === "adapt" ? (
        <>
          <p className="report-summary">{saved.report.mechanism}</p>
          {refs(saved.reelIds[0], saved.report.evidenceIds)}
          {saved.report.assumptions.length > 0 && (
            <Notice>{saved.report.assumptions.join(" ")}</Notice>
          )}
          {saved.report.concepts.map((idea, i) => (
            <Concept
              key={i}
              idea={idea}
              index={i}
              citations={refs(saved.reelIds[0], idea.evidenceIds)}
              refine={refineIdea ? () => refineIdea(i) : undefined}
              save={saveIdea ? () => saveIdea(i) : undefined}
            />
          ))}
        </>
      ) : (
        <>
          <p className="report-summary">{saved.report.summary}</p>
          <Notice>
            {saved.context.matchedPairs} matched pairs across{" "}
            {saved.context.ownCount} own and {saved.context.competitorCount}{" "}
            competitor examples. Findings describe this selection only.
          </Notice>
          {saved.report.gaps.length === 0 && (
            <p className="research-empty">
              No supported creative gap was established in this selection.
            </p>
          )}
          {saved.report.gaps.map((gap, i) => (
            <section className="research-section" key={i}>
              <h2>{gap.title}</h2>
              <small>{gap.confidence} confidence</small>
              <p>{gap.observation}</p>
              <p>
                <strong>Try:</strong> {gap.opportunity}
              </p>
              <h4>Your example</h4>
              {refs(gap.own.reelId, gap.own.evidenceIds)}
              <h4>Competitor example</h4>
              {refs(gap.competitor.reelId, gap.competitor.evidenceIds)}
            </section>
          ))}
          <Disclosure
            className="brief-snapshot"
            title={<>Why these examples match</>}
          >
            {saved.context.pairs.map((p, i) => (
              <p key={i}>
                <Button
                  variant="ghost"
                  className="text-link"
                  onClick={() => open(p.ownId)}
                >
                  Your example
                </Button>{" "}
                ↔{" "}
                <Button
                  variant="ghost"
                  className="text-link"
                  onClick={() => open(p.competitorId)}
                >
                  Competitor example
                </Button>
                :{" "}
                {p.matched
                  ? "Same platform, format and similar length."
                  : p.reasons.join(" ")}
              </p>
            ))}
            {saved.context.limitations.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </Disclosure>
          {saved.report.experiments.map((e, i) => (
            <Concept
              key={i}
              idea={e.concept}
              index={i}
              citations={refs(e.source.reelId, e.source.evidenceIds)}
              refine={refineIdea ? () => refineIdea(i) : undefined}
              save={saveIdea ? () => saveIdea(i) : undefined}
            />
          ))}
        </>
      )}
      <section className="research-section">
        <h2>Limits of this report</h2>
        <ul>
          {saved.report.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

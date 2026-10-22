"use client";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { clock } from "@/components/replay/shared/format";
import { Button } from "@/components/ui/button";
import type { EvidenceSource } from "@/lib/replay/evidence";
import type { Analysis } from "@/lib/replay/types";
import { ArrowRight } from "lucide-react";
import { TechniqueNotes } from "./craft/technique-notes";

export function StoryStructure({
  analysis: a,
  sources,
  proof,
  seek,
}: {
  analysis: Analysis;
  sources: EvidenceSource[];
  proof: (ids?: string[]) => React.ReactNode;
  seek: (seconds: number) => void;
}) {
  const structure = a.storyStructure;
  const bodyFallback = a.beats.map((b) => b.whatHappens).join(" ");
  const hookSource = sources.find(
    (s) => a.hook.evidenceIds?.includes(s.id) && s.seconds !== null,
  );
  return (
    <section
      className="source-structure"
      aria-label="Observed hook, body and CTA"
    >
      <h3>How this Reel is built</h3>
      <section className="source-part">
        <span className="part-label">Hook</span>
        <Button
          variant="ghost"
          className="hook-link"
          onClick={() =>
            seek(hookSource?.seconds ?? structure?.hook.startSeconds ?? 0)
          }
        >
          {a.hook.label}
          <span>
            Watch opening <ArrowRight size={13} />
          </span>
        </Button>
        {a.hook.spokenHook && <blockquote>{a.hook.spokenHook}</blockquote>}
        <p>{structure?.hook.summary || a.hook.explanation}</p>
        {proof(a.hook.evidenceIds)}
        <Disclosure className="inline-notes" title={<>Visuals and wording</>}>
          <p>{a.hook.visualHook}</p>
          <p>{a.hook.explanation}</p>
        </Disclosure>
      </section>
      <section className="source-part">
        <div className="part-heading">
          <span className="part-label">Body</span>
          {structure?.body.startSeconds != null && (
            <Button
              variant="ghost"
              className="timestamp"
              onClick={() => seek(structure.body.startSeconds!)}
            >
              {clock(structure.body.startSeconds)}–
              {clock(structure.body.endSeconds!)}
            </Button>
          )}
        </div>
        <p>{structure?.body.summary || bodyFallback || a.payoff}</p>
        {proof(
          structure?.body.evidenceIds || [
            ...new Set(a.beats.flatMap((b) => b.evidenceIds || [])),
          ],
        )}
      </section>
      <section className="source-part">
        <div className="part-heading">
          <span className="part-label">CTA</span>
          {structure?.cta.status === "observed" &&
          structure.cta.startSeconds != null ? (
            <Button
              variant="ghost"
              className="timestamp"
              onClick={() => seek(structure.cta.startSeconds!)}
            >
              {clock(structure.cta.startSeconds)}
            </Button>
          ) : (
            structure?.cta.status && (
              <span className="muted">
                {structure.cta.status === "not-visible"
                  ? "Not visible in sampled evidence"
                  : "Unclear from the evidence"}
              </span>
            )
          )}
        </div>
        <p>{structure?.cta.summary || a.cta}</p>
        {proof(structure?.cta.evidenceIds || a.support?.cta)}
      </section>
      <TechniqueNotes notes={a.craft} proof={proof} />
    </section>
  );
}

"use client";

import { Disclosure } from "@/components/replay/shared/disclosure";
import { clock } from "@/components/replay/shared/format";
import type { ReactNode } from "react";
import type { Idea } from "./concept-card";

export function ConceptProduction({
  idea,
  citations,
}: {
  idea: Idea;
  citations?: ReactNode;
}) {
  return (
    <Disclosure
      className="production-details"
      title={
        <>
          Shot list & production
          {idea.shotList?.length ? (
            <small>{idea.shotList.length} shots</small>
          ) : null}
        </>
      }
    >
      {!!idea.shotList?.length && (
        <div className="shot-list">
          {idea.shotList.map((shot, i) => (
            <div className="shot" key={i}>
              <div className="shot-time">
                {clock(shot.startSeconds)}–{clock(shot.endSeconds)}
                {shot.section && (
                  <small>{shot.section === "cta" ? "CTA" : shot.section}</small>
                )}
              </div>
              <div>
                <h5>{shot.visual}</h5>
                {shot.spokenLine && (
                  <p>
                    <span className="shot-field">Say</span>
                    {shot.spokenLine}
                  </p>
                )}
                {shot.onScreenText && (
                  <p>
                    <span className="shot-field">On screen</span>
                    {shot.onScreenText}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <dl className="concept-notes">
        {[
          ["Audience", idea.audienceFit],
          ["Source pattern", idea.rationale],
          ["What changes", idea.whyDifferent],
          ["Production approach", idea.structure],
          ["You will need", idea.resources?.join(", ")],
          ["Change one thing", idea.experiment],
          ["How to check", idea.successMeasure],
        ].map(
          ([label, text]) =>
            text && (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{text}</dd>
              </div>
            ),
        )}
      </dl>
      {citations}
    </Disclosure>
  );
}

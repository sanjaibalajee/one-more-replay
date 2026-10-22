"use client";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { Button } from "@/components/ui/button";
import { ReportSection } from "./report-section";
import type { Analysis } from "@/lib/replay/types";
import type { ReactNode } from "react";
import styles from "./report-overview.module.css";

export function ReportOverview({
  analysis: a,
  proof,
  ideas,
}: {
  analysis: Analysis;
  proof: (ids?: string[]) => ReactNode;
  ideas: () => void;
}) {
  const keep =
    a.editorial?.keep ||
    a.findings?.find((f) => f.kind === "distinctive" || f.kind === "strength");
  const changes = a.editorial?.changes || [];
  const renderChange = (change: (typeof changes)[number], i: number) => (
    <div className="editorial-change" key={i}>
      <span className="edit-number">{i + 1}</span>
      <div>
        <h4>{change.action}</h4>
        <p>{change.reason}</p>
        <blockquote>
          <span>Try this</span>
          {change.example}
        </blockquote>
        {proof(change.evidenceIds)}
      </div>
    </div>
  );
  const concern = a.findings?.find(
    (f) => f.kind === "weakness" || f.kind === "uncertainty",
  );
  return (
    <>
      <p className="report-summary">{a.editorial?.verdict || a.summary}</p>
      {proof(a.editorial?.evidenceIds || a.support?.summary)}
      {keep && (
        <section className={styles.keep}>
          <span className="eyebrow">Keep this</span>
          <p>{keep.detail}</p>
          {proof(keep.evidenceIds)}
        </section>
      )}
      {!!changes.length ? (
        <ReportSection title="Change this first">
          <p className="section-note">An editorial recommendation to test.</p>
          {renderChange(changes[0], 0)}
          {changes.length > 1 && (
            <Disclosure
              title={
                <>
                  {changes.length - 1} more{" "}
                  {changes.length === 2 ? "suggestion" : "suggestions"}
                </>
              }
            >
              {changes.slice(1).map((change, i) => renderChange(change, i + 1))}
            </Disclosure>
          )}
        </ReportSection>
      ) : (
        concern && (
          <ReportSection title="Worth a second look">
            <h4>{concern.title}</h4>
            <p>{concern.detail}</p>
            {proof(concern.evidenceIds)}
          </ReportSection>
        )
      )}
      {a.editorial?.nextTest && (
        <ReportSection title="One test to try">
          <div className={styles.test}>
            <p>{a.editorial.nextTest.change}</p>
            <dl>
              <dt>Keep constant</dt>
              <dd>{a.editorial.nextTest.keepConstant}</dd>
              <dt>Look for</dt>
              <dd>{a.editorial.nextTest.measure}</dd>
            </dl>
            {proof(a.editorial.nextTest.evidenceIds)}
          </div>
        </ReportSection>
      )}
      <div className={styles.next}>
        <div>
          <h3>Make it your own</h3>
          <p>Three filming ideas built from this Reel’s strongest details.</p>
        </div>
        <Button onClick={ideas}>Explore ideas</Button>
      </div>
    </>
  );
}

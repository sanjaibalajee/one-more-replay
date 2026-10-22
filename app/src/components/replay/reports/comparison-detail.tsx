"use client";
import { EvidenceLinks } from "@/components/replay/reports/evidence-links";
import { ReportSection } from "@/components/replay/reports/report-section";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { DownloadLinks } from "@/components/replay/shared/download-links";
import { clock } from "@/components/replay/shared/format";
import { Notice } from "@/components/replay/shared/notice";
import { UsageReceipt } from "@/components/replay/usage/usage-receipt";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Reel, SavedComparison } from "@/lib/replay/types";
import { ArrowRight } from "lucide-react";

export function ComparisonDetail({
  comparison,
  reels,
  open,
}: {
  comparison: SavedComparison;
  reels: Reel[];
  open: (id: string, sourceId?: string) => void;
}) {
  const r = comparison.report,
    context = comparison.context;
  return (
    <div className="comparison-detail report-prose">
      <DownloadLinks id={comparison.id} comparison />
      <UsageReceipt usage={comparison.usage} />
      <p className="report-summary">{r.summary}</p>
      {context ? (
        <ReportSection title="How comparable are these Reels?">
          <Notice>
            {context.quality === "weak"
              ? "Weak performance comparison"
              : "Matched creative context; causal conclusions remain uncertain"}
          </Notice>
          <ul>
            {context.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <div className="comparison-table-wrap">
            <Table className="comparison-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Reel</TableHead>
                  <TableHead>Length</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Age at collection</TableHead>
                  <TableHead>Vs. account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {context.rows.map((row) => (
                  <TableRow key={row.reelId}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        className="text-link"
                        onClick={() => open(row.reelId)}
                      >
                        {reels.find((reel) => reel.id === row.reelId)?.analysis
                          ?.title || row.reelId}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {row.durationSeconds !== null
                        ? `${row.durationSeconds.toFixed(1)}s`
                        : "Unknown"}
                    </TableCell>
                    <TableCell>
                      {row.format?.replaceAll("-", " ") || "Unknown"}
                    </TableCell>
                    <TableCell>
                      {row.ageDays !== null
                        ? `${Math.floor(row.ageDays)} days`
                        : "Unknown"}
                    </TableCell>
                    <TableCell>
                      {row.multiple !== null
                        ? `${row.multiple.toFixed(1)}× · ${row.sampleSize} peers`
                        : "Insufficient data"}
                      <small>
                        {row.cohort === "similar"
                          ? "Matched cohort"
                          : "Broad / unavailable baseline"}
                      </small>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Disclosure title={<>Pair-by-pair comparison limits</>}>
            {context.pairs.map((pair, i) => (
              <p key={i}>
                <strong>
                  Reels {comparison.reelIds.indexOf(pair.leftId) + 1} and{" "}
                  {comparison.reelIds.indexOf(pair.rightId) + 1}:
                </strong>{" "}
                {pair.comparable
                  ? "Similar format, length and age at collection."
                  : pair.reasons.join(" ")}
              </p>
            ))}
          </Disclosure>
        </ReportSection>
      ) : (
        <Notice>
          This older comparison has no saved comparability table. Create a new
          comparison to check format, length and age.
        </Notice>
      )}
      <ReportSection title="Shared patterns">
        {r.patterns.length ? (
          r.patterns.map((pattern, i) => (
            <div className="hypothesis" key={i}>
              <h4>{pattern.pattern}</h4>
              <p>{pattern.evidence}</p>
              <div className="button-row">
                {pattern.reelIds.map((id) => (
                  <Button
                    variant="outline"
                    key={id}
                    className="btn small"
                    onClick={() => open(id)}
                  >
                    {reels
                      .find((reel) => reel.id === id)
                      ?.analysis?.title.slice(0, 45) || "Open example"}
                    <ArrowRight size={12} />
                  </Button>
                ))}
              </div>
              {pattern.examples?.map((example, j) => {
                const reel = reels.find((reel) => reel.id === example.reelId),
                  savedSources =
                    comparison.sourcesByReel?.[example.reelId] ||
                    reel?.analysis?.sources ||
                    [];
                const changed =
                  comparison.reportVersions &&
                  comparison.reportVersions[example.reelId] !==
                    reel?.analyzedAt;
                return (
                  <div key={j} className="comparison-evidence">
                    <small>{reel?.analysis?.title || "Example"}</small>
                    {changed ? (
                      <>
                        <p>
                          This Reel’s report changed after the comparison.
                          Original evidence:
                        </p>
                        {savedSources
                          .filter((source) =>
                            example.evidenceIds.includes(source.id),
                          )
                          .map((source) => (
                            <p key={source.id}>
                              {source.label}
                              {source.seconds !== null
                                ? ` · ${clock(source.seconds)}`
                                : ""}
                              : {source.text}
                            </p>
                          ))}
                      </>
                    ) : (
                      <EvidenceLinks
                        ids={example.evidenceIds}
                        sources={savedSources}
                        select={(source) => open(example.reelId, source.id)}
                      />
                    )}
                  </div>
                );
              })}
              <p>
                <strong>Try:</strong> {pattern.howToAdapt}
              </p>
            </div>
          ))
        ) : (
          <p>No recurring mechanism is supported by this selection.</p>
        )}
      </ReportSection>
      <ReportSection title="Differences">
        <ul>
          {r.differences.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </ReportSection>
      <ReportSection title="Next experiments">
        <ul>
          {r.nextExperiments.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </ReportSection>
      <Disclosure
        className="limitations"
        title={<>Limits of this comparison</>}
      >
        <ul>
          {r.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}

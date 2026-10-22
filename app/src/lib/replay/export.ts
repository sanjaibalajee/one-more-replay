import type { Reel, SavedComparison } from "./types";
import { sourcesFor } from "./evidence";
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export function reelMarkdown(reel: Reel): string {
  const a = reel.analysis; if (!a) throw new Error("This Reel has no completed report.");
  const sources = sourcesFor(reel);
  const transcript = a.sources
    ? sources.filter(source => source.kind === "transcript").map(source => `[${time(source.seconds || 0)}] ${source.text}`)
    : reel.evidence?.transcript.segments.map(segment => `[${time(segment.start)}] ${segment.text}`) || [];
  const cite = (ids?: string[]) => ids?.length ? `Evidence: ${ids.map(id => { const source = sources.find(s => s.id === id); return source ? `${id}${source.seconds !== null ? ` [${time(source.seconds)}]` : ""}: ${source.text}` : id; }).join("; ")}` : "";
  return [`# ${a.title}`, a.summary, `Source: ${reel.url || "Local upload"}`, `Analyzed: ${reel.analyzedAt} · ${reel.analysisProvider}`,
    ...(a.editorial ? ["## Editorial verdict", a.editorial.verdict, cite(a.editorial.evidenceIds), "## Recommended edits", ...a.editorial.changes.map((change,i) => `### ${i+1}. ${change.action}\n${change.reason}\n\nProposed edit: ${change.example}\n\n${cite(change.evidenceIds)}`)] : []),
    ...(a.editorial?.keep ? ["## Keep this", a.editorial.keep.detail, cite(a.editorial.keep.evidenceIds)] : []),
    ...(a.editorial?.nextTest ? ["## One test to try", a.editorial.nextTest.change, `Keep constant: ${a.editorial.nextTest.keepConstant}`, `Measure: ${a.editorial.nextTest.measure}`, cite(a.editorial.nextTest.evidenceIds)] : []),
    ...(a.findings?.length ? ["## Distinctive details and critical findings", ...a.findings.map(f => `### ${f.title} (${f.kind})\n${f.detail}\n\n${cite(f.evidenceIds)}`)] : []),
    "## Opening hook", `**${a.hook.label}**`, `Spoken: ${a.hook.spokenHook}`, `Visual: ${a.hook.visualHook}`, a.hook.explanation, cite(a.hook.evidenceIds),
    "## Story beats", ...a.beats.map(b => `- ${time(b.startSeconds)}–${time(b.endSeconds)}: ${b.whatHappens} — ${b.purpose}`),
    "## Observed evidence", ...a.observations.map(o => `- ${time(o.timestampSeconds)} [${o.category}]: ${o.detail}`),
    "## Possible performance drivers", ...a.hypotheses.map(h => `- **${h.driver}** (${h.confidence} confidence): ${h.evidence}\n\n${cite(h.evidenceIds)}`),
    "## Pacing", a.pacing, "## Payoff", a.payoff, "## Call to action", a.cta,
    "## Transferable patterns", ...a.transferablePatterns.map(p => `- ${p}`),
    "## Ideas to try", ...a.suggestedAngles.map(s => [`### ${s.idea}`, `Hook: ${s.opening}`, s.body && `Body: ${s.body}`, s.cta && `CTA: ${s.cta}`, s.structure, s.audienceFit && `Audience: ${s.audienceFit}`, s.rationale && `Rationale: ${s.rationale}`, cite(s.evidenceIds), s.whyDifferent && `What changes: ${s.whyDifferent}`, ...(s.shotList?.map(shot => `- ${time(shot.startSeconds)}–${time(shot.endSeconds)}: ${shot.visual}\n  Say: ${shot.spokenLine}\n  On screen: ${shot.onScreenText}`) || []), s.resources && `Resources: ${s.resources.join(", ")}`, s.experiment && `Test: ${s.experiment}`, s.successMeasure && `Measure: ${s.successMeasure}`].filter(Boolean).join("\n\n")),
    "## Evidence index", ...sources.map(source => `- ${source.id}${source.seconds !== null ? ` [${time(source.seconds)}]` : ""}: ${source.text}`),
    "## Transcript used for this report", ...(transcript.length ? transcript : ["No transcribed speech was supplied."]),
    "## Limits of this analysis", ...[...a.limitations, ...(reel.evidence?.warnings || [])].map(l => `- ${l}`),
  ].join("\n\n");
}
export function comparisonMarkdown(comparison: SavedComparison): string {
  const r = comparison.report;
  return [`# ${r.title}`, r.summary, `Created: ${comparison.createdAt} · ${comparison.provider}`,
    ...(comparison.context ? ["## Comparability", `Quality: ${comparison.context.quality}`, ...comparison.context.reasons.map(reason => `- ${reason}`), ...comparison.context.rows.map(row => `- ${row.reelId}: ${row.durationSeconds ?? "unknown"} seconds, format ${row.format ?? "unknown"}, age at collection ${row.ageDays ?? "unknown"} days, ${row.multiple ?? "unknown"}× baseline (${row.cohort}, ${row.sampleSize} peers)`)] : []),
    "## Repeated patterns", ...r.patterns.map(p => `### ${p.pattern}\n${p.evidence}\n\nExamples: ${p.reelIds.join(", ")}\n\nAdaptation: ${p.howToAdapt}`),
    "## Differences", ...r.differences.map(d => `- ${d}`), "## Next experiments", ...r.nextExperiments.map(e => `- ${e}`),
    "## Limitations", ...r.limitations.map(l => `- ${l}`)].join("\n\n");
}

export function researchMarkdown(saved: import("./research-types").ResearchReport): string {
  const cite = (reelId:string,ids:string[]) => `Source ${reelId}: ${ids.map(id=>{const source=saved.sourcesByReel[reelId]?.find(s=>s.id===id);return `${id}${source?.seconds!=null ? ` [${time(source.seconds)}]` : ""}: ${source?.text || "Unavailable"}`;}).join("; ")}`;
  const idea = (concept: import("zod").z.infer<typeof import("./types").ideaSchema>,i:number,reelId:string) => [
    `## Concept ${i+1}: ${concept.idea}`,`Hook: ${concept.opening}`,`Body: ${concept.body || concept.structure}`,`CTA: ${concept.cta || "No separate CTA was saved in this older report."}`,`Format: ${concept.format} · ${concept.durationSeconds}s`,
    `Audience: ${concept.audienceFit}`,`Rationale: ${concept.rationale}`,`Structure: ${concept.structure}`,`What changes: ${concept.whyDifferent}`,cite(reelId,concept.evidenceIds),
    "### Shot list",...concept.shotList.map(s=>`- ${time(s.startSeconds)}–${time(s.endSeconds)}: ${s.visual}\n  Say: ${s.spokenLine}\n  On screen: ${s.onScreenText}`),
    `Resources: ${concept.resources.join(", ")}`,`Test: ${concept.experiment}`,`Measure: ${concept.successMeasure}`,
  ].join("\n\n");
  return [`# ${saved.report.title}`,`Created: ${saved.createdAt} · ${saved.provider}`,"## Creator brief",...Object.entries(JSON.parse(saved.brief) as Record<string,unknown>).filter(([,value])=>value).map(([key,value])=>`- ${key}: ${String(value)}`),
    ...(saved.kind==="adapt" ? ["## Source mechanism",saved.report.mechanism,cite(saved.reelIds[0],saved.report.evidenceIds),...saved.report.assumptions.map(a=>`Assumption: ${a}`),...saved.report.concepts.map((c,i)=>idea(c,i,saved.reelIds[0]))] : [
      "## Creative opportunities",saved.report.summary,`Matched pairs: ${saved.context.matchedPairs}. ${saved.context.ownCount} own and ${saved.context.competitorCount} competitor examples.`,
      ...saved.context.limitations.map(l=>`- ${l}`),...saved.report.gaps.map(g=>`### ${g.title} (${g.confidence} confidence)\n\n${g.observation}\n\nTry: ${g.opportunity}\n\nYour example — ${cite(g.own.reelId,g.own.evidenceIds)}\n\nCompetitor example — ${cite(g.competitor.reelId,g.competitor.evidenceIds)}`),
      ...saved.report.experiments.map((e,i)=>idea(e.concept,i,e.source.reelId)),
    ]),"## Evidence index",...Object.entries(saved.sourcesByReel).flatMap(([id,sources])=>sources.map(source=>`- ${cite(id,[source.id])}`)),
    "## Limitations",...saved.report.limitations.map(l=>`- ${l}`),
  ].join("\n\n");
}

import { validateConcept } from "./concepts";
import type { Analysis, AnalysisV2, MediaEvidence, Reel } from "./types";
export interface EvidenceSource { id: string; kind: "frame" | "transcript" | "metric" | "metadata"; label: string; seconds: number | null; text: string; file?: string }
export function evidenceSources(reel: Reel, evidence: MediaEvidence): EvidenceSource[] {
  const sources: EvidenceSource[] = evidence.frames.map((frame, index) => ({ id: `F${index + 1}`, kind: "frame", label: `Frame ${index + 1}`, seconds: frame.seconds, text: `Sampled image at ${frame.seconds}s`, file: frame.file }));
  evidence.transcript.segments.forEach((segment, index) => sources.push({ id: `T${index + 1}`, kind: "transcript", label: "Transcript", seconds: segment.start, text: segment.text }));
  for (const key of ["views", "likes", "comments"] as const) if (reel[key] !== null) sources.push({ id: `M_${key}`, kind: "metric", label: key, seconds: null, text: `${reel[key]} ${key} recorded at ${reel.collectedAt}` });
  if (reel.performance?.multiple !== null && reel.performance?.multiple !== undefined) sources.push({ id: "M_baseline", kind: "metric", label: "Account baseline", seconds: null, text: `${reel.performance.multiple.toFixed(2)}× median of ${reel.performance.sampleSize} peers (${reel.performance.medianViews} views). ${reel.performance.note}` });
  sources.push({ id: "D_duration", kind: "metadata", label: "Duration", seconds: null, text: `${evidence.duration.toFixed(2)} seconds` });
  if (reel.postedAt) sources.push({ id: "D_posted", kind: "metadata", label: "Post date", seconds: null, text: `Published ${reel.postedAt}; metrics collected ${reel.collectedAt}` });
  if (reel.caption) sources.push({ id: "D_caption", kind: "metadata", label: "Caption", seconds: null, text: reel.caption });
  return sources;
}
export function validateAnalysis(report: AnalysisV2, evidence: MediaEvidence, sources: EvidenceSource[]): void {
  const allowed = new Set(sources.map(source => source.id));
  const check = (ids: string[]) => { if (!ids.length || ids.some(id => !allowed.has(id))) throw new Error("The report referenced evidence that was not supplied. Retry analysis."); };
  check(report.hook.evidenceIds);
  check(report.editorial.evidenceIds);
  for (const change of report.editorial.changes) check(change.evidenceIds);
  const spoken=report.hook.spokenHook.trim();
  const normalize=(text:string)=>text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
  const unavailable=/^(?:unavailable|not available|not supplied|no (?:clear |spoken |transcribed )?speech|no spoken hook|no words)[.!]?$/i.test(spoken);
  if(spoken && !unavailable && !normalize(evidence.transcript.text).includes(normalize(spoken))) throw new Error("The spoken hook is not an exact excerpt from the supplied transcript. Retry analysis.");
  for (const item of [...report.beats, ...report.observations, ...report.hypotheses, ...report.findings, ...report.suggestedAngles]) check(item.evidenceIds);
  for (const ids of [report.support.summary, report.support.pacing, report.support.payoff, report.support.cta, ...report.support.patterns]) check(ids);
  if (report.support.patterns.length !== report.transferablePatterns.length) throw new Error("Some transferable patterns have no matching evidence. Retry analysis.");
  if (!report.findings.some(f => f.kind === "distinctive") || !report.findings.some(f => f.kind === "weakness" || f.kind === "uncertainty")) throw new Error("The report omitted distinctive details or critical uncertainty. Retry analysis.");
  for (const beat of report.beats) if (beat.startSeconds < 0 || beat.endSeconds < beat.startSeconds || beat.endSeconds > evidence.duration + 0.1) throw new Error("A story timestamp is outside the supplied video. Retry analysis.");
  for (const observation of report.observations) if (observation.timestampSeconds < 0 || observation.timestampSeconds > evidence.duration + 0.1) throw new Error("An observation timestamp is outside the supplied video. Retry analysis.");
  for (const part of Object.values(report.storyStructure)) {
    check(part.evidenceIds);
    if ((part.startSeconds === null) !== (part.endSeconds === null) || part.startSeconds !== null && (part.endSeconds! < part.startSeconds || part.endSeconds! > evidence.duration + 0.1)) throw new Error("A story timestamp is outside the supplied video. Retry analysis.");
    if (part.status === "observed" && part.startSeconds === null) throw new Error("An observed story section needs a timestamp. Retry analysis.");
    if (part.status !== "observed" && part.startSeconds !== null) throw new Error("An unobserved story section cannot have a claimed timestamp. Retry analysis.");
  }
  for (const idea of report.suggestedAngles) validateConcept(idea);
}
export function sourcesFor(reel: Reel): EvidenceSource[] {
  return reel.analysis?.sources || (reel.evidence ? evidenceSources(reel, reel.evidence) : []);
}
export function citedSources(analysis: Analysis | null): string[] {
  if (!analysis) return [];
  return [...new Set([...(analysis.hook.evidenceIds || []), ...analysis.observations.flatMap(o => o.evidenceIds || []), ...analysis.hypotheses.flatMap(h => h.evidenceIds || [])])];
}

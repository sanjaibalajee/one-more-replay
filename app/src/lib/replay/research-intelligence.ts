import { craftGuide } from "./craft/knowledge";
import path from "node:path";
import { CONCEPT_RULES } from "./prompts";
import { validateConcept } from "./concepts";
export { validateConcept } from "./concepts";
import { structured } from "./intelligence";
import { adaptationSchema, gapSchema } from "./research-types";
import { sourcesFor } from "./evidence";
import { gapContext } from "./research";
import { sourceImages } from "./attachments";
export { sourceImages } from "./attachments";
import { LOCAL } from "./paths";
import type { Reel, Settings } from "./types";
import type { z } from "zod";

function checkRefs(reel: Reel | undefined, refs: string[]) {
  const sources = new Set(reel?.analysis?.sources?.map(s=>s.id) || []);
  if (!reel || !refs.length || refs.some(id=>!sources.has(id))) throw new Error("The report cited unavailable source evidence. Retry the report.");
}
const IDEAS = CONCEPT_RULES;
const sourceReport=(r:Reel)=>({id:r.id,caption:r.caption,postedAt:r.postedAt,analysis:r.analysis ? {...r.analysis,suggestedAngles:[]} : null});
const briefFor = (settings: Settings) => JSON.stringify({ ...settings.brief, additionalContext: settings.brandContext });
export async function adaptPattern(reel: Reel, topic: string, jobId: string, settings: Settings, signal: AbortSignal) {
  const images=sourceImages([reel],12);
  const result = await structured("pattern_adaptation", adaptationSchema, `Adapt this specific Reel's observed creative mechanism to the creator's topic. Identify exactly what to borrow, the original evidence and what changes. Do not claim the mechanism caused views. ${craftGuide([reel.analysis?.format])} ${IDEAS}\nBRIEF: ${briefFor(settings)}\nTOPIC: ${JSON.stringify(topic)}\nSOURCE: ${JSON.stringify({ id: reel.id, analysis: sourceReport(reel).analysis, sources: sourcesFor(reel) })}\nATTACHED IMAGE INDEX: ${JSON.stringify(images.index)}`, images.files, path.join(LOCAL,"research",jobId), settings, signal);
  checkRefs(reel, result.result.evidenceIds);
  for (const concept of result.result.concepts) { checkRefs(reel,concept.evidenceIds); validateConcept(concept); }
  return result;
}
export function validateGap(report: z.infer<typeof gapSchema>, own: Reel[], competitors: Reel[]) {
  const context = gapContext(own,competitors);
  for (const gap of report.gaps) {
    checkRefs(own.find(r=>r.id===gap.own.reelId),gap.own.evidenceIds);
    checkRefs(competitors.find(r=>r.id===gap.competitor.reelId),gap.competitor.evidenceIds);
    if (!context.pairs.some(p=>p.ownId===gap.own.reelId && p.competitorId===gap.competitor.reelId && p.matched)) throw new Error("A proposed gap used an unmatched pair. Retry the report.");
  }
  for (const experiment of report.experiments) {
    const reel = [...own,...competitors].find(r=>r.id===experiment.source.reelId);
    checkRefs(reel,experiment.source.evidenceIds); checkRefs(reel,experiment.concept.evidenceIds); validateConcept(experiment.concept);
  }
}
export async function analyzeGaps(own: Reel[], competitors: Reel[], jobId: string, settings: Settings, signal: AbortSignal) {
  const context = gapContext(own,competitors), images=sourceImages([...own,...competitors],2);
  const result = await structured("creative_gaps",gapSchema, `Compare the OWN examples with selected COMPETITOR examples. Identify specific creative opportunities, including what the creator already does well. A gap means a mechanism is present in the selected peer evidence but less developed in the selected own evidence; it does NOT mean the account never uses it. Every gap must cite BOTH a supplied own Reel and a competitor Reel with evidenceIds, and the pair MUST be matched in CONTEXT. Use absence language only as 'not visible in these sampled examples'. Discuss differences within the evidence, never infer private demographics, reach, retention or creative causation from public counts. No cross-account raw-view ranking. Confidence at most medium. If no matched pairs exist, gaps MUST be empty, summary must say evidence is insufficient, and experiments must be clearly exploratory. Topic relevance is not established by format alone; call out mismatches. ${craftGuide([...own, ...competitors].map(reel => reel.analysis?.format))} ${IDEAS} Each experiment has one source citation; concept evidenceIds belong to that SAME Reel.\nBRIEF: ${briefFor(settings)}\nCONTEXT: ${JSON.stringify(context)}\nOWN: ${JSON.stringify(own.map(sourceReport))}\nCOMPETITORS: ${JSON.stringify(competitors.map(sourceReport))}\nATTACHED IMAGE INDEX: ${JSON.stringify(images.index)}`, images.files,path.join(LOCAL,"research",jobId),settings,signal);
  validateGap(result.result,own,competitors);
  return { ...result,context };
}

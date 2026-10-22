import { refineIdea } from "./idea-intelligence";
import { adaptPattern, analyzeGaps } from "./research-intelligence";
import { resolveVideoLink } from "./links";
import { sourcesFor } from "./evidence";
import { randomUUID } from "node:crypto";
import { collectReels } from "./collector";
import { analyze, compare } from "./intelligence";
import { downloadReel, extractEvidence } from "./media";
import { cleanError } from "./process";
import { getIdea, saveIdea, getAccount, getJob, getJobs, getReel, getReels, ingest, privateSettings, saveAccount, saveComparison, saveJob, saveReel, saveResearch } from "./store";
import { performanceFor, comparisonContext } from "./catalogue";
import type { Job, Phase, Settings } from "./types";
import { assertMediaAvailable } from "./media-lock";
import { assertConnection, captureRunSettings } from "./run-config";
import { prepareModelExecution } from "./model-execution";
import path from "node:path";
import { mediaDir } from "./paths";
import { transcribeVideo } from "./transcription";
import { transcriptEditVersion } from "./transcript";

type Runner = { initialized: boolean; running: boolean; active: Map<string, AbortController> };
const globalRunner = globalThis as typeof globalThis & { replayRunner?: Runner };
const state = () => globalRunner.replayRunner ||= { initialized: false, running: false, active: new Map() };
export const terminal = (phase: Phase) => ["completed", "failed", "cancelled"].includes(phase);
export function initializeQueue() {
  const runner = state();
  if (!runner.initialized) {
    runner.initialized = true;
    for (const job of getJobs()) {
      if (!terminal(job.phase) && (job.phase !== "queued" || !job.runSettings)) {
        saveJob({ ...job, phase: "failed", detail: "The server stopped during this job. Retry to continue using cached media.", errors: [...job.errors, "Interrupted by server restart."] });
        if (job.kind === "analyze") for (const id of job.reelIds) {
          const reel = getReel(id);
          if (reel && !["completed", "idle"].includes(reel.status)) saveReel({ ...reel, status: "failed", error: "Interrupted. Retry analysis." });
        }
      }
    }
  }
  void drain();
}
export function enqueue(kind: Job["kind"], accountId: string | null, reelIds: string[], params: Job["params"] = {}): Job {
  initializeQueue();
  assertMediaAvailable(reelIds);
  const existing = getJobs().find(j => !terminal(j.phase) && ((kind === "collect" && j.kind === kind && j.accountId === accountId) || (kind !== "collect" && j.kind !== "collect" && j.reelIds.some(id => reelIds.includes(id)))));
  if (existing) throw new Error("Some of this work is already queued or running. Wait for it to finish.");
  const now = new Date().toISOString();
  const job: Job = { id: randomUUID(), kind, accountId, reelIds, params, runSettings: captureRunSettings(kind, params.brandContext), phase: "queued", detail: "Waiting in the local queue.", completed: 0, total: kind === "collect" || kind === "refine" ? 1 : reelIds.length, errors: [], createdAt: now, updatedAt: now, resultId: null, currentReelId: null, phaseStartedAt: now, history: [{ phase: "queued", detail: "Waiting in queue.", at: now, reelId: null }] };
  saveJob(job);
  if (kind === "analyze") for (const id of reelIds) { const reel = getReel(id); if (reel && (!reel.analysis || params.force)) saveReel({ ...reel, status: "queued", error: null }); }
  void drain(); return job;
}
export function cancelJob(id: string) {
  const job = getJob(id);
  if (!job || terminal(job.phase)) return;
  saveJob({ ...job, phase: "cancelled", detail: "Cancelled. Completed reports and cached media were kept." });
  state().active.get(id)?.abort();
  if (job.kind === "analyze") for (const reelId of job.reelIds) {
    const reel = getReel(reelId);
    if (reel && !["completed", "idle"].includes(reel.status)) saveReel({ ...reel, status: reel.analysis ? "completed" : "cancelled", error: null });
  }
}
async function drain() {
  const runner = state(); if (runner.running) return; runner.running = true;
  try {
    let next: Job | undefined;
    while ((next = getJobs().find(j => j.phase === "queued"))) await execute(next);
  } finally { runner.running = false; }
}
async function execute(initial: Job) {
  const controller = new AbortController(), signal = controller.signal;
  state().active.set(initial.id, controller);
  const update = (values: Partial<Job>) => {
    signal.throwIfAborted(); const current = getJob(initial.id)!, now = new Date().toISOString();
    const transition = values.phase && (values.phase !== current.phase || (values.currentReelId !== undefined && values.currentReelId !== current.currentReelId));
    const history = transition ? [...(current.history || []), { phase: values.phase!, detail: values.detail || "", at: now, reelId: values.currentReelId ?? current.currentReelId ?? null }].slice(-100) : current.history;
    saveJob({ ...current, ...values, history, ...(transition ? { phaseStartedAt: now } : {}) });
  };
  try {
    if (!initial.runSettings) throw new Error("This older job has no saved connection configuration. Retry to approve the current settings.");
    let settings: Settings = { ...initial.runSettings, usageJobId: initial.id };
    const prepare = async () => {
      if (!settings.execution) {
        settings = await prepareModelExecution(settings, signal);
        update({ execution: settings.execution });
      }
    };
    if (initial.kind === "collect") {
      const account = getAccount(initial.accountId!); if (!account) throw new Error("Account no longer exists.");
      update({ phase: "collecting", detail: `Collecting @${account.username}. No AI analysis is running.` });
      const token = privateSettings().apifyToken; assertConnection(settings, token);
      const result = await collectReels(account.username, account.id, initial.params.limit || 50, token, signal, detail => update({ detail }));
      signal.throwIfAborted(); ingest(result.reels);
      saveAccount({ ...getAccount(account.id)!, lastFetchedAt: new Date().toISOString(), requestedLimit: initial.params.limit || 50, lastFetchedCount: result.reels.length, collectionNote: result.note });
      update({ completed: 1, phase: "completed", detail: result.reels.length ? `Collected ${result.reels.length} Reels. Select the ones to analyze.` : "No public Reels were returned. Check the handle and account visibility." });
    } else if (initial.kind === "transcribe") {
      const reel = getReel(initial.reelIds[0]), options = initial.params.transcription;
      if (!reel?.evidence?.hasAudio || !options) throw new Error("This video has no saved audio evidence to transcribe.");
      if (transcriptEditVersion(reel) !== options.expectedRevision) throw new Error("The transcript changed after this retry was requested. Review it before trying again.");
      update({ phase: "transcribing", currentReelId: reel.id, detail: `Transcribing locally with Whisper ${options.model}. ${options.language ? `Language: ${options.language}.` : "Detecting language."} First use may download the model. No LLM usage.` });
      const transcript = await transcribeVideo(path.join(mediaDir(reel.id), "video.mp4"), options, reel.evidence.duration, signal);
      signal.throwIfAborted();
      const latest = getReel(reel.id)!;
      if (transcriptEditVersion(latest) !== options.expectedRevision) throw new Error("The video or transcript changed during recognition. Your current transcript was kept.");
      // The DB is authoritative for an explicit retry. Do not replace the
      // extraction cache before success or leave a cancelled retry published.
      saveReel({ ...latest, transcriptReview: undefined, evidence: { ...latest.evidence!, transcript, transcriptionSettings: { model: options.model, language: options.language } } });
      update({ phase: "completed", completed: 1, resultId: reel.id, detail: "Transcript ready to review. Your saved report is unchanged; analyze again when the wording is right." });
    } else if (initial.kind === "analyze") {
      for (const [index, id] of initial.reelIds.entries()) {
        signal.throwIfAborted(); let reel = getReel(id);
        if (!reel) { update({ errors: [...getJob(initial.id)!.errors, `${id}: Reel missing.`], completed: index + 1 }); continue; }
        if (reel.analysis && !initial.params.force) { saveReel({ ...reel, status: "completed", error: null }); update({ completed: index + 1, detail: `Kept the saved report for Reel ${index + 1}.` }); continue; }
        const phase = (name: Phase, detail: string) => {
          update({ phase: name, currentReelId: id, detail: `${index + 1}/${initial.reelIds.length} · ${detail}` });
          const latest = getReel(id)!; saveReel({ ...latest, status: name, error: null });
        };
        try {
          await prepare();
          phase("downloading", "Downloading selected Reel."); await downloadReel(reel, signal);
          reel = { ...getReel(id)!, mediaRevision: getReel(id)!.mediaRevision || randomUUID() }; saveReel(reel);
          const evidence = await extractEvidence(reel, settings, signal, phase);
          reel = { ...getReel(id)!, evidence };
          saveReel(reel);
          phase("analyzing", `Analyzing frames and transcript with ${settings.provider === "codex" ? "your Codex login" : "the OpenAI API"}.`);
          const result = await analyze({ ...reel, performance: performanceFor(reel, getReels()) }, evidence, settings, signal);
          signal.throwIfAborted();
          saveReel({ ...getReel(id)!, evidence, durationSeconds: evidence.duration, analysis: result.result, analysisProvider: result.provider, analysisUsage: result.usage, analyzedAt: new Date().toISOString(), status: "completed", error: null });
        } catch (err) {
          if (signal.aborted) throw err;
          const error = cleanError(err); saveReel({ ...getReel(id)!, status: "failed", error });
          update({ errors: [...getJob(initial.id)!.errors, `${reel.shortcode}: ${error}`] });
        }
        update({ completed: index + 1 });
      }
      const finished = getJob(initial.id)!;
      const failed = finished.errors.length > 0;
      update({ phase: failed ? "failed" : "completed", detail: failed ? `${finished.completed - finished.errors.length} reports ready; ${finished.errors.length} failed. Retry failed Reels individually.` : "Your selected Reels are ready. Open a breakdown or select reports to compare." });
    } else if (initial.kind === "resolve") {
      const reel=getReel(initial.reelIds[0]); if(!reel) throw new Error("Saved link no longer exists.");
      update({phase:"resolving",detail:"Fetching public video details. No AI analysis or account scraping is running.",currentReelId:reel.id});
      try {
        const resolved=await resolveVideoLink(reel,signal); signal.throwIfAborted();
        saveReel({...getReel(reel.id)!,caption:resolved.caption,thumbnail:resolved.thumbnail,views:resolved.views,likes:resolved.likes,comments:resolved.comments,durationSeconds:resolved.durationSeconds ?? getReel(reel.id)!.durationSeconds,postedAt:resolved.postedAt,collectedAt:resolved.collectedAt,creatorKey:resolved.creatorKey,creatorName:resolved.creatorName,creatorAvatarUrl:resolved.creatorAvatarUrl,error:null});
      } catch(error) { if(!signal.aborted) saveReel({...getReel(reel.id)!,error:cleanError(error)}); throw error; }
      update({phase:"completed",completed:1,detail:"Video link ready. Open it and choose Analyze when you’re ready.",resultId:reel.id});
    } else if (initial.kind === "adapt" || initial.kind === "gap") {
      const reels=initial.reelIds.map(id=>getReel(id)!);
      if(reels.some(r=>!r?.analysis?.sources?.length || r.analysis.version!==2)) throw new Error("Every selected video needs an evidence-linked analysis first.");
      update({phase:"comparing",detail:initial.kind==="adapt" ? "Adapting the observed pattern into three shootable concepts." : "Comparing selected own and competitor examples, then writing three experiments."});
      const base={id:randomUUID(),reelIds:initial.reelIds,createdAt:new Date().toISOString(),brief:JSON.stringify({...settings.brief,additionalContext:settings.brandContext,topic:initial.params.topic}),sourcesByReel:Object.fromEntries(reels.map(r=>[r.id,sourcesFor(r)])),reportVersions:Object.fromEntries(reels.map(r=>[r.id,r.analyzedAt]))};
      if(initial.kind==="adapt") {
        await prepare();
        const result=await adaptPattern(reels[0],initial.params.topic || "",initial.id,settings,signal); signal.throwIfAborted();
        saveResearch({...base,usage:result.usage,provider:result.provider,kind:"adapt",report:result.result});
      } else {
        const ownIds=initial.params.ownIds || [], own=reels.filter(r=>ownIds.includes(r.id)), competitors=reels.filter(r=>!ownIds.includes(r.id));
        if(!own.length || !competitors.length) throw new Error("Choose own and competitor examples.");
        await prepare();
        const result=await analyzeGaps(own,competitors,initial.id,settings,signal); signal.throwIfAborted();
        saveResearch({...base,usage:result.usage,provider:result.provider,kind:"gap",report:result.result,context:result.context,ownIds});
      }
      update({phase:"completed",completed:initial.total,detail:initial.kind==="adapt" ? "Three adapted concepts saved." : "Creative gap report and three experiments saved.",resultId:base.id});
    } else if (initial.kind === "refine") {
      const session = getIdea(initial.params.ideaSessionId || "");
      if (!session || session.messages.at(-1)?.id !== initial.params.messageId) throw new Error("The idea changed before this reply could start. Send your message again.");
      update({ phase: "comparing", detail: "Refining your idea and keeping the original report as context." });
      await prepare();
      const result = await refineIdea(session, initial.id, settings, signal);
      signal.throwIfAborted();
      const latest = getIdea(session.id)!;
      if (latest.updatedAt !== session.updatedAt) throw new Error("The idea changed during this reply. Your current draft was kept.");
      const now = new Date().toISOString();
      saveIdea({ ...latest, draft: result.result.draft, messages: [...latest.messages, { id: randomUUID(), role: "assistant", text: result.result.reply, createdAt: now, usage: result.usage }], updatedAt: now });
      update({ phase: "completed", completed: initial.total, detail: "Idea refined. Save the draft to Inspiration when you are ready.", resultId: session.id });
    } else if (initial.kind === "compare") {
      const reels = initial.reelIds.map(id => getReel(id));
      if (reels.some(r => !r?.analysis)) throw new Error("Analyze every selected Reel before comparing.");
      await prepare();
      update({ phase: "comparing", detail: "Looking for repeated patterns across your selected reports." });
      const catalogue = getReels(), prepared = reels.map(r=>({...r!,performance:performanceFor(r!,catalogue)})), context = comparisonContext(prepared);
      const result = await compare(prepared, initial.id, settings, signal);
      signal.throwIfAborted(); const id = randomUUID();
      saveComparison({ sourcesByReel: Object.fromEntries(reels.map(r => [r!.id, r!.analysis?.sources || []])), reportVersions: Object.fromEntries(reels.map(r => [r!.id, r!.analyzedAt])), id, reelIds: initial.reelIds, report: result.result, usage: result.usage, provider: result.provider, createdAt: new Date().toISOString(), context });
      update({ phase: "completed", completed: initial.total, detail: "Comparison saved.", resultId: id });
    }
  } catch (err) {
    if (!signal.aborted) { const current = getJob(initial.id)!; saveJob({ ...current, phase: "failed", detail: cleanError(err), errors: [...current.errors, cleanError(err)] }); }
  } finally { state().active.delete(initial.id); }
}

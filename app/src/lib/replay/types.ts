import { z } from "zod";

export const formatSchema = z.enum(["talking-head", "demonstration", "tutorial", "story", "montage", "interview", "other"]);
const refs = z.array(z.string()).min(1).max(8);
const optionalRefs = z.array(z.string()).optional();
const editorialSchema = z.object({
  keep: z.object({ detail: z.string().trim().min(1).max(400), evidenceIds: refs }).optional(),
  nextTest: z.object({ change: z.string().trim().min(1).max(400), keepConstant: z.string().trim().min(1).max(300), measure: z.string().trim().min(1).max(400), evidenceIds: refs }).optional(),
  verdict: z.string().trim().min(1).max(500).describe("A direct editorial judgement about the creative, with no claim about measured retention or causality."),
  evidenceIds: refs,
  changes: z.array(z.object({
    action: z.string().trim().min(1).max(180),
    reason: z.string().trim().min(1).max(400),
    example: z.string().trim().min(1).max(500).describe("One concrete proposed edit or replacement line. A recommendation, never a claimed source quote."),
    evidenceIds: refs,
  })).min(1).max(3).describe("In order of editorial value. Prefer one useful change to three padded ones."),
});
export const ideaSchema = z.object({
  idea: z.string().trim().min(1).max(140), opening: z.string().trim().min(1).max(300), body: z.string().trim().min(1).max(1800).describe("Exact audience-facing middle script, matching body shots' spokenLine or silent onScreenText in order. No filming directions."), cta: z.string().trim().min(1).max(300), structure: z.string().max(800),
  rationale: z.string(), audienceFit: z.string(), format: formatSchema, durationSeconds: z.number().min(5).max(120),
  evidenceIds: refs, whyDifferent: z.string(), resources: z.array(z.string()),
  shotList: z.array(z.object({ section: z.enum(["hook", "body", "cta"]), startSeconds: z.number().nonnegative(), endSeconds: z.number().positive(), visual: z.string().trim().min(1).max(500), spokenLine: z.string().max(600), onScreenText: z.string().max(200) })).min(3).max(8),
  experiment: z.string(), successMeasure: z.string(),
});
const storyPartSchema = z.object({ summary: z.string().trim().min(1).max(500), startSeconds: z.number().nonnegative().nullable(), endSeconds: z.number().nonnegative().nullable(), status: z.enum(["observed", "not-visible", "unclear"]), evidenceIds: refs });
export const storyStructureSchema = z.object({ hook: storyPartSchema, body: storyPartSchema, cta: storyPartSchema });
// Optional additions keep previously saved reports readable. New model output uses analysisSchema below.
export const storedAnalysisSchema = z.object({
  editorial: editorialSchema.optional(),
  title: z.string(), summary: z.string(), storyStructure: storyStructureSchema.optional(),
  classification: z.object({ hookType: z.enum(["question", "result-first", "contrarian", "curiosity", "problem", "story", "demonstration", "list", "other", "unknown"]), ctaType: z.enum(["follow", "comment", "save", "share", "visit", "buy", "none-observed", "other", "unknown"]) }).optional(),
  hook: z.object({ label: z.string(), spokenHook: z.string(), visualHook: z.string(), explanation: z.string(), evidenceIds: optionalRefs }),
  beats: z.array(z.object({ startSeconds: z.number(), endSeconds: z.number(), whatHappens: z.string(), purpose: z.string(), evidenceIds: optionalRefs })),
  observations: z.array(z.object({ timestampSeconds: z.number(), category: z.enum(["visual", "text", "script", "editing", "cta"]), detail: z.string(), evidenceIds: optionalRefs })),
  hypotheses: z.array(z.object({ driver: z.string(), evidence: z.string(), confidence: z.enum(["low", "medium", "high"]), evidenceIds: optionalRefs })),
  pacing: z.string(), payoff: z.string(), cta: z.string(), transferablePatterns: z.array(z.string()),
  suggestedAngles: z.array(ideaSchema.partial().extend({ shotList: z.array(ideaSchema.shape.shotList.element.extend({ section: z.enum(["hook", "body", "cta"]).optional() })).optional() }).required({ idea: true, opening: true, structure: true })),
  limitations: z.array(z.string()), version: z.literal(2).optional(), format: formatSchema.optional(),
  findings: z.array(z.object({ kind: z.enum(["distinctive", "strength", "weakness", "uncertainty"]), title: z.string(), detail: z.string(), evidenceIds: refs })).optional(),
  support: z.object({ summary: refs, pacing: refs, payoff: refs, cta: refs, patterns: z.array(refs) }).optional(),
});
export const analysisSchema = storedAnalysisSchema.extend({
  editorial: editorialSchema.extend({ keep: editorialSchema.shape.keep.unwrap(), nextTest: editorialSchema.shape.nextTest.unwrap() }),
  version: z.literal(2), format: formatSchema,
  classification: storedAnalysisSchema.shape.classification.unwrap(), storyStructure: storyStructureSchema,
  hook: storedAnalysisSchema.shape.hook.extend({ evidenceIds: refs }),
  beats: z.array(storedAnalysisSchema.shape.beats.element.extend({ evidenceIds: refs })).min(1),
  observations: z.array(storedAnalysisSchema.shape.observations.element.extend({ evidenceIds: refs })).min(1),
  hypotheses: z.array(storedAnalysisSchema.shape.hypotheses.element.extend({ evidenceIds: refs })).max(4),
  suggestedAngles: z.array(ideaSchema).length(3),
  findings: storedAnalysisSchema.shape.findings.unwrap().min(2).max(6),
  support: storedAnalysisSchema.shape.support.unwrap(),
});
export const comparisonSchema = z.object({
  title: z.string(), summary: z.string(),
  patterns: z.array(z.object({ pattern: z.string(), reelIds: z.array(z.string()), evidence: z.string(), howToAdapt: z.string(), examples: z.array(z.object({ reelId: z.string(), evidenceIds: refs })).optional() })),
  differences: z.array(z.string()), nextExperiments: z.array(z.string()), limitations: z.array(z.string()),
});
export const comparisonV2Schema = comparisonSchema.extend({ patterns: z.array(comparisonSchema.shape.patterns.element.extend({ examples: z.array(z.object({ reelId: z.string(), evidenceIds: refs })).min(2) })) });
export type Analysis = z.infer<typeof storedAnalysisSchema> & { promptRevision?: string; transcriptRevision?: string; sources?: import("./evidence").EvidenceSource[] };
export type AnalysisV2 = z.infer<typeof analysisSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
export type Provider = "codex" | "openai";
export type ReasoningEffort = "default" | "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
export type Phase = "queued" | "resolving" | "collecting" | "downloading" | "extracting" | "transcribing" | "analyzing" | "comparing" | "completed" | "failed" | "cancelled";
export interface Account {
  id: string; username: string; label: string; createdAt: string;
  lastFetchedAt: string | null; requestedLimit: number; lastFetchedCount: number;
  collectionNote: string; reelCount?: number; profileImageUrl?: string; profileCheckedAt?: string; profileError?: string | null;
  role?: "own" | "competitor" | "inspiration"; kind?: "creator" | "inbox"; platform?: import("./research-types").Platform;
}
export interface TranscriptWord { start: number; end: number; text: string; probability?: number }
export interface TranscriptSegment { words?: TranscriptWord[]; start: number; end: number; text: string; avgLogProb?: number; noSpeechProb?: number; compressionRatio?: number; reviewed?: boolean }
export interface Transcript { text: string; language: string | null; languageProbability?: number; segments: TranscriptSegment[]; engine: string; model: string; status: "completed" | "no-audio" | "unavailable"; note: string; reviewed?: boolean }
export interface TranscriptReview { revision: string; sourceRevision: string; mediaRevision: string; updatedAt: string; corrections: { index: number; text: string }[] }
export interface Frame { file: string; seconds: number }
export interface MediaEvidence { transcriptionSettings?: { model: string; language: string }; samplingVersion?: number; duration: number; width: number; height: number; hasAudio: boolean; frames: Frame[]; sceneChanges: number[]; transcript: Transcript; warnings: string[] }
export interface Performance {
  medianViews: number | null; multiple: number | null; sampleSize: number; note: string;
  ageDays?: number | null; durationSeconds?: number | null; cohort?: "similar" | "account" | "insufficient";
  filters?: string[]; quality?: "moderate" | "weak"; standout?: boolean; asOf?: string;
}
export interface Reel {
  id: string; accountId: string; shortcode: string; url: string; caption: string;
  thumbnail: string; videoUrl: string; views: number | null; likes: number | null; comments: number | null;
  postedAt: string | null; collectedAt: string; source: "apify" | "import" | "upload" | "link";
  platform?: import("./research-types").Platform; creatorKey?: string; creatorName?: string; creatorAvatarUrl?: string; annotation?: import("./research-types").Annotation;
  durationSeconds?: number | null; mediaRevision?: string;
  status: Phase | "idle"; error: string | null; starred: boolean;
  evidence: MediaEvidence | null; analysis: Analysis | null; analysisProvider: string | null; analyzedAt: string | null;
  performance?: Performance;
  analysisUsage?: import("./usage-types").ModelUsage;
  transcriptReview?: TranscriptReview;
}
export interface Job {
  id: string; kind: "collect" | "analyze" | "compare" | "resolve" | "adapt" | "gap" | "refine" | "transcribe"; accountId: string | null;
  reelIds: string[]; phase: Phase; detail: string; completed: number; total: number;
  errors: string[]; createdAt: string; updatedAt: string; resultId: string | null;
  currentReelId?: string | null; phaseStartedAt?: string;
  history?: { phase: Phase; detail: string; at: string; reelId: string | null }[];
  runSettings?: Settings;
  usage?: import("./usage-types").ModelUsage[];
  execution?: import("./usage-types").ModelExecution;
  params: { transcription?: { model: string; language: string; expectedRevision: string }; limit?: number; brandContext?: string; force?: boolean; topic?: string; ownIds?: string[]; ideaSessionId?: string; messageId?: string; message?: string };
}
export interface ComparisonContext {
  quality: "moderate" | "weak"; reasons: string[];
  pairs: { leftId: string; rightId: string; comparable: boolean; reasons: string[] }[];
  rows: { reelId: string; ageDays: number | null; durationSeconds: number | null; format: string | null; multiple: number | null; sampleSize: number; cohort: string }[];
}
export interface SavedComparison { usage?: import("./usage-types").ModelUsage; id: string; reelIds: string[]; report: Comparison; provider: string; createdAt: string; context?: ComparisonContext; sourcesByReel?: Record<string, import("./evidence").EvidenceSource[]>; reportVersions?: Record<string, string | null> }
export interface CreativeBrief { business: string; audience: string; language: string; tone: string; constraints: string; goal: string }
export interface Settings { provider: Provider; codexModel: string; openaiModel: string; whisperModel: string; language: string; brandContext: string; brief?: CreativeBrief; codexEffort?: ReasoningEffort; openaiEffort?: ReasoningEffort; connectionId?: string; usageJobId?: string; usageReelId?: string; execution?: import("./usage-types").ModelExecution }
export interface PublicSettings extends Settings { hasApifyToken: boolean; hasOpenaiKey: boolean }
export interface Readiness { codex: { installed: boolean; loggedIn: boolean; subscription: boolean; detail: string }; ffmpeg: boolean; ffprobe: boolean; python: boolean; whisper: boolean; ytdlp: boolean }
export interface Snapshot { ideas?: import("./idea-types").IdeaSession[]; revision?: string; accounts: Account[]; reels: Reel[]; jobs: Job[]; comparisons: SavedComparison[]; collections: import("./research-types").Collection[]; research: import("./research-types").ResearchReport[]; settings: PublicSettings }

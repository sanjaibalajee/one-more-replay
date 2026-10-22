import { z } from "zod";
import { ideaSchema } from "./types";
import type { EvidenceSource } from "./evidence";

export const roles = ["own", "competitor", "inspiration"] as const;
export const hookTypes = ["question", "result-first", "contrarian", "curiosity", "problem", "story", "demonstration", "list", "other", "unknown"] as const;
export const ctaTypes = ["follow", "comment", "save", "share", "visit", "buy", "none-observed", "other", "unknown"] as const;
export const annotationSchema = z.object({ notes: z.string().max(5000), tags: z.array(z.string().trim().min(1).max(40)).max(12), hookType: z.enum(hookTypes), ctaType: z.enum(ctaTypes) });
export type Annotation = z.infer<typeof annotationSchema>;
export interface Collection { id: string; name: string; description: string; reelIds: string[]; createdAt: string; updatedAt: string }
const citationSchema = z.object({ reelId: z.string(), evidenceIds: z.array(z.string()).min(1).max(8) });
export const adaptationSchema = z.object({ title: z.string(), mechanism: z.string(), evidenceIds: z.array(z.string()).min(1).max(8), assumptions: z.array(z.string()), concepts: z.array(ideaSchema).length(3), limitations: z.array(z.string()) });
export const gapSchema = z.object({
  title: z.string(), summary: z.string(),
  gaps: z.array(z.object({ title: z.string(), observation: z.string(), opportunity: z.string(), confidence: z.enum(["low", "medium"]), own: citationSchema, competitor: citationSchema })).max(6),
  experiments: z.array(z.object({ concept: ideaSchema, source: citationSchema })).length(3),
  limitations: z.array(z.string()).min(1),
});
export interface GapContext { pairs: { ownId: string; competitorId: string; matched: boolean; reasons: string[] }[]; matchedPairs: number; ownCount: number; competitorCount: number; limitations: string[] }
interface ResearchBase { usage?: import("./usage-types").ModelUsage; id: string; reelIds: string[]; createdAt: string; provider: string; brief: string; sourcesByReel: Record<string, EvidenceSource[]>; reportVersions: Record<string, string | null> }
export type ResearchReport = ResearchBase & ({ kind: "adapt"; report: z.infer<typeof adaptationSchema> } | { kind: "gap"; report: z.infer<typeof gapSchema>; context: GapContext; ownIds: string[] });
export type Platform = "instagram" | "tiktok" | "youtube" | "local";
export const platformFor = (reel: { platform?: Platform; source: string }): Platform => reel.platform || (reel.source === "upload" ? "local" : "instagram");
export const platformLabel: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", local: "Local video" };
export const humanize = (value: string) => value.replaceAll("-", " ");

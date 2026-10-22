import { z } from "zod";
import type { EvidenceSource } from "./evidence";
import type { ModelUsage } from "./usage-types";
import type { IdeaStage } from "./idea-workflow";
export { ideaStages, stageLabel, type IdeaStage } from "./idea-workflow";
export const ideaDraftSchema = z.object({
  title: z.string().trim().min(1).max(140),
  hook: z.string().trim().max(600),
  body: z.string().trim().min(1).max(5000),
  cta: z.string().max(600),
  notes: z.string().max(2000),
});
export type IdeaDraft = z.infer<typeof ideaDraftSchema>;
export const refinementSchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  draft: ideaDraftSchema.extend({ hook: z.string().trim().min(1).max(600) }),
});
export interface IdeaMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  usage?: ModelUsage;
}
export interface IdeaSession {
  id: string;
  sourceKind: "reel" | "research" | "manual";
  sourceId: string;
  conceptIndex: number;
  sourceTitle: string;
  reelIds: string[];
  reportVersions: Record<string, string | null>;
  sourcesByReel: Record<string, EvidenceSource[]>;
  original: IdeaDraft;
  draft: IdeaDraft;
  savedDraft?: IdeaDraft;
  savedAt: string | null;
  stage?: IdeaStage;
  messages: IdeaMessage[];
  createdAt: string;
  updatedAt: string;
}

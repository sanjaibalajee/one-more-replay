import { ideaStages, type IdeaStage } from "@/lib/replay/idea-workflow";
import type { IdeaDraft, IdeaSession } from "@/lib/replay/idea-types";
export interface DraftState {
  draft: IdeaDraft;
  message: string;
  stage: IdeaStage;
  tab: string;
  chat: boolean;
}
export function restoreDraftState(
  session: IdeaSession,
  value: unknown,
): DraftState {
  const cached =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const chat =
    typeof cached.chat === "boolean"
      ? cached.chat
      : session.messages.length > 0;
  const tab = chat && cached.tab === "conversation" ? "conversation" : "draft";
  const current = cached.version === session.updatedAt;
  const limits = { title: 140, hook: 600, body: 5000, cta: 600, notes: 2000 };
  const draft = cached.draft as Record<string, unknown> | undefined;
  const validDraft =
    draft &&
    Object.entries(limits).every(
      ([key, max]) =>
        typeof draft[key] === "string" && draft[key].length <= max,
    );
  const validMessage =
    typeof cached.message === "string" && cached.message.length <= 2000;
  return {
    draft:
      current && validDraft ? (draft as unknown as IdeaDraft) : session.draft,
    message:
      validMessage &&
      (current || cached.messageCount === session.messages.length)
        ? (cached.message as string)
        : "",
    stage:
      current && ideaStages.includes(cached.stage as IdeaStage)
        ? (cached.stage as IdeaStage)
        : session.stage || "draft",
    tab,
    chat,
  };
}

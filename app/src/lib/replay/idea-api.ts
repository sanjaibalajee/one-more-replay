import { z } from "zod";
import { randomUUID } from "node:crypto";
import { ideaDraftSchema, ideaStages, type IdeaSession } from "./idea-types";
import {
  getIdea,
  getIdeas,
  getJobs,
  getReel,
  getResearch,
  saveIdea,
} from "./store";
import { sourcesFor } from "./evidence";
import { enqueue } from "./jobs";

export const ideaActions = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("idea-create"),
    id: z.uuid(),
    text: z.string().trim().min(1).max(5000),
  }),
  z.object({
    action: z.literal("idea-start"),
    sourceKind: z.enum(["reel", "research"]),
    sourceId: z.string().min(1).max(100),
    conceptIndex: z.number().int().min(0).max(2),
  }),
  z.object({
    action: z.literal("idea-message"),
    id: z.string().min(1).max(100),
    message: z.string().trim().min(1).max(2000),
    retryMessageId: z.string().optional(),
    draft: ideaDraftSchema.optional(),
    stage: z.enum(ideaStages).optional(),
    expectedUpdatedAt: z.string().optional(),
  }),
  z.object({
    action: z.literal("idea-save"),
    id: z.string().min(1).max(100),
    draft: ideaDraftSchema,
    stage: z.enum(ideaStages).optional(),
    expectedUpdatedAt: z.string(),
  }),
]);
const busy = (id: string) =>
  getJobs().some(
    (job) =>
      job.kind === "refine" &&
      job.params.ideaSessionId === id &&
      !["completed", "failed", "cancelled"].includes(job.phase),
  );
export function handleIdea(input: z.infer<typeof ideaActions>): Response {
  if (input.action === "idea-create") {
    const existing = getIdea(input.id);
    if (existing) {
      if (
        existing.sourceKind !== "manual" ||
        existing.original.body !== input.text
      )
        throw new Error(
          "This draft was already created. Reopen it before adding edits.",
        );
      return Response.json(existing);
    }
    const draft = ideaDraftSchema.parse({
      title: input.text.split(/\r?\n/)[0].slice(0, 140),
      hook: "",
      body: input.text,
      cta: "",
      notes: "",
    });
    const now = new Date().toISOString();
    saveIdea({
      id: input.id,
      sourceKind: "manual",
      sourceId: input.id,
      conceptIndex: 0,
      sourceTitle: "Your own idea",
      reelIds: [],
      reportVersions: {},
      sourcesByReel: {},
      original: draft,
      draft,
      savedDraft: draft,
      savedAt: now,
      stage: "draft",
      messages: [],
      createdAt: now,
      updatedAt: now,
    });
    return Response.json(getIdea(input.id), { status: 201 });
  }
  if (input.action === "idea-start") {
    const reel = input.sourceKind === "reel" ? getReel(input.sourceId) : null;
    const research =
      input.sourceKind === "research" ? getResearch(input.sourceId) : null;
    const concept =
      reel?.analysis?.suggestedAngles[input.conceptIndex] ||
      (research?.kind === "adapt"
        ? research.report.concepts[input.conceptIndex]
        : research?.report.experiments[input.conceptIndex]?.concept);
    if (!concept) throw new Error("This report's idea is no longer available.");
    const versions = reel
      ? { [reel.id]: reel.analyzedAt }
      : research!.reportVersions;
    const existing = getIdeas().find(
      (idea) =>
        idea.sourceKind === input.sourceKind &&
        idea.sourceId === input.sourceId &&
        idea.conceptIndex === input.conceptIndex &&
        JSON.stringify(idea.reportVersions) === JSON.stringify(versions),
    );
    if (existing) return Response.json(existing);
    const original = ideaDraftSchema.parse({
      title: concept.idea,
      hook: concept.opening,
      body: concept.body || concept.structure,
      cta: concept.cta || "",
      notes: [concept.rationale, concept.whyDifferent]
        .filter(Boolean)
        .join("\n"),
    });
    const now = new Date().toISOString();
    const session: IdeaSession = {
      id: randomUUID(),
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      conceptIndex: input.conceptIndex,
      sourceTitle: reel
        ? reel.analysis?.title || "Video report"
        : research!.report.title,
      reelIds: reel ? [reel.id] : research!.reelIds,
      reportVersions: versions,
      sourcesByReel: reel
        ? { [reel.id]: sourcesFor(reel) }
        : research!.sourcesByReel,
      original,
      draft: original,
      savedAt: null,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    saveIdea(session);
    return Response.json(getIdea(session.id), { status: 201 });
  }
  const session = getIdea(input.id);
  if (!session) throw new Error("This idea conversation is unavailable.");
  if (busy(session.id))
    throw new Error("Wait for this idea's current reply to finish.");
  if (input.action === "idea-save") {
    if (session.updatedAt !== input.expectedUpdatedAt)
      throw new Error(
        "This idea changed in another view. Reopen it before saving your edits.",
      );
    const now = new Date().toISOString();
    saveIdea({
      ...session,
      draft: input.draft,
      savedDraft: input.draft,
      stage: input.stage ?? session.stage ?? "draft",
      savedAt: now,
      updatedAt: now,
    });
    return Response.json({ id: session.id });
  }
  if (session.messages.length >= 40 && !input.retryMessageId)
    throw new Error(
      "This conversation has reached 20 exchanges. Save the current draft to Inspiration.",
    );
  const last = session.messages.at(-1);
  if (
    (input.draft || input.stage) &&
    session.updatedAt !== input.expectedUpdatedAt
  )
    throw new Error(
      "This idea changed in another view. Reopen it before sending your edits.",
    );
  if (
    input.retryMessageId &&
    (last?.id !== input.retryMessageId ||
      last.role !== "user" ||
      last.text !== input.message)
  )
    throw new Error("Only the last unanswered message can be retried.");
  const message = input.retryMessageId
    ? last!
    : {
        id: randomUUID(),
        role: "user" as const,
        text: input.message,
        createdAt: new Date().toISOString(),
      };
  if (!input.retryMessageId)
    saveIdea({
      ...session,
      draft: input.draft || session.draft,
      stage: input.stage ?? session.stage,
      messages: [...session.messages, message],
      updatedAt: message.createdAt,
    });
  try {
    const job = enqueue("refine", null, session.reelIds, {
      ideaSessionId: session.id,
      messageId: message.id,
      message: message.text,
    });
    return Response.json(job, { status: 202 });
  } catch (error) {
    if (!input.retryMessageId) saveIdea(session);
    throw error;
  }
}

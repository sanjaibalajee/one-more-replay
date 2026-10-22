import { z } from "zod";
import { techniqueIds } from "./techniques";

export const craftNoteSchema = z.object({
  technique: z.enum(techniqueIds),
  status: z.enum(["observed", "tentative"]),
  observation: z
    .string()
    .trim()
    .min(1)
    .max(400)
    .describe(
      "The specific supplied moment that shows the technique, without invented audience reactions.",
    ),
  mechanism: z
    .string()
    .trim()
    .min(1)
    .max(400)
    .describe(
      "How it organizes information or creates a question. An editorial interpretation, not a claim about measured performance.",
    ),
  tradeoff: z
    .string()
    .trim()
    .min(1)
    .max(350)
    .describe(
      "When this device could confuse, overpromise or weaken this particular video. No compulsory fault.",
    ),
  adaptation: z
    .string()
    .trim()
    .min(1)
    .max(400)
    .describe(
      "One concrete way to borrow the mechanism for the creator brief, preserving its purpose rather than copying the subject or script.",
    ),
  evidenceIds: z.array(z.string()).min(1).max(8),
});
export const craftNotesSchema = z
  .array(craftNoteSchema)
  .max(3)
  .describe(
    "Zero to three distinct, well-supported techniques. An empty list is valid when evidence is insufficient; never fill a quota.",
  );
export type CraftNote = z.infer<typeof craftNoteSchema>;

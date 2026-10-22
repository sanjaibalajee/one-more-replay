import type { IdeaDraft } from "./idea-types";

export function scriptText(draft: IdeaDraft) {
  return [draft.hook, draft.body, draft.cta]
    .map((text) => text.trim())
    .filter(Boolean)
    .join("\n\n");
}
export function scriptLength(draft: IdeaDraft) {
  const words = [
    ...new Intl.Segmenter(undefined, { granularity: "word" }).segment(
      scriptText(draft),
    ),
  ].filter((part) => part.isWordLike).length;
  return {
    words,
    fastSeconds: Math.ceil((words / 180) * 60),
    slowSeconds: Math.ceil((words / 120) * 60),
  };
}
export function scriptLengthLabel(draft: IdeaDraft) {
  const { words, fastSeconds, slowSeconds } = scriptLength(draft);
  return `${words} words · about ${fastSeconds}–${slowSeconds}s spoken`;
}
export function scriptMarkdown(draft: IdeaDraft) {
  return `# ${draft.title}\n\n${(
    [
      ["Hook", draft.hook],
      ["Body", draft.body],
      ["CTA", draft.cta],
      ["Production notes", draft.notes],
    ] as const
  )
    .filter(([, text]) => text.trim())
    .map(([label, text]) => `## ${label}\n\n${text}`)
    .join("\n\n")}\n`;
}

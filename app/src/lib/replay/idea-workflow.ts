export const ideaStages = ["draft", "ready", "posted"] as const;
export type IdeaStage = (typeof ideaStages)[number];
export const stageLabel = (stage: IdeaStage = "draft") =>
  ({ draft: "Draft", ready: "Ready to film", posted: "Posted" })[stage];

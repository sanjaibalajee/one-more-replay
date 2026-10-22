// Small shared vocabulary; research and prompt guidance stay on the server.
export const techniqueIds = [
  "result-first",
  "specific-promise",
  "curiosity-payoff",
  "before-after",
  "demonstrated-proof",
  "story-turn",
  "stepwise-teaching",
  "visual-verbal",
  "information-progress",
  "motivated-ending",
  "expectation-reversal",
  "useful-list",
] as const;
export type TechniqueId = (typeof techniqueIds)[number];
export const techniqueLabels: Record<TechniqueId, string> = {
  "result-first": "Lead with the result",
  "specific-promise": "A specific viewer promise",
  "curiosity-payoff": "Curiosity with a payoff",
  "before-after": "A readable before and after",
  "demonstrated-proof": "Show the proof",
  "story-turn": "A problem changes the story",
  "stepwise-teaching": "Teach in useful steps",
  "visual-verbal": "Let words and images work together",
  "information-progress": "Make each beat add something",
  "motivated-ending": "An ending that fits the purpose",
  "expectation-reversal": "Set up and reverse an expectation",
  "useful-list": "Give the list an organizing rule",
};

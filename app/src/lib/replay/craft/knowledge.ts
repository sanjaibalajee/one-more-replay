import type { TechniqueId } from "./techniques";
import { techniqueLabels } from "./techniques";

export const CRAFT_REVISION = "2026-10-22.1";
type Format =
  | "talking-head"
  | "demonstration"
  | "tutorial"
  | "story"
  | "montage"
  | "interview"
  | "other";

// These are editorial applications of the cited guidance, not experimentally
// established causes of organic Reel performance. Keep each source's scope.
export const craftSources = {
  shorts: {
    url: "https://blog.youtube/creator-and-artist-stories/youtube-shorts-deep-dive/",
    scope:
      "Creator interview on Shorts; experience and platform guidance, not a universal timing law.",
  },
  tiktok: {
    url: "https://ads.tiktok.com/business/en-US/creative-codes",
    scope:
      "TikTok advertising guidance; apply to organic content as editorial hypotheses.",
  },
  abcd: {
    url: "https://support.google.com/google-ads/answer/14783551?hl=en",
    scope:
      "YouTube advertising guidance; objectives change the appropriate creative treatment.",
  },
  captions: {
    url: "https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html",
    scope: "Caption accessibility guidance, not a virality framework.",
  },
  retention: {
    url: "https://support.google.com/youtube/answer/9314415?hl=en",
    scope:
      "First-party analytics guidance; replay spikes can also indicate confusion.",
  },
} as const;

interface Technique {
  id: TechniqueId;
  formats: Format[];
  lens: string;
  sources: (keyof typeof craftSources)[];
}
export const techniques: Technique[] = [
  {
    id: "expectation-reversal",
    formats: ["story", "talking-head", "montage", "interview"],
    lens: "Identify what the setup leads someone to expect and which later detail changes that reading. Surprise can form a joke or reveal, but neither an audience's laughter nor comic delivery is observable from ASR. Removing context can destroy the contrast; do not equate a contrarian sentence with a supported reversal.",
    sources: ["tiktok", "shorts"],
  },
  {
    id: "useful-list",
    formats: ["talking-head", "tutorial", "montage", "demonstration"],
    lens: "A list can help someone choose when it has a legible criterion, distinct entries and enough reasons to use the ranking. Identify the actual organizing rule in speech or frames. Personal taste is not an objective test; extra items or a countdown do not automatically make a list more useful.",
    sources: ["abcd"],
  },
  {
    id: "result-first",
    formats: ["tutorial", "demonstration", "talking-head"],
    lens: "Opening with the outcome can make the task's value concrete before explanation. Check what result is actually shown or said early. Keep enough process to make it credible; revealing everything immediately can remove a story's useful uncertainty.",
    sources: ["shorts", "abcd"],
  },
  {
    id: "specific-promise",
    formats: ["tutorial", "demonstration", "talking-head", "interview"],
    lens: "A named problem, constraint or outcome helps a viewer recognize relevance. Check whether the body delivers that same promise. A precise price or time is a source claim, not verified truth; never invent stronger numbers or treat an owned resource as a new purchase.",
    sources: ["abcd"],
  },
  {
    id: "curiosity-payoff",
    formats: ["story", "tutorial", "demonstration", "talking-head"],
    lens: "Name the concrete unanswered question and where the source resolves it. Withholding an outcome can organize a story, but unexplained setup or an undelivered promise can feel like bait. Do not equate delaying information with measured retention.",
    sources: ["shorts", "tiktok"],
  },
  {
    id: "before-after",
    formats: ["demonstration", "tutorial", "montage"],
    lens: "A contrast makes the change easy to inspect when the subject, scale and conditions are comparable. Require two supplied visual moments for an observed comparison. A changed angle, lighting or edit may limit the comparison; a reveal is not causal proof of a product claim.",
    sources: ["abcd"],
  },
  {
    id: "demonstrated-proof",
    formats: ["demonstration", "tutorial", "talking-head", "interview"],
    lens: "Separate what a creator claims from what the supplied demonstration lets someone inspect. Look for a relevant action and outcome, not just a beauty shot or testimonial. Missing intermediate steps can limit repeatability; sampled frames cannot certify continuous execution.",
    sources: ["abcd"],
  },
  {
    id: "story-turn",
    formats: ["story", "tutorial", "demonstration", "interview"],
    lens: "A goal, obstacle and changed attempt can give the next beat a reason to exist. Identify the actual change rather than listing events joined by 'then'. A mistake can be part of the appeal; polishing it away may remove the distinctive mini-story.",
    sources: ["shorts", "tiktok"],
  },
  {
    id: "stepwise-teaching",
    formats: ["tutorial", "demonstration"],
    lens: "Judge whether someone can follow the essential decision, quantity or step from available speech and images. Keep the detail needed to repeat the task, while grouping incidental steps. A personal experiment or mood clip does not automatically owe a complete tutorial or itemized budget.",
    sources: ["abcd"],
  },
  {
    id: "visual-verbal",
    formats: [
      "tutorial",
      "demonstration",
      "talking-head",
      "story",
      "montage",
      "interview",
    ],
    lens: "Words can explain a reason while images show the action. Check whether visible text and speech support one idea or compete. Preserve useful accessibility captions; they are not needless repetition. ASR is not proof that on-screen captions exist or synchronize correctly.",
    sources: ["abcd", "captions"],
  },
  {
    id: "information-progress",
    formats: [
      "tutorial",
      "demonstration",
      "talking-head",
      "story",
      "montage",
      "interview",
    ],
    lens: "Judge what each beat adds: a new step, evidence, escalation, contrast or a deliberate mood. Fast cuts alone do not establish good pacing. A pattern change should serve the idea. Do not prescribe a cut every fixed number of seconds, or call unrecognized speech dead air.",
    sources: ["tiktok", "shorts"],
  },
  {
    id: "motivated-ending",
    formats: [
      "tutorial",
      "demonstration",
      "talking-head",
      "story",
      "montage",
      "interview",
    ],
    lens: "An ending can resolve a question, let a result register, or invite one relevant action. Match an ask to the creator's purpose; organic content need not sell or demand engagement. Similar opening/ending frames can suggest a visual rhyme, not prove a seamless audio loop or repeat viewing.",
    sources: ["abcd", "shorts", "retention"],
  },
];

const formatLenses: Record<Format, string> = {
  "talking-head":
    "Evaluate one clear claim, supporting example and understandable qualification. Do not invent authority, testimony or vocal-delivery observations.",
  demonstration:
    "Evaluate the problem, visible method and inspectable result. Distinguish a claim, a demonstration and causal proof.",
  tutorial:
    "Evaluate the promised task, essential steps and usable outcome. Preserve necessary explanation rather than rewarding compression alone.",
  story:
    "Evaluate the goal, changed situation and resolution. A deliberate delay or imperfection may earn its place when it advances the mini-story.",
  montage:
    "Evaluate visual selection, contrast, progression and atmosphere. A compact moment or mood can be the purpose; do not force spoken exposition, a problem/solution arc or a CTA.",
  interview:
    "Evaluate whether the question, answer and example form a coherent exchange. Do not invent speaker identity, emotion, expertise or isolated-quote context.",
  other:
    "Describe the observed purpose before applying a formula. Keep format uncertainty explicit.",
};

export function craftGuide(formats: (string | undefined)[] = []): string {
  const known = [
    ...new Set(
      formats.filter((format): format is Format =>
        Boolean(format && Object.hasOwn(formatLenses, format)),
      ),
    ),
  ];
  const focused = known.filter((format) => format !== "other");
  const selected = focused.length
    ? techniques.filter((item) =>
        focused.some((format) => item.formats.includes(format)),
      )
    : techniques;
  const lenses = known.length ? known : (Object.keys(formatLenses) as Format[]);
  return `CREATIVE CRAFT KNOWLEDGE (${CRAFT_REVISION}): Use these as conditional editorial lenses, not a scorecard. First identify the video's apparent purpose from actual evidence. Describe intended viewer understanding separately from observed audience response. There is no universal one-second deadline, cut frequency, ideal length or mandatory CTA. Ad guidance does not establish organic reach. Music, vocal delivery, continuous motion, caption synchronization, trends and seamless loops need evidence the app may not supply. When missing, state the specific limit rather than inventing an assessment.
FORMAT LENSES: ${lenses.map((format) => `${format}: ${formatLenses[format]}`).join("\n")}
TECHNIQUES: ${selected.map((item) => `${item.id} (${techniqueLabels[item.id]}): ${item.lens}`).join("\n")}
TRANSFER: Borrow a mechanism, not a competitor's claim or script. Change subject and treatment to fit the brief. Consider what would be lost by the proposed edit. When relevant, test comprehension, result readability or a goal-specific first-party action; views alone do not prove why it worked.`;
}

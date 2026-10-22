import test from "node:test";
import assert from "node:assert/strict";
import {
  craftGuide,
  craftSources,
  techniques,
} from "../src/lib/replay/craft/knowledge";
import { techniqueIds } from "../src/lib/replay/craft/techniques";
import {
  craftNotesSchema,
  type CraftNote,
} from "../src/lib/replay/craft/schema";
import { validateCraftNotes } from "../src/lib/replay/craft/validate";
import {
  analysisSchema,
  storedAnalysisSchema,
  type Reel,
} from "../src/lib/replay/types";
import type { EvidenceSource } from "../src/lib/replay/evidence";
import {
  buildCatalogueSearch,
  catalogueMatches,
} from "../src/lib/replay/catalogue-search";
import { reelMarkdown } from "../src/lib/replay/export";
import { reportFixture } from "./fixtures/report";

const sources: EvidenceSource[] = [
  {
    id: "F1",
    kind: "frame",
    seconds: 0,
    text: "A flat sheet on a table.",
    label: "Opening",
  },
  {
    id: "F2",
    kind: "frame",
    seconds: 10,
    text: "A folded fan on the same table.",
    label: "Result",
  },
  {
    id: "T1",
    kind: "transcript",
    seconds: 0,
    endSeconds: 2,
    text: "Can this sheet become a fan?",
    label: "Opening words",
  },
  {
    id: "T2",
    kind: "transcript",
    seconds: 9,
    endSeconds: 11,
    text: "Here is the finished fan.",
    label: "Closing words",
  },
  {
    id: "M_views",
    kind: "metric",
    seconds: null,
    text: "100 views",
    label: "Views",
  },
  {
    id: "D_caption",
    kind: "metadata",
    seconds: null,
    text: "A claimed transformation",
    label: "Caption",
  },
];
const note = (
  technique: CraftNote["technique"],
  evidenceIds: string[],
  status: CraftNote["status"] = "observed",
): CraftNote => ({
  technique,
  status,
  evidenceIds,
  observation:
    "The source contrasts the flat sheet and folded fan on the same table.",
  mechanism: "Keeping the table in view makes the change easier to compare.",
  tradeoff: "A different angle could make the comparison harder to inspect.",
  adaptation:
    "Show your unpainted and finished planter from the same position.",
});

test("a transformation needs two distinct visual moments; a narrated claim is not a demonstration", () => {
  validateCraftNotes([note("before-after", ["F1", "F2"])], sources, 12);
  assert.throws(
    () => validateCraftNotes([note("before-after", ["F1", "T2"])], sources, 12),
    /two different visual/,
  );
  const sameMoment = sources.map((source) =>
    source.id === "F2" ? { ...source, seconds: 0 } : source,
  );
  assert.throws(
    () =>
      validateCraftNotes([note("before-after", ["F1", "F2"])], sameMoment, 12),
    /two different visual/,
  );
  assert.throws(
    () => validateCraftNotes([note("demonstrated-proof", ["T2"])], sources, 12),
    /speech alone is a claim/,
  );
  validateCraftNotes(
    [note("demonstrated-proof", ["T2"], "tentative")],
    sources,
    12,
  );
});

test("opening, ending, progression and words/image coordination need evidence from their claimed moments", () => {
  assert.throws(
    () => validateCraftNotes([note("result-first", ["F2", "T2"])], sources, 12),
    /opening evidence/,
  );
  assert.throws(
    () =>
      validateCraftNotes([note("motivated-ending", ["F1", "T1"])], sources, 12),
    /closing part/,
  );
  assert.throws(
    () =>
      validateCraftNotes(
        [note("information-progress", ["F1", "T1"])],
        sources,
        12,
      ),
    /more than one/,
  );
  assert.throws(
    () =>
      validateCraftNotes([note("curiosity-payoff", ["F1", "T1"])], sources, 12),
    /later resolution/,
  );
  validateCraftNotes([note("curiosity-payoff", ["T1", "T2"])], sources, 12);
  assert.throws(
    () =>
      validateCraftNotes([note("visual-verbal", ["F2", "T1"])], sources, 12),
    /same moment/,
  );
  validateCraftNotes([note("visual-verbal", ["F1", "T1"])], sources, 12);
  validateCraftNotes([note("motivated-ending", ["F2", "T2"])], sources, 12);
});

test("public counts, captions and duplicate labels cannot become grounded technique findings", () => {
  for (const ids of [["M_views"], ["D_caption"]])
    assert.throws(
      () => validateCraftNotes([note("specific-promise", ids)], sources, 12),
      /not public counts/,
    );
  assert.throws(
    () =>
      validateCraftNotes([note("before-after", ["F_missing"])], sources, 12),
    /not supplied/,
  );
  assert.throws(
    () =>
      validateCraftNotes(
        [
          note("before-after", ["F1", "F2"]),
          note("before-after", ["F1", "F2"]),
        ],
        sources,
        12,
      ),
    /repeated/,
  );
  assert.equal(
    craftNotesSchema.safeParse([
      note("before-after", ["F1", "F2"]),
      note("specific-promise", ["T1"]),
      note("story-turn", ["T1", "T2"]),
      note("motivated-ending", ["F2"]),
    ]).success,
    false,
  );
  validateCraftNotes([], sources, 12);
});

test("silent montages keep visual techniques without forcing speech or a sales ending", () => {
  const silent = sources.filter((source) => source.kind === "frame");
  validateCraftNotes([note("before-after", ["F1", "F2"])], silent, 12);
  const guide = craftGuide(["montage"]);
  assert.match(guide, /compact moment or mood/);
  assert.match(guide, /do not force spoken exposition/);
  assert.doesNotMatch(guide, /stepwise-teaching \(/);
  assert.match(craftGuide(["tutorial"]), /essential steps and usable outcome/);
  assert.match(craftGuide(["other"]), /result-first \(/);
  assert.match(craftGuide(["__proto__"]), /result-first \(/);
});

test("knowledge sources retain scope and every technique has a supported shared vocabulary", () => {
  assert.deepEqual(
    new Set(techniques.map((item) => item.id)),
    new Set(techniqueIds),
  );
  for (const item of techniques)
    for (const source of item.sources) assert.ok(craftSources[source].scope);
  assert.match(craftSources.abcd.scope, /advertising/);
  assert.match(craftSources.retention.scope, /confusion/);
  assert.match(craftGuide(), /caption synchronization/);
  assert.match(craftGuide(), /not a scorecard/);
});

test("technique notes are searchable and exported with citations while old reports remain readable", () => {
  const report = analysisSchema.parse({
    ...reportFixture(),
    craft: [note("before-after", ["F1", "F2"])],
  });
  const reel = {
    id: "craft-export",
    caption: "A folded sheet",
    shortcode: "fixture",
    analysis: { ...report, sources },
    evidence: null,
  } as Reel;
  assert.ok(
    catalogueMatches(
      buildCatalogueSearch([reel], []).get(reel.id),
      "readable before and after planter",
    ),
  );
  const markdown = reelMarkdown(reel);
  assert.match(markdown, /## Creative techniques/);
  assert.match(markdown, /Tradeoff: A different angle/);
  assert.match(markdown, /F2 \[0:10\]/);
  const old: Record<string, unknown> = { ...reportFixture() };
  delete old.craft;
  assert.ok(storedAnalysisSchema.safeParse(old).success);
  assert.equal(analysisSchema.safeParse(old).success, false);
});

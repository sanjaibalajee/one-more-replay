import test from "node:test";
import assert from "node:assert/strict";
import { evidenceSources, validateAnalysis } from "../src/lib/replay/evidence";
import { reasoningConfig, supportedEfforts } from "../src/lib/replay/models";
import { analysisSchema, storedAnalysisSchema, type MediaEvidence, type Reel } from "../src/lib/replay/types";
import { reportFixture } from "./fixtures/report";
const evidence: MediaEvidence = { duration: 12, width: 180, height: 320, hasAudio: true, frames: [{ file: "frame-00.jpg", seconds: 0 }, { file: "frame-01.jpg", seconds: 5 }], sceneChanges: [], transcript: { text: "Synthetic words.", language: "en", segments: [{ start: 0, end: 3, text: "Synthetic words." }], engine: "test", model: "base", status: "completed", note: "Synthetic fixture." }, warnings: [] };
const reel = { id: "fixture", caption: "Test caption", views: null, likes: 3, comments: null, collectedAt: "2026-10-21T00:00:00Z", evidence } as Reel;

test("evidence references resolve to exact supplied frames, transcript and recorded metrics", () => {
  const sources = evidenceSources(reel, evidence);
  assert.equal(sources.find(s => s.id === "T1")?.text, "Synthetic words.");
  assert.equal(sources.find(s => s.id === "F2")?.seconds, 5);
  assert.equal(sources.find(s => s.id === "M_views"), undefined);
  const report = analysisSchema.parse(reportFixture()); validateAnalysis(report, evidence, sources);
  report.hook.evidenceIds = ["F99"];
  assert.throws(() => validateAnalysis(report, evidence, sources), /not supplied/);
});
test("reports reject invalid shot timing, unsupported timestamps and missing critical findings", () => {
  const sources = evidenceSources(reel, evidence);
  const report = analysisSchema.parse(reportFixture());
  report.suggestedAngles[0].shotList[1].startSeconds = 0;
  assert.throws(() => validateAnalysis(report, evidence, sources), /timing/);
  const other = analysisSchema.parse(reportFixture()); other.observations[0].timestampSeconds = 13;
  assert.throws(() => validateAnalysis(other, evidence, sources), /timestamp/);
  const uncritical = analysisSchema.parse(reportFixture()); uncritical.findings = uncritical.findings.filter(f => f.kind !== "uncertainty");
  assert.throws(() => validateAnalysis(uncritical, evidence, sources), /uncertainty/);
});
test("old saved reports remain readable and new reports require three complete concepts", () => {
  const legacy = { ...reportFixture(), version: undefined, format: undefined, findings: undefined, support: undefined, suggestedAngles: [{ idea: "Old idea", opening: "Old opening", structure: "Old structure" }] };
  assert.ok(storedAnalysisSchema.parse(legacy)); assert.throws(() => analysisSchema.parse(legacy));
});
test("editorial recommendations need supplied evidence while earlier reports remain readable", () => {
  const report = analysisSchema.parse(reportFixture());
  report.editorial.changes[0].evidenceIds = ["F_missing"];
  assert.throws(() => validateAnalysis(report, evidence, evidenceSources(reel, evidence)), /not supplied/);
  const older = { ...reportFixture(), editorial: undefined };
  assert.ok(storedAnalysisSchema.parse(older));
  assert.throws(() => analysisSchema.parse(older));
});
test("reasoning controls omit defaults and reject unsupported model-effort combinations", () => {
  assert.equal(reasoningConfig("unknown-model", "default"), undefined);
  assert.deepEqual(reasoningConfig("gpt-6.1-sol", "high"), { effort: "high" });
  assert.throws(() => reasoningConfig("gpt-6.1-sol", "none"));
  assert.throws(() => reasoningConfig("unknown-model", "medium"));
  assert.ok(!supportedEfforts("gpt-5.4-mini", "openai").includes("max"));
});

test("script blocks retain exact source quotes and concepts reject incoherent sections or speech timing",()=>{
  const report=analysisSchema.parse(reportFixture()),sources=evidenceSources(reel,evidence);
  report.hook.spokenHook="This unavailable tip was never spoken.";
  assert.throws(()=>validateAnalysis(report,evidence,sources),/exact excerpt/);
  const missing=analysisSchema.parse(reportFixture());missing.storyStructure.body.startSeconds=null;missing.storyStructure.body.endSeconds=null;
  assert.throws(()=>validateAnalysis(missing,evidence,sources),/needs a timestamp/);
  const section=analysisSchema.parse(reportFixture());section.suggestedAngles[0].shotList[0].section="body";
  assert.throws(()=>validateAnalysis(section,evidence,sources),/hook, body and CTA/);
  const rushed=analysisSchema.parse(reportFixture());rushed.suggestedAngles[0].shotList[0].spokenLine=Array(100).fill("word").join(" ");
  assert.throws(()=>validateAnalysis(rushed,evidence,sources),/too many spoken words/);
  const directions=analysisSchema.parse(reportFixture());directions.suggestedAngles[0].body="Explain the change to the viewer.";
  assert.throws(()=>validateAnalysis(directions,evidence,sources),/body script must match/);
  const silent=analysisSchema.parse(reportFixture());silent.suggestedAngles[0].shotList[1].spokenLine="";silent.suggestedAngles[0].shotList[1].onScreenText=silent.suggestedAngles[0].body;
  validateAnalysis(silent,evidence,sources);
  const noHypothesis=analysisSchema.parse(reportFixture());noHypothesis.hypotheses=[];validateAnalysis(noHypothesis,evidence,sources);
});

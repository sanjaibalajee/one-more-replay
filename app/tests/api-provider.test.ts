import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { reportFixture } from "./fixtures/report";
import type { MediaEvidence, Reel, Settings } from "../src/lib/replay/types";
import { transcriptContentVersion } from "../src/lib/replay/transcript";
const directory = mkdtempSync(path.join(tmpdir(), "replay-api-")); process.env.REPLAY_DATA_DIR = directory;
const store = await import("../src/lib/replay/store");
const { analyze } = await import("../src/lib/replay/intelligence");
const { mediaDir } = await import("../src/lib/replay/paths");
const { reelMarkdown } = await import("../src/lib/replay/export");
after(() => { store.db().close(); rmSync(directory, { recursive: true, force: true }); });

test("API analysis sends image inputs, strict schema, brief and the chosen reasoning effort", async () => {
  store.saveSettings({ openaiKey: "sk-synthetic-test-key" });
  const evidence: MediaEvidence = { duration: 12, width: 10, height: 10, hasAudio: true, frames: [{ file: "frame-00.jpg", seconds: 0 }], sceneChanges: [], transcript: { text: "Synthetic words.", segments: [{ start: 0, end: 3, text: "Synthetic words." }], engine: "test", model: "base", language: "en", status: "completed", note: "Test." }, warnings: [] };
  const reel = { id: "local_api_fixture", caption: "Synthetic fixture.", views: null, likes: null, comments: null, collectedAt: new Date().toISOString(), evidence } as Reel;
  await writeFile(path.join(mediaDir(reel.id), "frame-00.jpg"), Buffer.from([1, 2, 3]));
  const settings: Settings = { provider: "openai", openaiModel: "gpt-6.1-sol", openaiEffort: "high", codexModel: "", whisperModel: "base", language: "", brandContext: "Fixture context.", brief: { business: "Repair shop", audience: "New cyclists", language: "English", tone: "Direct", constraints: "One person and phone", goal: "Repair enquiries" } };
  const originalFetch = globalThis.fetch;
  let sent: Record<string, unknown> | undefined;
  const generated = reportFixture();
  globalThis.fetch = async (request, init) => {
    assert.equal(new URL(typeof request === "string" ? request : request instanceof URL ? request.href : request.url).hostname, "api.openai.com");
    sent = JSON.parse(String(init?.body));
    return Response.json({ id: "resp_fixture", object: "response", created_at: 1, status: "completed", model: settings.openaiModel, output: [{ type: "message", id: "msg_fixture", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(generated), annotations: [] }] }] });
  };
  try {
    const response = await analyze(reel, evidence, settings, new AbortController().signal);
    assert.deepEqual(sent?.reasoning, { effort: "high" }); assert.equal(sent?.store, false);
    const body = JSON.stringify(sent); assert.match(body, /input_image/); assert.match(body, /json_schema/); assert.match(body, /One person and phone/);
    assert.match(body, /CREATIVE CRAFT KNOWLEDGE/); assert.match(body, /stepwise-teaching/); assert.match(body, /not a scorecard/);
    assert.ok(response.result.craftRevision);
    assert.equal(response.result.version, 2); assert.equal(response.result.suggestedAngles.length, 3);
    const markdown = reelMarkdown({ ...reel, analysis: response.result });
    assert.match(markdown, /## Evidence index/); assert.match(markdown, /Say: Synthetic opening 1/); assert.match(markdown, /F1 \[0:00\]/);
    generated.hook.spokenHook = "A corrected ceramic kettle.";
    const reviewed: Reel = { ...reel, transcriptReview: { revision: "review-fixture", mediaRevision: "", sourceRevision: transcriptContentVersion(evidence.transcript), updatedAt: new Date().toISOString(), corrections: [{ index: 0, text: generated.hook.spokenHook }] } };
    const corrected = await analyze(reviewed, evidence, { ...settings, openaiEffort: "default" }, new AbortController().signal);
    assert.equal(corrected.result.sources?.find(source => source.id === "T1")?.text, generated.hook.spokenHook);
    assert.equal(corrected.result.sources?.find(source => source.id === "T1")?.origin, "user-reviewed");
    assert.equal(evidence.transcript.text, "Synthetic words.");
    assert.match(JSON.stringify(sent), /A corrected ceramic kettle/);
    assert.doesNotMatch(JSON.stringify(sent), /Synthetic words\./);
    assert.equal(sent?.reasoning, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test("comparison citations require two distinct supplied Reels and valid source IDs", async () => {
  const { compare } = await import("../src/lib/replay/intelligence");
  const { evidenceSources } = await import("../src/lib/replay/evidence");
  const evidence: MediaEvidence = { duration: 12, width: 10, height: 10, hasAudio: false, frames: [{ file: "frame-v3-0-00.jpg", seconds: 0 }], sceneChanges: [], transcript: { text: "", segments: [], engine: "none", model: "", language: null, status: "no-audio", note: "Test." }, warnings: [] };
  const first: Reel = { accountId: "fixture", shortcode: "first", url: "", thumbnail: "", videoUrl: "", postedAt: null, source: "upload", status: "completed", error: null, starred: false, analysisProvider: "Synthetic fixture", analyzedAt: "2026-10-21T00:00:00Z", id: "first", caption: "Synthetic first", views: null, likes: null, comments: null, collectedAt: "2026-10-21T00:00:00Z", analysis: { ...reportFixture(), sources: [] }, evidence };
  first.analysis!.sources = evidenceSources(first, evidence);
  await writeFile(path.join(mediaDir(first.id), "frame-v3-0-00.jpg"), Buffer.from([1, 2, 3]));
  const second = { ...first, id: "second", caption: "Synthetic second" };
  const result = { title: "Synthetic comparison", summary: "A weak comparison.", patterns: [{ pattern: "A concrete object", reelIds: ["first", "second"], evidence: "Supplied frames.", howToAdapt: "Test one variable.", examples: [{ reelId: "first", evidenceIds: ["F1"] }, { reelId: "second", evidenceIds: ["F1"] }] }], differences: [], nextExperiments: [], limitations: ["Synthetic fixture."] };
  const originalFetch = globalThis.fetch;
  let comparisonInput = "";
  globalThis.fetch = async (_request, init) => { comparisonInput = String(init?.body); return Response.json({ id: "resp_comparison", object: "response", created_at: 1, status: "completed", output: [{ type: "message", id: "msg", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(result), annotations: [] }] }] }); };
  const settings: Settings = { provider: "openai", openaiModel: "gpt-6.1-sol", openaiEffort: "default", codexModel: "", whisperModel: "base", language: "", brandContext: "" };
  try {
    assert.ok((await compare([first, second], "synthetic-comparison", settings, new AbortController().signal)).result.patterns.length);
    assert.match(comparisonInput, /input_image/, "Follow-up analysis must receive versioned frame images, not only report text");
    result.patterns[0].examples[1].evidenceIds = ["F999"];
    await assert.rejects(compare([first, second], "synthetic-comparison", settings, new AbortController().signal), /unavailable evidence/);
    result.patterns[0].examples[1] = { reelId: "first", evidenceIds: ["F1"] };
    await assert.rejects(compare([first, second], "synthetic-comparison", settings, new AbortController().signal), /missing linked/);
  } finally { globalThis.fetch = originalFetch; }
});

test("saved comparisons retain the baseline snapshot used by the model when catalogue metrics change during generation",async()=>{
  const {enqueue}=await import("../src/lib/replay/jobs"),{evidenceSources}=await import("../src/lib/replay/evidence");
  const now="2026-10-22T00:00:00Z",account=store.addAccount("baseline_race_fixture");
  const evidence:MediaEvidence={duration:12,width:10,height:10,hasAudio:false,frames:[{file:"frame-00.jpg",seconds:0}],sceneChanges:[],transcript:{text:"",segments:[],engine:"none",model:"",language:null,status:"no-audio",note:"Synthetic fixture"},warnings:[]};
  const make=(id:string,views:number):Reel=>({id,accountId:account.id,shortcode:id,url:`https://www.instagram.com/reel/${id}/`,caption:"Synthetic comparison race fixture",thumbnail:"",videoUrl:"",views,likes:null,comments:null,postedAt:"2026-10-10T00:00:00Z",collectedAt:now,source:"import",status:"completed",error:null,starred:false,evidence,analysis:{...reportFixture(),sources:[]},analysisProvider:"fixture",analyzedAt:now});
  const targets=[make("race_first",200),make("race_second",300)],peers=Array.from({length:8},(_,i)=>make(`race_peer_${i}`,100));
  for(const r of [...targets,...peers]){r.analysis!.sources=evidenceSources(r,evidence);store.saveReel(r);}
  store.saveSettings({provider:"openai",openaiKey:"sk-synthetic-key",openaiModel:"gpt-6.1-sol",openaiEffort:"default"});
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{for(const peer of peers)store.saveReel({...peer,views:1000});return Response.json({id:"resp_race",object:"response",status:"completed",output:[{type:"message",id:"msg_race",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({title:"Synthetic comparison",summary:"A small selected sample",patterns:[],differences:[],nextExperiments:[],limitations:["Synthetic fixture"]}),annotations:[]}]}]});};
  try{
    const job=enqueue("compare",null,targets.map(r=>r.id));
    for(let i=0;i<100 && !["completed","failed"].includes(store.getJob(job.id)!.phase);i++)await new Promise(r=>setTimeout(r,10));
    const finished=store.getJob(job.id)!;assert.equal(finished.phase,"completed",JSON.stringify(finished.errors));
    assert.deepEqual(store.getComparison(finished.resultId!)?.context?.rows.map(r=>r.multiple),[2,3]);
  }finally{globalThis.fetch=originalFetch;}
});

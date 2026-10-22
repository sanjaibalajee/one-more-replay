// Explicit integration check: uses the signed-in Codex plan with synthetic source reports.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import path from "node:path";
import { reportFixture } from "./fixtures/report";
import type { Reel, MediaEvidence } from "../src/lib/replay/types";
const dir=mkdtempSync(path.resolve("../.local/live-research-"));process.env.REPLAY_DATA_DIR=dir;
const {addAccount,saveReel,saveSettings,getJob,getReel,snapshot}=await import("../src/lib/replay/store");
const {enqueue}=await import("../src/lib/replay/jobs");
const {evidenceSources}=await import("../src/lib/replay/evidence");
saveSettings({provider:"codex",codexModel:"",codexEffort:"medium",brief:{business:"Independent home cooking creator sharing practical kitchen experiments",audience:"Busy new cooks in Tamil Nadu",language:"English",tone:"Calm, concrete, lightly playful",constraints:"One person, phone, home kitchen, no paid actors, no fabricated food safety claims, 45 minutes",goal:"Recipe saves and useful comments"}});
const a=addAccount("synthetic_home_cook","own"),b=addAccount("synthetic_peer_cook","competitor");
function example(id:string,accountId:string,seconds:number):Reel {
 const evidence:MediaEvidence={duration:seconds,width:180,height:320,hasAudio:true,frames:[{file:"frame-00.jpg",seconds:0}],sceneChanges:[],transcript:{text:"Same onion. Two cuts. Which softens first?",segments:[{start:0,end:3,text:"Same onion. Two cuts. Which softens first?"}],language:"en",engine:"fixture",model:"base",status:"completed",note:"Synthetic report-only fixture, not a real clip."},warnings:["Synthetic report-only evidence"]};
 const report=reportFixture();report.title=id==="own" ? "Synthetic onion prep explanation" : "Synthetic onion result-first demonstration";report.hook={label:"Two onion cuts compared",spokenHook:evidence.transcript.text,visualHook:"Synthetic report describes two onion cuts on a board.",explanation:"A specific comparison creates a testable question.",evidenceIds:["F1","T1"]};report.summary="Synthetic report: a home cook compares two onion cuts. This is test evidence, not a real video.";
 const r:Reel={id:`synthetic_${id}`,accountId,shortcode:id,url:"",caption:report.title,thumbnail:"",videoUrl:"",views:null,likes:null,comments:null,postedAt:null,collectedAt:new Date().toISOString(),source:"import",platform:"instagram",status:"completed",error:null,starred:false,evidence,analysis:report,analysisProvider:"Synthetic fixture",analyzedAt:new Date().toISOString()};r.analysis!.sources=evidenceSources(r,evidence);return r;
}
saveReel(example("own",a.id,12));saveReel(example("peer",b.id,15));
const adapt=enqueue("adapt",null,["synthetic_peer"],{topic:"Show why the shape of a vegetable cut matters, without copying the onion experiment"});
async function done(id:string) {while(true){const j=getJob(id)!;if(["completed","failed","cancelled"].includes(j.phase)){assert.equal(j.phase,"completed",JSON.stringify(j.errors));return j;}await new Promise(r=>setTimeout(r,1000));}}
const adapted=await done(adapt.id);const first=snapshot().research.find(r=>r.id===adapted.resultId)!;assert.equal(first.kind,"adapt");assert.ok(getReel("synthetic_peer")?.analysis);
console.log(JSON.stringify({kind:first.kind,title:first.report.title,concepts:first.kind==="adapt" ? first.report.concepts.map(c=>({idea:c.idea,opening:c.opening,shots:c.shotList.length})) : [],directory:dir}));
const gap=enqueue("gap",null,["synthetic_own","synthetic_peer"],{ownIds:["synthetic_own"]});const finished=await done(gap.id);const second=snapshot().research.find(r=>r.id===finished.resultId)!;assert.equal(second.kind,"gap");
console.log(JSON.stringify({kind:second.kind,title:second.report.title,matchedPairs:second.kind==="gap" ? second.context.matchedPairs : 0,gaps:second.kind==="gap" ? second.report.gaps.length : 0,experiments:second.kind==="gap" ? second.report.experiments.length : 0}));

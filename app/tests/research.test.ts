import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { reportFixture } from "./fixtures/report";
import { analyticsGroups, gapContext, hookFor } from "../src/lib/replay/research";
import { evidenceSources } from "../src/lib/replay/evidence";
import type { Reel, Settings, MediaEvidence } from "../src/lib/replay/types";
const directory=mkdtempSync(path.join(tmpdir(),"replay-research-")); process.env.REPLAY_DATA_DIR=directory;
const store=await import("../src/lib/replay/store");
const {parseVideoLink,addVideoLink,linkMetadata,safeThumbnailUrl}=await import("../src/lib/replay/links");
const {adaptPattern,analyzeGaps,validateGap}=await import("../src/lib/replay/research-intelligence");
const {handleResearch}=await import("../src/lib/replay/research-api");
const {performanceFor,normalizeReel}=await import("../src/lib/replay/catalogue");
after(()=>{store.db().close();rmSync(directory,{recursive:true,force:true});});
const evidence: MediaEvidence={duration:12,width:180,height:320,hasAudio:true,frames:[{file:"frame-00.jpg",seconds:0}],sceneChanges:[],transcript:{text:"Synthetic words.",segments:[{start:0,end:3,text:"Synthetic words."}],language:"en",engine:"fixture",model:"base",status:"completed",note:"Synthetic evidence."},warnings:[]};
function reel(id:string,accountId=id):Reel { const r:Reel={id,accountId,platform:"instagram",shortcode:id,url:`https://www.instagram.com/reel/${id}/`,caption:"Synthetic test.",thumbnail:"",videoUrl:"",views:null,likes:null,comments:null,postedAt:null,collectedAt:"2026-10-22T00:00:00Z",source:"import",status:"completed",error:null,starred:false,evidence,analysis:reportFixture(),analysisProvider:"test",analyzedAt:"2026-10-22T00:00:00Z"};r.analysis!.sources=evidenceSources(r,evidence);return r; }
const settings:Settings={provider:"openai",openaiModel:"gpt-6.1-sol",codexModel:"",whisperModel:"base",language:"",brandContext:"",brief:{business:"Independent cooking creator",audience:"New cooks",language:"Tamil",tone:"Direct",constraints:"One person, phone, home kitchen",goal:"Recipe saves"}};

test("single links canonicalize across platforms and reject profiles, credentials, playlists and arbitrary hosts",()=>{
  const ig=parseVideoLink("https://instagram.com/reel/LinkFixture/?igsh=tracking");
  assert.equal(ig.url,"https://www.instagram.com/reel/LinkFixture/");assert.equal(ig.id,normalizeReel({url:ig.url},"account","import")?.id);
  assert.equal(parseVideoLink("https://youtu.be/abcdefghijk?si=tracking").id,parseVideoLink("https://www.youtube.com/shorts/abcdefghijk").id);
  assert.equal(parseVideoLink("https://www.tiktok.com/@creator/video/1234567890123456789?x=1").platform,"tiktok");
  for(const url of ["http://instagram.com/reel/a/","https://evil.example/reel/a/","https://www.instagram.com/profile/","https://youtube.com/playlist?list=test","https://www.youtube.com@127.0.0.1/shorts/abcdefghijk","https://youtube.com:444/shorts/abcdefghijk","https://vm.tiktok.com/random/"])assert.throws(()=>parseVideoLink(url));
  assert.throws(()=>safeThumbnailUrl("https://127.0.0.1/image.jpg"));assert.equal(new URL(safeThumbnailUrl("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg")).hostname,"i.ytimg.com");
});
test("adding a duplicate link preserves reports and unknown metrics, and inboxes never pool creators into baselines",()=>{
  const first=addVideoLink("https://www.youtube.com/shorts/abcdefghijk"); assert.equal(first.existing,false);
  store.saveReel({...first.reel,analysis:reportFixture(),starred:true});
  const duplicate=addVideoLink("https://youtu.be/abcdefghijk?si=tracking");assert.equal(duplicate.existing,true);assert.equal(duplicate.reel.starred,true);assert.ok(duplicate.reel.analysis);
  const meta=linkMetadata(first.reel,{title:"A video",duration:30,view_count:null,like_count:0,uploader_id:"creator-a",uploader:"Creator A"});
  assert.equal(meta.views,null);assert.equal(meta.likes,0);assert.equal(meta.postedAt,null);assert.equal(meta.creatorKey,"youtube:creator-a");
  const others=Array.from({length:8},(_,i)=>({...meta,id:`other${i}`,views:100,creatorKey:"youtube:creator-b"}));
  assert.equal(performanceFor({...meta,views:1000},others).sampleSize,0);
  assert.equal(performanceFor({...meta,creatorKey:undefined,views:1000},others).multiple,null);
});
test("collecting a previously saved Instagram link moves it from the inbox into its creator account while retaining notes and reports",()=>{
  const linked=addVideoLink("https://www.instagram.com/reel/MovingLinkFixture/").reel;
  store.saveReel({...linked,analysis:reportFixture(),annotation:{notes:"Keep this insight",tags:[],hookType:"question",ctaType:"unknown"}});
  const account=store.addAccount("link_owner");const imported=normalizeReel({url:linked.url,caption:"Updated from collection"},account.id,"import")!;
  store.ingest([imported]);assert.equal(store.getReel(linked.id)?.accountId,account.id);assert.equal(store.getReel(linked.id)?.annotation?.notes,"Keep this insight");assert.ok(store.getReel(linked.id)?.analysis);
});
test("analytics preserve unknowns and count categories separately from performance evidence",()=>{
  const a=reel("analytic-a"),b={...reel("analytic-b"),analysis:null,evidence:null};
  assert.equal(analyticsGroups([a,b],"hook").find(g=>g.key==="unknown")?.count,1);
  assert.equal(analyticsGroups([a,b],"hook").find(g=>g.key==="demonstration")?.medianMultiple,null);
  a.annotation={notes:"Test",tags:[],hookType:"question",ctaType:"unknown"};assert.equal(hookFor(a),"question");
  assert.equal(analyticsGroups([a,b],"length").reduce((n,g)=>n+g.count,0),2);
  const unknown=analyticsGroups([{...a,source:"link",creatorKey:undefined}],"hook")[0];assert.equal(unknown.creators,0);assert.equal(unknown.unknownCreators,1);
});
test("collections, role changes and annotation survive refresh without changing existing reports",async()=>{
  const account=store.addAccount("research_fixture","own"),r=reel("CollectionFixture",account.id);store.saveReel(r);
  const c=await handleResearch({action:"collection",name:"Specific openings",description:"Phone shoots"}).json();
  handleResearch({action:"collection-add",id:c.id,reelIds:[r.id]});handleResearch({action:"collection-add",id:c.id,reelIds:[r.id]});
  handleResearch({action:"annotate",reelId:r.id,annotation:{notes:"Start with the result",tags:["phone"],hookType:"result-first",ctaType:"save"}});
  store.ingest([{...r,caption:"Updated metadata",analysis:null}]);
  assert.equal(store.getReel(r.id)?.annotation?.notes,"Start with the result");assert.ok(store.getReel(r.id)?.analysis);assert.equal(store.snapshot().collections[0].reelIds.length,1);
  handleResearch({action:"role",accountId:account.id,role:"inspiration"});assert.equal(store.getAccount(account.id)?.role,"inspiration");
  handleResearch({action:"collection-delete",id:c.id});assert.ok(store.getReel(r.id)?.analysis);assert.equal(store.getCollections().length,0);
});
test("gap claims require a matched own/peer pair and exact source IDs, while unmatched samples allow exploratory tests",()=>{
  const own=reel("own"),peer=reel("peer");
  const report={title:"Gap test",summary:"Selected examples only",gaps:[{title:"A result first",observation:"Difference in this sample",opportunity:"Test a result",confidence:"low" as const,own:{reelId:own.id,evidenceIds:["F1"]},competitor:{reelId:peer.id,evidenceIds:["T1"]}}],experiments:reportFixture().suggestedAngles.map(concept=>({concept,source:{reelId:peer.id,evidenceIds:["F1"]}})),limitations:["Synthetic evidence"]};
  assert.equal(gapContext([own],[peer]).matchedPairs,1);validateGap(report,[own],[peer]);
  const mismatched={...peer,platform:"youtube" as const};assert.equal(gapContext([own],[mismatched]).matchedPairs,0);assert.throws(()=>validateGap(report,[own],[mismatched]),/unmatched/);
  validateGap({...report,gaps:[]},[own],[mismatched]);
  report.gaps[0].own.evidenceIds=["F999"];assert.throws(()=>validateGap(report,[own],[peer]),/unavailable/);
});
test("adaptation and gap API generation use strict schema, creator brief and source validation",async()=>{
  store.saveSettings({openaiKey:"sk-synthetic-key"});const own=reel("own-api"),peer=reel("peer-api");
  const {mediaDir}=await import("../src/lib/replay/paths");writeFileSync(path.join(mediaDir(peer.id),"frame-00.jpg"),Buffer.from([1,2,3]));
  let output:unknown={title:"Three adaptations",mechanism:"Result before explanation",evidenceIds:["F1"],assumptions:[],concepts:reportFixture().suggestedAngles,limitations:["Synthetic source"]};
  const original=globalThis.fetch;let body="";
  globalThis.fetch=async(_request,init)=>{body=String(init?.body);return Response.json({id:"resp_test",object:"response",status:"completed",output:[{type:"message",id:"msg",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify(output),annotations:[]}]}]});};
  try {
    assert.equal((await adaptPattern(peer,"A kitchen test","adapt-test",settings,new AbortController().signal)).result.concepts.length,3);assert.match(body,/home kitchen/);assert.match(body,/json_schema/);assert.match(body,/input_image/);assert.match(body,/ATTACHED IMAGE INDEX/);assert.ok(!body.includes("Synthetic concept 1"));
    output={...(output as object),evidenceIds:["F999"]};await assert.rejects(adaptPattern(peer,"A test","adapt-test",settings,new AbortController().signal),/unavailable/);
    output={title:"Exploratory tests",summary:"A sample only",gaps:[],experiments:reportFixture().suggestedAngles.map(concept=>({concept,source:{reelId:peer.id,evidenceIds:["F1"]}})),limitations:["Small selected sample"]};
    const result=await analyzeGaps([own],[peer],"gap-test",settings,new AbortController().signal);assert.equal(result.context.matchedPairs,1);assert.equal(result.result.experiments.length,3);
  } finally {globalThis.fetch=original;}
});

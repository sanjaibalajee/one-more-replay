import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { reportFixture } from "./fixtures/report";
import type { Reel } from "../src/lib/replay/types";
const directory=mkdtempSync(path.join(tmpdir(),"replay-p1-"));process.env.REPLAY_DATA_DIR=path.join(directory,"data");
const originalPath=process.env.PATH,bin=path.join(directory,"bin"),gate=path.join(directory,"probe-started"),release=path.join(directory,"release");mkdirSync(bin);
writeFileSync(path.join(bin,"ffprobe"),`#!/usr/bin/env node
const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(gate)},'ready');
const interval=setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)})){clearInterval(interval);console.log(JSON.stringify({format:{duration:'12'},streams:[{codec_type:'video'}]}));}},5);`,{mode:0o700});
writeFileSync(path.join(bin,"ffmpeg"),`#!/usr/bin/env node
require('node:fs').writeFileSync(process.argv.at(-1),'Synthetic normalized fixture');`,{mode:0o700});
process.env.PATH=bin+path.delimiter+originalPath;
const store=await import("../src/lib/replay/store");
const {enqueue}=await import("../src/lib/replay/jobs");
const {POST:upload}=await import("../src/app/api/replay/upload/route");
after(()=>{process.env.PATH=originalPath;store.db().close();rmSync(directory,{recursive:true,force:true});});
const account=store.addAccount("synthetic_p1");
const make=(id:string):Reel=>({id,accountId:account.id,shortcode:id,url:`https://www.instagram.com/reel/${id}/`,caption:"Synthetic fixture",thumbnail:"",videoUrl:"",views:null,likes:null,comments:null,postedAt:null,collectedAt:new Date().toISOString(),source:"import",status:"idle",error:null,starred:false,evidence:null,analysis:null,analysisProvider:null,analyzedAt:null});
async function waitFor(check:()=>boolean){for(let i=0;i<500;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw new Error("Timed out waiting for synthetic fixture");}
test("upload reservations preserve concurrent research edits and reject overlapping uploads and jobs",async()=>{
 const reel=make("upload_race");store.saveReel(reel);
 const request=()=>{const form=new FormData();form.set("reelId",reel.id);form.set("file",new File(["Synthetic fixture"],"fixture.mp4"));return new Request("http://127.0.0.1:3210/api/replay/upload",{method:"POST",body:form});};
 const pending=upload(request());await waitFor(()=>existsSync(gate));
 const overlap=await upload(request());assert.equal(overlap.status,400);assert.match(await overlap.text(),/being replaced/);
 assert.throws(()=>enqueue("analyze",null,[reel.id]),/being replaced/);
 store.saveReel({...store.getReel(reel.id)!,starred:true,caption:"Metadata refreshed during upload",annotation:{notes:"Keep this note",tags:["fixture"],hookType:"question",ctaType:"follow"}});
 writeFileSync(release,"continue");const response=await pending;assert.equal(response.status,201,await response.text());
 const saved=store.getReel(reel.id)!;assert.equal(saved.starred,true);assert.equal(saved.annotation?.notes,"Keep this note");assert.equal(saved.caption,"Metadata refreshed during upload");assert.ok(saved.mediaRevision);
 const next=await upload(request());assert.equal(next.status,201,"Reservation must release on completion");
});
test("queued analysis retains provider, model, brief and effort; changed credentials fail closed",async()=>{
 const first={...make("compare_a"),analysis:{...reportFixture(),sources:[{id:"F1",kind:"frame" as const,label:"Frame",seconds:0,text:"Synthetic frame"},{id:"T1",kind:"transcript" as const,label:"ASR",seconds:0,text:"Synthetic words."}]},analyzedAt:"2026-10-22T00:00:00Z"};
 const second={...first,id:"compare_b"};store.saveReel(first);store.saveReel(second);
 store.saveSettings({provider:"openai",openaiKey:"sk-synthetic-before",apifyToken:"apify_api_synthetic",openaiModel:"gpt-6.1-sol",openaiEffort:"high",brandContext:"Original queued context",brief:{business:"Original business",audience:"Original audience",language:"English",tone:"Plain",constraints:"Phone",goal:"Replies"}});
 const originalFetch=globalThis.fetch;let unblock!:()=>void,finishModel!:()=>void;const gate=new Promise<void>(r=>unblock=r),modelGate=new Promise<void>(r=>finishModel=r);let sent:Record<string,unknown>|undefined;
 globalThis.fetch=async(request,init)=>{const url=String(request instanceof Request?request.url:request);if(url.includes("/acts/")){await gate;return Response.json({data:{id:"fixture-run",status:"SUCCEEDED",defaultDatasetId:"fixture"}});}if(url.includes("/datasets/"))return Response.json([]);assert.ok(url.startsWith("https://api.openai.com/"));sent=JSON.parse(String(init?.body));await modelGate;return Response.json({id:"fixture",object:"response",model:"gpt-6.1-sol",output:[{type:"message",id:"msg",role:"assistant",status:"completed",content:[{type:"output_text",text:JSON.stringify({title:"Synthetic comparison",summary:"Synthetic",patterns:[],differences:[],nextExperiments:[],limitations:[]}),annotations:[]}]}]});};
 try{
   enqueue("collect",account.id,[],{limit:10});const job=enqueue("compare",null,[first.id,second.id]);assert.equal(store.getJob(job.id)?.phase,"queued");
   store.saveSettings({provider:"codex",codexModel:"gpt-6-astra",brandContext:"Changed context",brief:{business:"Changed",audience:"Changed",language:"Tamil",tone:"Changed",constraints:"Changed",goal:"Changed"}});unblock();
   await waitFor(()=>Boolean(sent));
   const running=store.activity().jobs.find(j=>j.id===job.id)!;
   assert.equal(running.execution?.model,"gpt-6.1-sol");assert.equal(running.execution?.reasoningEffort,"high");assert.ok((running.execution?.rates.input ?? 0)>0);assert.equal(running.usage,undefined);
   finishModel();
   await waitFor(()=>["completed","failed"].includes(store.getJob(job.id)!.phase));assert.equal(store.getJob(job.id)?.phase,"completed");
   assert.equal(sent?.model,"gpt-6.1-sol");assert.deepEqual(sent?.reasoning,{effort:"high"});assert.match(JSON.stringify(sent),/Original queued context/);assert.ok(!JSON.stringify(sent).includes("Changed context"));
   const {captureRunSettings,assertConnection}=await import("../src/lib/replay/run-config");const config=captureRunSettings("compare");store.saveSettings({openaiKey:"sk-synthetic-rotated"});assert.throws(()=>assertConnection({...config,connectionId:(awaitHash("sk-synthetic-before"))},store.privateSettings().openaiKey),/connection changed/);
   const publicData=JSON.stringify(store.snapshot());assert.ok(!publicData.includes("sk-synthetic-before"));assert.ok(!publicData.includes("sk-synthetic-rotated"));
 }finally{unblock();finishModel();globalThis.fetch=originalFetch;}
});
import { createHash } from "node:crypto";
const awaitHash=(key:string)=>createHash("sha256").update(key).digest("hex");
test("activity polling excludes report payloads and transient statuses do not invalidate catalogue content",()=>{
 const reel=store.getReel("compare_a")!,before=store.workspaceRevision();store.saveReel({...reel,status:"extracting"});assert.equal(store.workspaceRevision(),before);
 const activity=store.activity();assert.equal(activity.reels.find(r=>r.id===reel.id)?.status,"extracting");assert.ok(!JSON.stringify(activity).includes("Synthetic report fixture"));
 store.saveReel({...store.getReel(reel.id)!,views:250});assert.notEqual(store.workspaceRevision(),before);assert.ok(store.snapshot().reels.find(r=>r.id===reel.id)?.performance);
});

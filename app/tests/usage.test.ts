import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const directory=mkdtempSync(path.join(tmpdir(),"replay-usage-"));process.env.REPLAY_DATA_DIR=directory;
const {tokenUsage,codexUsage,recordUsage,unknownTokens}=await import("../src/lib/replay/usage");
const {estimateCost}=await import("../src/lib/replay/pricing");
const store=await import("../src/lib/replay/store");
after(()=>{store.db().close();rmSync(directory,{recursive:true,force:true});});
const rates={source:"synthetic",fetchedAt:"2026-10-22T00:00:00Z",models:{fixture:{input_cost_per_token:0.000002,cache_read_input_token_cost:0.0000002,output_cost_per_token:0.00001,input_cost_per_token_above_200k_tokens:0.000004,cache_read_input_token_cost_above_200k_tokens:0.0000004,output_cost_per_token_above_200k_tokens:0.00002}}};
test("usage preserves unknowns and treats cached and reasoning tokens as subsets",()=>{
 const usage=tokenUsage({input_tokens:10000,output_tokens:2000,input_tokens_details:{cached_tokens:8000},output_tokens_details:{reasoning_tokens:1000}});
 assert.equal(usage.totalTokens,12000);assert.equal(usage.reasoningTokens,1000);
 assert.ok(Math.abs(estimateCost("fixture",usage,"default",rates).estimatedUsd!-0.0256)<1e-10);
 assert.equal(tokenUsage(undefined).totalTokens,null);
 assert.equal(tokenUsage({input_tokens:10,output_tokens:3,cached_input_tokens:11},true).cachedInputTokens,null);
 assert.equal(estimateCost("missing",usage,"default",rates).estimatedUsd,null);
 assert.equal(estimateCost("fixture",unknownTokens(),"default",rates).estimatedUsd,null);
 assert.equal(estimateCost("fixture",usage,"priority",rates).estimatedUsd,null);
 assert.equal(estimateCost(null,usage,"default",rates).estimatedUsd,null);
 const long={...usage,inputTokens:300000,cachedInputTokens:200000,totalTokens:302000};
 assert.ok(Math.abs(estimateCost("fixture",long,"default",rates).estimatedUsd!-0.52)<1e-10);
});
test("Codex JSON events aggregate only reported completed turns and keep missing counts unknown",()=>{
 const parsed=codexUsage('noise\n'+JSON.stringify({type:"turn.completed",usage:{input_tokens:100,cached_input_tokens:80,output_tokens:20,reasoning_output_tokens:5}})+'\n'+JSON.stringify({type:"turn.completed",usage:{input_tokens:50,cached_input_tokens:20,output_tokens:10}}));
 assert.equal(parsed.tokens.totalTokens,180);assert.equal(parsed.tokens.cachedInputTokens,100);assert.equal(parsed.tokens.reasoningTokens,null);assert.equal(parsed.model,null);
 assert.equal(codexUsage('{"type":"turn.failed"}').tokens.totalTokens,null);
});
test("usage receipts survive report validation failures and preserve pricing at recording time",async()=>{
 store.saveSettings({provider:"openai",openaiKey:"sk-synthetic",openaiModel:"gpt-6.1-sol"});
 const {structured}=await import("../src/lib/replay/intelligence"),{z}=await import("zod");
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({id:"synthetic",object:"response",model:"gpt-6.1-sol",usage:{input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:500},output_tokens_details:{reasoning_tokens:50}},output:[{type:"message",id:"msg",role:"assistant",status:"completed",content:[{type:"output_text",text:'{"wrong":true}',annotations:[]}]}]});
 try{await assert.rejects(structured("fixture",z.object({required:z.string()}),"Synthetic",[],directory,store.privateSettings(),new AbortController().signal));assert.equal(store.getUsage().length,1);assert.equal(store.getUsage()[0].totalTokens,1100);assert.ok(store.getUsage()[0].estimatedUsd!>0);}
 finally{globalThis.fetch=original;}
 const sub=recordUsage({...store.privateSettings(),provider:"codex",codexModel:""},"fixture",unknownTokens(),null,"failed");
 assert.equal(sub.costKind,"api-equivalent");assert.equal(sub.estimatedUsd,null);assert.equal(sub.model,null);
});
test("completed CLI turns use their own context thresholds and historical models stay unknown",()=>{
 const turn=tokenUsage({input_tokens:150000,cached_input_tokens:50000,output_tokens:1000,reasoning_output_tokens:0},true);
 const sum={inputTokens:300000,cachedInputTokens:100000,outputTokens:2000,reasoningTokens:0,totalTokens:302000};
 const settings={...store.privateSettings(),provider:"codex" as const,codexModel:"gpt-6.1-sol",codexEffort:"medium" as const};
 const combined=recordUsage(settings,"fixture",sum,null,"response","default",undefined,[turn,turn]);
 const one=estimateCost("gpt-6.1-sol",turn).estimatedUsd;
 assert.ok(one!==null);assert.ok(Math.abs(combined.estimatedUsd!-one*2)<1e-10);
 assert.equal(combined.reasoningEffort,"medium");assert.equal(combined.effortSource,"requested");
 assert.equal(codexUsage('{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1,"cached_input_tokens":0}}').model,null);
});

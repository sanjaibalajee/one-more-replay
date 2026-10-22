import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";

const directory = mkdtempSync(path.join(tmpdir(), "replay-codex-contract-"));
process.env.REPLAY_DATA_DIR = directory;
process.env.CODEX_BIN = path.join(directory, "codex-fixture");
process.env.REPLAY_CODEX_TEST_LOG = path.join(directory, "calls.jsonl");
// An isolated fake CLI exercises the public protocol and execution arguments, without a login or inference.
writeFileSync(process.env.CODEX_BIN, `#!/usr/bin/env node
const fs = require('node:fs'), readline = require('node:readline');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.REPLAY_CODEX_TEST_LOG, JSON.stringify({args,hasApiKey:!!process.env.OPENAI_API_KEY})+'\\n');
if(args[0]==='login') { console.log('Logged in using ChatGPT'); process.exit(0); }
if(args[0]==='app-server') {
  readline.createInterface({input:process.stdin}).on('line', line => {
    const m=JSON.parse(line);
    if(m.method==='initialize') process.stdout.write(JSON.stringify({id:m.id,result:{}})+'\\n');
    if(m.method==='model/list') {
      const item={model:'gpt-6.1-sol',displayName:'Synthetic analyst',description:'Synthetic fixture',inputModalities:['text','image'],isDefault:true,defaultReasoningEffort:'low',supportedReasoningEfforts:[{reasoningEffort:'low'},{reasoningEffort:'medium'},{reasoningEffort:'ultra'}]};
      const response=JSON.stringify({id:m.id,result:{data:m.params.cursor ? [{...item,model:'audio-only',inputModalities:['audio'],isDefault:false},{...item,model:'hidden',hidden:true}] : [item],nextCursor:m.params.cursor ? null : 'page2'}})+'\\n';
      process.stdout.write(response.slice(0,12)); setTimeout(()=>process.stdout.write(response.slice(12)),5);
    }
  });
} else if(args[0]==='exec') {
  let prompt='';process.stdin.on('data',c=>prompt+=c);process.stdin.on('end',()=>{
    console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1000,cached_input_tokens:500,output_tokens:100,reasoning_output_tokens:25}}));
    if(prompt.includes('FAIL_FIXTURE')) { console.log(JSON.stringify({type:'turn.failed',error:{message:"You've hit your usage limit. Visit https://chatgpt.com/settings/usage"}}));console.error('Unrelated local diagnostics');process.exitCode=1; }
    else fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify({answer:'Synthetic report'}));
  });
}
`, { mode: 0o700 });
const { codexModels } = await import("../src/lib/replay/codex-models");
const { prepareModelExecution } = await import("../src/lib/replay/model-execution");
const { structured } = await import("../src/lib/replay/intelligence");
const store = await import("../src/lib/replay/store");
const signal = () => new AbortController().signal;
after(() => { store.db().close(); rmSync(directory, { recursive: true, force: true }); });

test("Codex discovery handles split JSONL and pagination and exposes only image-capable visible models", async () => {
  const models = await codexModels(signal());
  assert.equal(models.length, 1);
  assert.equal(models[0].id, "gpt-6.1-sol");
  assert.deepEqual(models[0].efforts, ["low", "medium", "ultra"]);
});
test("a default Codex run pins discovered model and effort and records their provenance", async () => {
  process.env.OPENAI_API_KEY = "sk-synthetic-never-forward";
  try {
    const response = await structured("fixture", z.object({ answer: z.string() }), "Synthetic report", [], directory, { ...store.privateSettings(), codexEffort: "default" }, signal());
    assert.equal(response.usage.model, "gpt-6.1-sol");
    assert.equal(response.usage.modelSource, "resolved-default");
    assert.equal(response.usage.reasoningEffort, "low");
    assert.equal(response.usage.effortSource, "catalogue-default");
    assert.equal(response.usage.totalTokens, 1100);
    assert.ok(response.usage.estimatedUsd! > 0);
    const calls = readFileSync(process.env.REPLAY_CODEX_TEST_LOG!, "utf8").trim().split("\n").map(line => JSON.parse(line));
    const call = calls.findLast(call => call.args[0] === "exec");
    assert.equal(call.hasApiKey, false);
    assert.equal(call.args[call.args.indexOf("--model") + 1], "gpt-6.1-sol");
    assert.ok(call.args.includes('model_reasoning_effort="low"'));
    assert.ok(call.args.includes("--ignore-user-config"));
    assert.equal(call.args[call.args.indexOf("--sandbox") + 1], "read-only");
    assert.ok(call.args.includes("shell_tool"));
    assert.ok(calls.every(call => !call.args.includes("config/read")));
  } finally { delete process.env.OPENAI_API_KEY; }
});
test("Codex validates effort against CLI capabilities and retains reported usage on a failed exit", async () => {
  await assert.rejects(prepareModelExecution({ ...store.privateSettings(), codexEffort: "high" }, signal()), /does not advertise high/);
  await assert.rejects(structured("fixture", z.object({ answer: z.string() }), "FAIL_FIXTURE", [], directory, { ...store.privateSettings(), codexEffort: "ultra" }, signal()), /Codex subscription usage limit reached/);
  const usage = store.getUsage()[0];
  assert.equal(usage.outcome, "failed");
  assert.equal(usage.totalTokens, 1100);
  assert.equal(usage.reasoningEffort, "ultra");
  assert.ok(usage.estimatedUsd! > 0);
});
test("Codex model discovery respects cancellation without starting an analysis", async () => {
  const controller = new AbortController();
  const result = codexModels(controller.signal);
  controller.abort();
  await assert.rejects(result, /Cancelled/);
});

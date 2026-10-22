#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const base = process.env.REPLAY_URL || "http://127.0.0.1:3210";
const [command, ...args] = process.argv.slice(2);
const help = `One More Replay — control your local research desk\n\nStart the app with npm run dev, then:\n  npm run replay -- status\n  npm run replay -- accounts\n  npm run replay -- add @handle [own|competitor|inspiration]\n  npm run replay -- role ACCOUNT_ID own\n  npm run replay -- profile ACCOUNT_ID\n  npm run replay -- link VIDEO_URL\n  npm run replay -- resolve REEL_ID\n  npm run replay -- collections\n  npm run replay -- collection NAME\n  npm run replay -- save COLLECTION_ID REEL_ID [...]\n  npm run replay -- adapt REEL_ID "specific topic"\n  npm run replay -- gap OWN_ID[,OWN_ID] PEER_ID[,PEER_ID]\n  npm run replay -- research [REPORT_ID]\n  npm run replay -- collect ACCOUNT_ID [limit=50]\n  npm run replay -- import ACCOUNT_ID file.json\n  npm run replay -- reels [ACCOUNT_ID]\n  npm run replay -- analyze REEL_ID [REEL_ID ...]\n  npm run replay -- compare REEL_ID REEL_ID [...]\n  npm run replay -- jobs\n  npm run replay -- usage\n  npm run replay -- ideas\n  npm run replay -- idea IDEA_ID\n  npm run replay -- cancel JOB_ID\n  npm run replay -- report REEL_ID\n  npm run replay -- comparison COMPARISON_ID\n\nCodex can use these commands in this repository to operate the app. Analyze, compare, adapt and gap start AI work. Collection uses Apify credits.\n`;
async function api(payload) {
  const response = await fetch(`${base}/api/replay`, payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : undefined);
  const result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`); return result;
}
try {
  if (!command || command === "help" || command === "--help") { console.log(help); process.exit(0); }
  let result;
  if (command === "status") { const r = await fetch(`${base}/api/replay?health=1`); if (!r.ok) throw new Error(`HTTP ${r.status}`); result = await r.json(); }
  else if (command === "add") result = await api({ action: "account", handle: args[0], role: args[1] || "competitor" });
  else if (command === "profile") result = await api({action:"profile",accountId:args[0]});
  else if (command === "role") result = await api({action:"role",accountId:args[0],role:args[1]});
  else if (command === "link") result = await api({action:"link",url:args[0]});
  else if (command === "resolve") result = await api({action:"resolve",reelId:args[0]});
  else if (command === "collection") result = await api({action:"collection",name:args.join(" ")});
  else if (command === "save") result = await api({action:"collection-add",id:args[0],reelIds:args.slice(1)});
  else if (command === "adapt") result = await api({action:"adapt",reelId:args[0],topic:args.slice(1).join(" ")});
  else if (command === "gap") result = await api({action:"gap",ownIds:(args[0] || "").split(","),competitorIds:(args[1] || "").split(",")});
  else if (command === "collect") result = await api({ action: "collect", accountId: args[0], limit: Number(args[1] || 50) });
  else if (command === "import") { const rows = JSON.parse(await readFile(args[1], "utf8")); result = await api({ action: "import", accountId: args[0], rows: Array.isArray(rows) ? rows : rows.items }); }
  else if (command === "analyze" || command === "compare") result = await api({ action: command, reelIds: args });
  else if (command === "usage") { const response = await fetch(`${base}/api/replay/usage`); if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); result = {summary:data.summary,records:data.records,pricingAsOf:data.pricing.fetchedAt}; }
  else if (command === "idea" || command === "ideas") { const data = await api(); result = command === "idea" ? data.ideas?.find(idea => idea.id === args[0]) : (data.ideas || []).map(({id,sourceKind,sourceId,draft,savedAt,messages,updatedAt}) => ({id,sourceKind,sourceId,title:draft.title,savedAt,messages:messages.length,updatedAt})); if (!result) throw new Error("Idea conversation not found."); }
  else if (command === "cancel") result = await api({ action: "cancel", jobId: args[0] });
  else if (["report", "comparison", "research"].includes(command) && args[0]) { const r = await fetch(`${base}/api/replay/export?id=${encodeURIComponent(args[0])}&format=json${command === "research" ? "&type=research" : command === "comparison" ? "&type=comparison" : ""}`); if (!r.ok) throw new Error(`HTTP ${r.status}`); result = await r.json(); }
  else { const data = await api(); if (command === "collections") result = data.collections; else if(command === "research") {result=args[0] ? data.research.find(r=>r.id===args[0]) : data.research;if(!result)throw new Error("Research report not found.");} else if (command === "accounts") result = data.accounts; else if (command === "jobs") result = data.jobs; else if (command === "reels") result = data.reels.filter(r => !args[0] || r.accountId === args[0]).map(({ id, accountId, url, platform, creatorName, caption, views, status, performance, analyzedAt }) => ({ id, accountId, url, platform, creatorName, caption, views, status, performance, analyzedAt })); else throw new Error(`Unknown command: ${command}\n${help}`); }
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : error); console.error("Check that the app is running at " + base); process.exitCode = 1; }

// Local integration check for the installed yt-dlp formatter; no network or model calls.
import assert from "node:assert/strict";
import { YTDLP_METADATA_TEMPLATE, linkMetadata } from "../src/lib/replay/links";
import { PYTHON } from "../src/lib/replay/paths";
import { run } from "../src/lib/replay/process";
import type { Reel } from "../src/lib/replay/types";
const code=`from yt_dlp import YoutubeDL
import sys
info={"id":"fixture", "title":"Quote: \\\"hello\\\"\\nSecond line 🥔", "like_count":0, "is_live":False}
print(YoutubeDL({"quiet":True}).evaluate_outtmpl(sys.argv[1],info))`;
const out=await run(PYTHON,["-c",code,YTDLP_METADATA_TEMPLATE],{timeout:10000});
const info=JSON.parse(out.stdout);assert.equal(info.like_count,0);assert.equal(info.view_count,undefined);assert.equal(info.is_live,false);assert.match(info.title,/Second line 🥔/);
const reel=linkMetadata({id:"fixture",platform:"youtube"} as Reel,info);assert.equal(reel.views,null);assert.equal(reel.likes,0);assert.equal(reel.postedAt,null);assert.equal(reel.durationSeconds,null);
console.log("Installed yt-dlp JSON contract passed: missing counts, zero likes, false live flag, quotes, newlines and Unicode.");

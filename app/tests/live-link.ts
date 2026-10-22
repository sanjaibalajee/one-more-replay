// Explicit public-platform integration check. No AI or Apify use; isolated local data.
import { mkdtempSync } from "node:fs";
import path from "node:path";
const input=process.argv[2];if(!input)throw new Error("Supply one full public video URL.");
process.env.REPLAY_DATA_DIR=mkdtempSync(path.resolve("../.local/live-link-"));
const {addVideoLink,resolveVideoLink}=await import("../src/lib/replay/links");
const {downloadReel}=await import("../src/lib/replay/media");
const {run}=await import("../src/lib/replay/process");
const {reel}=addVideoLink(input),signal=AbortSignal.timeout(360000);
const resolved=await resolveVideoLink(reel,signal);console.log(JSON.stringify({stage:"metadata",platform:resolved.platform,duration:resolved.durationSeconds,hasCreator:Boolean(resolved.creatorKey),viewsAvailable:resolved.views!==null}));
const file=await downloadReel(resolved,signal);
const probe=JSON.parse((await run("ffprobe",["-v","error","-show_format","-show_streams","-of","json",file],{signal})).stdout);
console.log(JSON.stringify({stage:"download",duration:Number(probe.format.duration),videoCodec:probe.streams.find((s:{codec_type:string})=>s.codec_type==="video")?.codec_name,directory:process.env.REPLAY_DATA_DIR}));

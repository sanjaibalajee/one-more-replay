import { createHash, randomUUID } from "node:crypto";
import { run, cleanError } from "./process";
import { PYTHON } from "./paths";
import { getAccounts, getReel, saveAccount, saveReel } from "./store";
import { safeCdnUrl } from "./catalogue";
import type { Reel, Account } from "./types";
import type { Platform } from "./research-types";

export function parseVideoLink(value: string): { platform: Exclude<Platform,"local">; url: string; shortcode: string; id: string } {
  let url: URL; try { url = new URL(value.trim()); } catch { throw new Error("Paste a full public Instagram, TikTok or YouTube video URL."); }
  if (url.protocol !== "https:" || url.port || url.username || url.password) throw new Error("Use an HTTPS video URL without credentials or a custom port.");
  const host = url.hostname.toLowerCase(); let platform: Exclude<Platform,"local">, shortcode: string, canonical: string;
  const ig = url.pathname.match(/^\/(?:reel|reels|p)\/([A-Za-z0-9_-]{1,100})\/?$/);
  const tt = url.pathname.match(/^\/@([\w.-]{1,50})\/video\/(\d{10,30})\/?$/);
  if (["instagram.com","www.instagram.com"].includes(host) && ig) { platform="instagram"; shortcode=ig[1]; canonical=`https://www.instagram.com/reel/${shortcode}/`; }
  else if (["tiktok.com","www.tiktok.com","m.tiktok.com"].includes(host) && tt) { platform="tiktok"; shortcode=tt[2]; canonical=`https://www.tiktok.com/@${tt[1]}/video/${shortcode}`; }
  else if (["youtube.com","www.youtube.com","m.youtube.com","youtu.be"].includes(host)) {
    const id = host === "youtu.be" ? url.pathname.slice(1).replace(/\/$/,"") : url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/shorts\/([\w-]+)\/?$/)?.[1];
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("Use an individual YouTube Shorts or video URL.");
    platform="youtube"; shortcode=id; canonical=`https://www.youtube.com/watch?v=${id}`;
  } else throw new Error("Use an Instagram Reel, full TikTok @creator/video URL, or YouTube Shorts URL. Profile, playlist and shortened TikTok links are not supported.");
  const prefix = platform === "instagram" ? "ig" : platform === "youtube" ? "yt" : "tt";
  return { platform,shortcode,url:canonical,id:`${prefix}_${createHash("sha256").update(shortcode).digest("hex").slice(0,24)}` };
}
export function safeThumbnailUrl(value: string) {
  try { return safeCdnUrl(value); } catch { /* Additional platform thumbnail CDNs below. */ }
  const url = new URL(value), host=url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.port || url.username || url.password || !["ytimg.com","ggpht.com","googleusercontent.com","tiktokcdn.com","tiktokcdn-us.com","tiktokcdn-eu.com","byteoversea.com","ibytedtos.com","ibyteimg.com"].some(h=>host===h || host.endsWith(`.${h}`))) throw new Error("Unsupported thumbnail host.");
  return url.toString();
}
export function addVideoLink(value: string) {
  const link = parseVideoLink(value), previous = getReel(link.id);
  if (previous) return { reel:previous,existing:true };
  let account = getAccounts().find(a=>a.kind==="inbox" && a.platform===link.platform);
  if (!account) {
    account = { id:randomUUID(),username:`${link.platform}_links`,label:`${link.platform === "youtube" ? "YouTube" : link.platform === "tiktok" ? "TikTok" : "Instagram"} links`,kind:"inbox",role:"inspiration",platform:link.platform,createdAt:new Date().toISOString(),lastFetchedAt:null,requestedLimit:0,lastFetchedCount:0,collectionNote:"Individual links only. No account collection or Apify charges." } satisfies Account;
    saveAccount(account);
  }
  const reel: Reel = { ...link,accountId:account.id,caption:"",thumbnail:"",videoUrl:"",views:null,likes:null,comments:null,postedAt:null,collectedAt:new Date().toISOString(),source:"link",status:"idle",error:null,starred:false,evidence:null,analysis:null,analysisProvider:null,analyzedAt:null };
  saveReel(reel); return { reel,existing:false };
}
const count = (value: unknown) => value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value)>=0 ? Math.round(Number(value)) : null;
export function linkMetadata(reel: Reel, info: Record<string,unknown>): Reel {
  let thumbnail=""; try { thumbnail=safeThumbnailUrl(String(info.thumbnail || "")); } catch { /* Not every extractor supplies an allowed thumbnail. */ }
  let creatorAvatarUrl="";try{creatorAvatarUrl=safeThumbnailUrl(String(info.uploader_avatar_url || info.channel_avatar_url || ""));}catch{/* Optional creator portrait. */}
  const timestamp=Number(info.timestamp), duration=Number(info.duration);
  if (duration>600 || info.is_live === true) throw new Error("Use a finished video shorter than 10 minutes.");
  const owner=typeof info.channel_id === "string" && info.channel_id !== "NA" ? info.channel_id : typeof info.uploader_id === "string" && info.uploader_id !== "NA" ? info.uploader_id : "";
  const text = (value: unknown) => typeof value === "string" && value !== "NA" ? value : "";
  return { ...reel,caption:text(info.description || info.title).slice(0,20000),thumbnail,views:count(info.view_count),likes:count(info.like_count),comments:count(info.comment_count),durationSeconds:duration>0 && Number.isFinite(duration) ? duration : null,postedAt:timestamp>0 && Number.isFinite(timestamp) ? new Date(timestamp*1000).toISOString() : null,collectedAt:new Date().toISOString(),creatorKey:owner ? `${reel.platform}:${owner.toLowerCase()}` : undefined,creatorAvatarUrl:creatorAvatarUrl || reel.creatorAvatarUrl,creatorName:text(info.uploader || info.channel || info.uploader_id).slice(0,150),error:null };
}
export const YTDLP_METADATA_TEMPLATE = "%(.{id,title,description,thumbnail,view_count,like_count,comment_count,duration,timestamp,uploader,uploader_id,channel,channel_id,uploader_avatar_url,channel_avatar_url,is_live})j";
export async function resolveVideoLink(reel: Reel, signal: AbortSignal) {
  const link=parseVideoLink(reel.url);
  // Native object selection omits absent fields and escapes strings correctly. Individual
  // %(field)j templates emit an unquoted NA for missing values and are not valid JSON.
  let output: string;
  try {
    const result=await run(PYTHON,["-m","yt_dlp","--ignore-config","--no-plugin-dirs","--js-runtimes",`node:${process.execPath}`,"--no-playlist","--skip-download","--no-warnings","--socket-timeout","20","--retries","1","--print",YTDLP_METADATA_TEMPLATE,"--",link.url],{signal,timeout:90000});
    output=result.stdout.trim();
  } catch (error) {
    if(signal.aborted) throw error;
    const detail=cleanError(error);
    if (/could not run|No module named/.test(detail)) throw new Error("The local downloader is unavailable. Run npm run setup:media in the repo, then retry fetching details.");
    throw new Error(`The platform did not return public video details. It may require login or block downloads. The link is saved; retry, or upload the video file. No Apify credits were used. ${detail.slice(-500)}`);
  }
  let info: Record<string,unknown>;
  try {
    const parsed:unknown=JSON.parse(output);
    if(!parsed || typeof parsed!=="object" || Array.isArray(parsed))throw new Error("Invalid metadata shape");
    info=parsed as Record<string,unknown>;
  } catch { throw new Error("The downloader returned unreadable video details. Run npm run setup:media to update it, then retry. The link is saved and you can upload the video instead."); }
  return linkMetadata(reel,info);
}

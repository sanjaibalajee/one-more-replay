import { normalizeHandle, safeCdnUrl } from "./catalogue";
import { getAccount, saveAccount } from "./store";
import { cleanError } from "./process";

const decode = (value:string) => value.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");
export function profileImageFromHtml(html:string, handle:string):string {
  const username=normalizeHandle(handle);
  const tags=[...html.matchAll(/<meta\b[^>]{0,20000}>/gi)].map(match=>{
    const attrs=Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(a=>[a[1].toLowerCase(),decode(a[3])]));
    return attrs;
  });
  const title=tags.find(t=>t.property==="og:title")?.content || "";
  const identity = title.toLowerCase().includes(`@${username}`) || html.includes(`"username":"${username}"`) || html.includes(`"username": "${username}"`);
  if(!identity) throw new Error("The public page did not identify this account. Instagram may require sign-in.");
  const raw=html.match(/"profile_pic_url_hd"\s*:\s*("(?:[^"\\]|\\.)*")/) || html.match(/"profile_pic_url"\s*:\s*("(?:[^"\\]|\\.)*")/);
  const candidate=raw ? JSON.parse(raw[1]) : tags.find(t=>t.property==="og:image")?.content;
  if(!candidate) throw new Error("The public profile did not provide a picture.");
  return safeCdnUrl(candidate);
}
export async function fetchProfileImage(accountId:string, signal:AbortSignal) {
  const account=getAccount(accountId);
  if(!account || account.kind==="inbox" || account.username==="local_uploads" || account.platform && account.platform!=="instagram") throw new Error("Choose an Instagram creator account.");
  try {
    const username=normalizeHandle(account.username);
    const response=await fetch(`https://www.instagram.com/${username}/`,{redirect:"error",signal:AbortSignal.any([signal,AbortSignal.timeout(15000)]),headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"},cache:"no-store"});
    if(!response.ok || !response.body) throw new Error("Instagram did not return its public profile page.");
    if(Number(response.headers.get("content-length"))>2_000_000) throw new Error("The profile response was too large.");
    const reader=response.body.getReader(), chunks:Uint8Array[]=[];let size=0;
    try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new Error("The profile response was too large.");chunks.push(value);}}
    finally {await reader.cancel().catch(()=>{});}
    const profileImageUrl=profileImageFromHtml(Buffer.concat(chunks).toString("utf8"),username);
    const current=getAccount(accountId)!;
    saveAccount({...current,profileImageUrl,profileCheckedAt:new Date().toISOString(),profileError:null});
    return {profileImageUrl};
  } catch(error) {
    const message=`Profile picture unavailable. ${cleanError(error)} Your existing picture or initials will be shown. No scraping credits were used.`;
    const current=getAccount(accountId);if(current)saveAccount({...current,profileCheckedAt:new Date().toISOString(),profileError:message});
    throw new Error(message);
  }
}

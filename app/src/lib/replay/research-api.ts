import { z } from "zod";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { annotationSchema, roles } from "./research-types";
import { addVideoLink } from "./links";
import { getAccount, getCollections, getReel, saveAccount, saveCollection, deleteCollection, saveReel } from "./store";
import { enqueue } from "./jobs";
const ids = z.array(z.string().min(1).max(100)).min(1).max(10).transform(v=>[...new Set(v)]);
export const researchActions = z.discriminatedUnion("action",[
  z.object({ action:z.literal("role"),accountId:z.string(),role:z.enum(roles) }),
  z.object({ action:z.literal("link"),url:z.string().max(2000) }),
  z.object({ action:z.literal("resolve"),reelId:z.string() }),
  z.object({ action:z.literal("annotate"),reelId:z.string(),annotation:annotationSchema }),
  z.object({ action:z.literal("collection"),id:z.string().optional(),name:z.string().trim().min(1).max(80),description:z.string().max(1000).default("") }),
  z.object({ action:z.literal("collection-delete"),id:z.string() }),
  z.object({ action:z.literal("collection-add"),id:z.string(),reelIds:ids }),
  z.object({ action:z.literal("collection-remove"),id:z.string(),reelIds:ids }),
  z.object({ action:z.literal("adapt"),reelId:z.string(),topic:z.string().trim().min(1).max(3000) }),
  z.object({ action:z.literal("gap"),ownIds:ids,competitorIds:ids }),
]);
export function requireLinkedReport(id: string) {
  const reel=getReel(id);
  if (!reel?.analysis?.sources?.length || reel.analysis.version!==2) throw new Error("Analyze this video with evidence links first. Older reports need re-analysis before adaptation or gap analysis.");
  return reel;
}
export function handleResearch(input: z.infer<typeof researchActions>) {
  if(input.action==="role") {
    const account=getAccount(input.accountId); if(!account || account.kind==="inbox" || account.username==="local_uploads") throw new Error("Choose a creator account to assign a role.");
    saveAccount({...account,role:input.role}); return NextResponse.json({ok:true});
  }
  if(input.action==="link") {
    const result=addVideoLink(input.url);
    const job=result.existing ? null : enqueue("resolve",result.reel.accountId,[result.reel.id]);
    return NextResponse.json({id:result.reel.id,existing:result.existing,job},{status:result.existing ? 200 : 202});
  }
  if(input.action==="resolve") {
    const reel=getReel(input.reelId); if(!reel?.url) throw new Error("A saved public link is required.");
    return NextResponse.json(enqueue("resolve",reel.accountId,[reel.id]),{status:202});
  }
  if(input.action==="annotate") {
    const reel=getReel(input.reelId); if(!reel) throw new Error("Video not found.");
    saveReel({...reel,annotation:input.annotation}); return NextResponse.json({ok:true});
  }
  if(input.action==="adapt") {
    requireLinkedReport(input.reelId);
    return NextResponse.json(enqueue("adapt",null,[input.reelId],{topic:input.topic}),{status:202});
  }
  if(input.action==="gap") {
    const own=input.ownIds.map(requireLinkedReport), competitors=input.competitorIds.map(requireLinkedReport);
    if(own.length+competitors.length>10) throw new Error("Choose up to 10 videos in total.");
    if(input.ownIds.some(id=>input.competitorIds.includes(id))) throw new Error("A video cannot be on both sides.");
    if(own.some(r=>getAccount(r.accountId)?.role!=="own")) throw new Error("Mark your creator account as Your account first.");
    if(competitors.some(r=>(getAccount(r.accountId)?.role || "competitor")!=="competitor" || getAccount(r.accountId)?.kind==="inbox")) throw new Error("Select peer examples from accounts marked Competitor.");
    return NextResponse.json(enqueue("gap",null,[...input.ownIds,...input.competitorIds],{ownIds:input.ownIds}),{status:202});
  }
  const existing=getCollections().find(c=>c.id===input.id);
  if(input.action==="collection") {
    if(input.id && !existing) throw new Error("Collection no longer exists.");
    if(getCollections().some(c=>c.id!==input.id && c.name.toLowerCase()===input.name.toLowerCase())) throw new Error("A collection with this name already exists.");
    const now=new Date().toISOString(), collection={id:existing?.id || randomUUID(),name:input.name,description:input.description,reelIds:existing?.reelIds || [],createdAt:existing?.createdAt || now,updatedAt:now};
    saveCollection(collection); return NextResponse.json(collection,{status:existing ? 200 : 201});
  }
  if(!existing) throw new Error("Collection no longer exists.");
  if(input.action==="collection-delete") { deleteCollection(existing.id); return NextResponse.json({ok:true}); }
  if(input.reelIds.some(id=>!getReel(id))) throw new Error("One of these videos no longer exists.");
  const reelIds=input.action==="collection-add" ? [...new Set([...existing.reelIds,...input.reelIds])] : existing.reelIds.filter(id=>!input.reelIds.includes(id));
  if(reelIds.length>1000) throw new Error("Use up to 1,000 videos per collection.");
  saveCollection({...existing,reelIds,updatedAt:new Date().toISOString()}); return NextResponse.json({ok:true});
}

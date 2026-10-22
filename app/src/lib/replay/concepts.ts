import type { z } from "zod";
import type { ideaSchema } from "./types";
const words = (text:string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const plain = (text:string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
export function validateConcept(concept:z.infer<typeof ideaSchema>) {
  let end=0, section=0;
  const order={hook:0,body:1,cta:2};
  for(const shot of concept.shotList) {
    if(shot.startSeconds<end || shot.endSeconds<=shot.startSeconds || shot.endSeconds>concept.durationSeconds) throw new Error("A suggested shot list has inconsistent timing. Retry the report.");
    if(order[shot.section]<section) throw new Error("A shot list must move from hook to body to CTA. Retry the report.");
    section=order[shot.section]; end=shot.endSeconds;
    if(words(shot.spokenLine)>Math.max(10,(shot.endSeconds-shot.startSeconds)*4.5)) throw new Error("A shot has too many spoken words for its duration. Retry the report.");
  }
  const first=concept.shotList[0],last=concept.shotList.at(-1)!;
  if(first.section!=="hook" || last.section!=="cta" || !concept.shotList.some(s=>s.section==="body")) throw new Error("A concept needs a hook, body and CTA shot. Retry the report.");
  if(!plain(`${first.spokenLine} ${first.onScreenText}`).includes(plain(concept.opening))) throw new Error("The first shot does not include the proposed opening. Retry the report.");
  if(!plain(`${last.spokenLine} ${last.onScreenText}`).includes(plain(concept.cta))) throw new Error("The closing shot does not include the proposed CTA. Retry the report.");
  const body=concept.shotList.filter(shot=>shot.section==="body").map(shot=>shot.spokenLine.trim() || shot.onScreenText.trim()).filter(Boolean).join(" ");
  if(!body || plain(body)!==plain(concept.body)) throw new Error("The body script must match the spoken or on-screen copy in its shots. Retry the report.");
}

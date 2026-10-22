import path from "node:path";
import { existsSync } from "node:fs";
import { mediaDir } from "./paths";
import { sourcesFor } from "./evidence";
import type { Reel } from "./types";
import { isFrameFile } from "./media-files";

export function sourceImages(reels:Reel[], perReel=4) {
  const files:string[]=[], index:{image:number;reelId:string;sourceId:string;seconds:number|null}[]=[];
  for(const reel of reels) {
    const frames=sourcesFor(reel).filter(s=>s.kind==="frame" && s.file && isFrameFile(s.file) && existsSync(path.join(mediaDir(reel.id), s.file)));
    const chosen = frames.length<=perReel ? frames : perReel<=1 ? frames.slice(0,1) : Array.from({length:perReel},(_,i)=>frames[Math.round(i*(frames.length-1)/(perReel-1))]);
    for(const source of chosen) {
      const file=path.join(mediaDir(reel.id),source.file!);
      if(existsSync(file)) { files.push(file);index.push({image:files.length,reelId:reel.id,sourceId:source.id,seconds:source.seconds}); }
    }
  }
  return {files,index};
}

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const directory=mkdtempSync(path.join(tmpdir(),"replay-profile-"));process.env.REPLAY_DATA_DIR=directory;
const store=await import("../src/lib/replay/store");
const {profileImageFromHtml,fetchProfileImage}=await import("../src/lib/replay/profile");
const {normalizeReel}=await import("../src/lib/replay/catalogue");
after(()=>{store.db().close();rmSync(directory,{recursive:true,force:true});});
test("profile parsing requires the requested account and a supported HTTPS portrait",()=>{
  const html='<meta content="Test creator (@creator_test)" property="og:title"><meta property="og:image" content="https://scontent.cdninstagram.com/portrait.jpg?a=1&amp;b=2">';
  assert.equal(profileImageFromHtml(html,"creator_test"),"https://scontent.cdninstagram.com/portrait.jpg?a=1&b=2");
  assert.throws(()=>profileImageFromHtml(html,"another_creator"),/did not identify/);
  assert.throws(()=>profileImageFromHtml(html.replace('https://scontent.cdninstagram.com/portrait.jpg','http://127.0.0.1/private'),"creator_test"),/Unsupported/);
  const json='<script>{"username":"creator_test","profile_pic_url_hd":"https:\\/\\/scontent.cdninstagram.com\\/portrait.jpg?x=1\\u0026y=2"}</script>';
  assert.equal(profileImageFromHtml(json,"creator_test"),"https://scontent.cdninstagram.com/portrait.jpg?x=1&y=2");
});
test("public profile refresh preserves role edits and never calls an Apify actor",async()=>{
  const a=store.addAccount("creator_test"), original=globalThis.fetch;let called="";
  globalThis.fetch=async(input)=>{called=String(input);store.saveAccount({...store.getAccount(a.id)!,role:"own"});return new Response('<meta property="og:title" content="Creator (@creator_test)"><meta property="og:image" content="https://scontent.cdninstagram.com/profile.jpg">',{headers:{"content-type":"text/html"}});};
  try{await fetchProfileImage(a.id,new AbortController().signal);assert.equal(called,"https://www.instagram.com/creator_test/");assert.equal(store.getAccount(a.id)?.role,"own");assert.match(store.getAccount(a.id)?.profileImageUrl || "",/profile.jpg/);}
  finally{globalThis.fetch=original;}
});
test("collection portraits persist through later imports without replacing reports",()=>{
  const a=store.addAccount("portrait_owner"),r=normalizeReel({url:"https://www.instagram.com/reel/PortraitFixture/",owner:{username:"portrait_owner",full_name:"A real creator",profile_pic_url:"https://scontent.cdninstagram.com/photo.jpg"}},a.id,"import")!;
  store.ingest([r]);assert.equal(store.getAccount(a.id)?.profileImageUrl,r.creatorAvatarUrl);
  store.ingest([{...r,creatorAvatarUrl:undefined,creatorName:undefined}]);assert.equal(store.getReel(r.id)?.creatorAvatarUrl,r.creatorAvatarUrl);
});

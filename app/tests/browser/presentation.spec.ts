import {test,expect} from "@playwright/test";
import path from "node:path";
import {mkdirSync} from "node:fs";
import {reportFixture} from "../fixtures/report";
import {evidenceSources} from "../../src/lib/replay/evidence";
import type {Account,Reel,Snapshot,MediaEvidence} from "../../src/lib/replay/types";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S9sAAAAASUVORK5CYII=","base64");
async function setup(page:import("@playwright/test").Page,request:import("@playwright/test").APIRequestContext) {
 const data:Snapshot=await(await request.get("/api/replay")).json(),now=new Date().toISOString();
 const account:Account={id:"visual-account",username:"visual_creator",label:"Visual creator",role:"own",createdAt:now,lastFetchedAt:null,requestedLimit:0,lastFetchedCount:0,collectionNote:"Synthetic visual fixture.",profileImageUrl:"https://scontent.cdninstagram.com/portrait.jpg",reelCount:1};
 const evidence:MediaEvidence={duration:12,width:180,height:320,hasAudio:true,frames:[{file:"frame-00.jpg",seconds:0}],sceneChanges:[],transcript:{text:"Synthetic words.",language:"en",segments:[{start:0,end:3,text:"Synthetic words."}],engine:"fixture",model:"base",status:"completed",note:"Synthetic UI fixture."},warnings:[]};
 const reel:Reel={id:"visual-reel",accountId:account.id,shortcode:"VisualReel",url:"https://www.instagram.com/reel/VisualReel/",caption:"A synthetic visual test",thumbnail:"",videoUrl:"",views:null,likes:null,comments:null,postedAt:null,collectedAt:now,source:"import",platform:"instagram",status:"completed",error:null,starred:false,evidence,analysis:reportFixture(),analysisProvider:"Synthetic fixture",analyzedAt:now};reel.analysis!.sources=evidenceSources(reel,evidence);
 data.accounts=[account];data.reels=[reel];data.jobs=[];data.collections=[];data.research=[];data.comparisons=[];
 await page.route("**/api/replay",route=>route.request().method()==="GET" ? route.fulfill({json:data}) : route.fulfill({json:{ok:true}}));
 await page.route("**/api/proxy-image?**",route=>route.fulfill({contentType:"image/png",body:png}));
 await page.route("**/frame-*.jpg",route=>route.fulfill({contentType:"image/png",body:png}));
 return {data,reel,account};
}
test("reports show separate source and suggested hook/body/CTA, and scripts copy without production notes",async({page,request,context})=>{
 await context.grantPermissions(["clipboard-read","clipboard-write"]);
 const {reel}=await setup(page,request);await page.goto(`/?reel=${reel.id}`);
 await expect(page.locator(".source-part .part-label")).toHaveText(["Hook","Body","CTA"]);
 await expect(page.locator(".source-part").last()).toContainText("Not visible in sampled evidence");
 await page.getByRole("tab",{name:"Overview",exact:true}).focus();await page.keyboard.press("End");await expect(page.getByRole("tab",{name:"Evidence",exact:true})).toHaveAttribute("aria-selected","true");await page.keyboard.press("Home");await expect(page.getByRole("tab",{name:"Overview",exact:true})).toHaveAttribute("aria-selected","true");
 await page.getByRole("tab",{name:"Ideas",exact:true}).click();
 await expect(page.locator(".script-block")).toHaveCount(9);const first=page.locator(".concept-card").first();
 await expect(first.locator(".script-label h4")).toHaveText(["Hook","Body","CTA"]);
 await expect(first.locator(".shot").first()).not.toBeVisible();await first.getByText("Shot list",{exact:false}).first().click();await expect(first.locator(".shot").first()).toBeVisible();
 await first.getByRole("button",{name:"Actions for concept 1",exact:true}).click();await page.getByRole("menuitem",{name:"Copy script",exact:true}).click();const copied=await page.evaluate(()=>navigator.clipboard.readText());
 expect(copied).toContain("Hook\nSynthetic opening 1\n\nBody\n");expect(copied).toContain("\n\nCTA\nSave the test for later.");expect(copied).not.toContain("Resources");
 mkdirSync(path.resolve("../.local/qa"),{recursive:true});
 for(const theme of ["light","dark"]) {await page.getByRole("button",{name:"Back",exact:true}).click();await page.getByLabel("Appearance",{exact:true}).selectOption(theme);await page.goto(`/?reel=${reel.id}`);await page.getByRole("tab",{name:"Ideas",exact:true}).click();await page.locator(".workspace-page").evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));await page.screenshot({path:path.resolve(`../.local/qa/script-layout-${theme}.png`),fullPage:true});}
 await page.setViewportSize({width:390,height:844});await expect(page.getByRole("button",{name:"Video and metrics",exact:true})).toHaveAttribute("aria-expanded","false");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator(".script-block").first().scrollIntoViewIfNeeded();await page.screenshot({path:path.resolve("../.local/qa/script-layout-mobile.png"),fullPage:true});
});
test("profile portraits and platform marks render, and broken portraits fall back to initials",async({page,request})=>{
 const {data,account}=await setup(page,request);data.reels.push({...data.reels[0],id:"yt-visual",platform:"youtube",creatorName:"Video creator",creatorAvatarUrl:"https://yt3.ggpht.com/broken.jpg"});data.reels.push({...data.reels[0],id:"tt-visual",platform:"tiktok",creatorName:"Short creator"});
 await page.route("**/api/proxy-image?**",route=>decodeURIComponent(route.request().url()).includes("broken.jpg") ? route.fulfill({status:404}) : route.fulfill({contentType:"image/png",body:png}));
 await page.goto("/");await expect(page.locator(".reel-card")).toHaveCount(3);
 await expect(page.locator(".reel-card .platform-mark").filter({hasText:"Instagram"})).toHaveCount(1);await expect(page.locator(".reel-card .platform-mark").filter({hasText:"YouTube"})).toHaveCount(1);await expect(page.locator(".reel-card .platform-mark").filter({hasText:"TikTok"})).toHaveCount(1);
 await expect(page.locator(".reel-card").nth(1).locator(".profile-picture img")).toHaveCount(0);
 await page.getByRole("button",{name:/@visual_creator/}).click();await expect(page.locator(".page-title .profile-picture img")).toHaveAttribute("src",`/api/proxy-image?url=${encodeURIComponent(account.profileImageUrl!)}`);
 await page.getByRole("button",{name:"Manage account",exact:true}).click();await expect(page.getByRole("button",{name:"Refresh photo",exact:true})).toBeVisible();await page.screenshot({path:path.resolve("../.local/qa/profile-library.png"),fullPage:true});
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { cleanError } from "./process";

export function guard(request: Request) {
  const url = new URL(request.url);
  const publicUrl = new URL(`${url.protocol}//${request.headers.get("host") || url.host}`);
  if (publicUrl.username || publicUrl.password || ![url.hostname, publicUrl.hostname].every(host => ["localhost", "127.0.0.1", "[::1]"].includes(host))) throw new Error("One More Replay accepts local requests only.");
  const origin = request.headers.get("origin");
  if (origin && origin !== publicUrl.origin) throw new Error("Cross-origin requests are not accepted.");
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new Error("Cross-site requests are not accepted.");
}
export function apiError(error: unknown, status = 400) {
  const message = error instanceof z.ZodError ? error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") : cleanError(error);
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 5_000_000) throw new Error("Request too large. Import at most 1,000 Reels at a time.");
  return JSON.parse(text);
}

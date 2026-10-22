import { safeThumbnailUrl } from "@/lib/replay/links";
import { guard } from "@/lib/replay/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    guard(request); const url = safeThumbnailUrl(new URL(request.url).searchParams.get("url") || "");
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12000) });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !response.body || !/^image\/(jpeg|png|webp)(?:;|$)/.test(contentType)) return new Response(null, { status: 502 });
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 8_000_000) { await reader.cancel(); return new Response(null, { status: 413 }); } chunks.push(value); }
    return new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 400 }); }
}

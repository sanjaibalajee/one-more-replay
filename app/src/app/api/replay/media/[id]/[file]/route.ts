import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { fileStream } from "@/lib/replay/stream";
import path from "node:path";
import { mediaDir } from "@/lib/replay/paths";
import { getReel } from "@/lib/replay/store";
import { apiError, guard } from "@/lib/replay/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string; file: string }> }) {
  try {
    guard(request); const { id, file } = await context.params;
    if (!getReel(id) || !/^(video\.mp4|frame-(?:\d{2}|v2-\d{1,3}-\d{2})\.jpg)$/.test(file)) return new Response(null, { status: 404 });
    const location = path.join(mediaDir(id), file);
    if (!existsSync(location)) return new Response(null, { status: 404 });
    const size = (await stat(location)).size;
    const headers: Record<string, string> = { "Content-Type": file.endsWith(".jpg") ? "image/jpeg" : "video/mp4", "Cache-Control": "private, no-cache", "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
    const range = request.headers.get("range");
    let start = 0, end = size - 1, status = 200;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      status = 206; headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }
    headers["Content-Length"] = String(Math.max(0, end - start + 1));
    return new Response(size ? await fileStream(location, start, end) : null, { status, headers });
  } catch (err) { return apiError(err); }
}

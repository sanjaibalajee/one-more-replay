import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { writeFile, rename, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { apiError, guard } from "@/lib/replay/http";
import { addAccount, getAccount, getReel, saveReel } from "@/lib/replay/store";
import { reserveUpload } from "@/lib/replay/media-lock";
import { mediaDir } from "@/lib/replay/paths";
import { run } from "@/lib/replay/process";
import { MAX_VIDEO_BYTES } from "@/lib/replay/media";
import type { Reel } from "@/lib/replay/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let temporary: string | null = null;
  let normalized: string | null = null;
  let release: (() => void) | undefined;
  try {
    guard(request);
    if (Number(request.headers.get("content-length")) > MAX_VIDEO_BYTES + 100000) throw new Error("Use a video under 150 MB.");
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_VIDEO_BYTES) throw new Error("Choose a video file under 150 MB.");
    const existingId = String(form.get("reelId") || "");
    const existing = existingId ? getReel(existingId) : null;
    if (existingId && !existing) throw new Error("Reel not found.");
    const accountId = existing?.accountId || String(form.get("accountId") || "") || addAccount("local_uploads").id;
    if (!getAccount(accountId)) throw new Error("Account not found.");
    const id = existing?.id || `local_${randomUUID()}`, dir = mediaDir(id);
    release = reserveUpload(id);
    const attempt = randomUUID();
    temporary = path.join(dir, `upload-${attempt}.part`);
    await writeFile(temporary, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });
    const result = await run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", temporary], { signal: request.signal });
    const info = JSON.parse(result.stdout);
    if (!info.streams?.some((s: { codec_type: string }) => s.codec_type === "video") || !(Number(info.format?.duration) > 0) || Number(info.format.duration) > 600) throw new Error("Use a playable video shorter than 10 minutes.");
    normalized = path.join(dir, `normalized-${attempt}.part`);
    await run("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", temporary, "-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", "-f", "mp4", normalized], { signal: request.signal, timeout: 300000 });
    if ((await stat(normalized)).size > MAX_VIDEO_BYTES) throw new Error("Normalized video exceeds 150 MB. Use a smaller file.");
    request.signal.throwIfAborted();
    await rename(normalized, path.join(dir, "video.mp4")); normalized = null;
    await unlink(temporary); temporary = null;
    await unlink(path.join(dir, "evidence.json")).catch(() => {});
    const latest = existing ? getReel(id)! : null;
    const reel: Reel = latest ? { ...latest, transcriptReview: undefined, mediaRevision: randomUUID(), durationSeconds: Number(info.format.duration), evidence: null, analysis: null, analysisUsage: undefined, analyzedAt: null, analysisProvider: null, status: "idle", error: null } : {
      id, accountId, mediaRevision: randomUUID(), durationSeconds: Number(info.format.duration), shortcode: "local-video", url: "", caption: String(form.get("caption") || file.name).slice(0, 20000),
      thumbnail: "", videoUrl: "", views: null, likes: null, comments: null, postedAt: null,
      collectedAt: new Date().toISOString(), source: "upload", status: "idle", error: null, starred: false, evidence: null, analysis: null, analysisProvider: null, analyzedAt: null,
    };
    saveReel(reel); return NextResponse.json({ id: reel.id }, { status: 201 });
  } catch (err) { return apiError(err); }
  finally { try { if (temporary) await unlink(temporary).catch(() => {}); if (normalized) await unlink(normalized).catch(() => {}); } finally { release?.(); } }
}

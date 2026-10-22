import { existsSync } from "node:fs";
import { readFile, writeFile, rename, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { safeCdnUrl } from "./catalogue";
import { parseVideoLink } from "./links";
import { mediaDir, PYTHON } from "./paths";
import { run } from "./process";
import type { Frame, MediaEvidence, Reel, Settings, Transcript } from "./types";

import { transcribeVideo } from "./transcription";

export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export async function downloadReel(reel: Reel, signal: AbortSignal): Promise<string> {
  const dir = mediaDir(reel.id), target = path.join(dir, "video.mp4");
  if (existsSync(target)) return target;
  if (reel.source === "upload") throw new Error("The local video file is missing. Upload it again.");
  if (reel.videoUrl) {
    const temporary = `${target}.part`;
    try {
      const response = await fetch(safeCdnUrl(reel.videoUrl), { signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]), redirect: "error" });
      if (!response.ok || !response.body) throw new Error("Instagram download link expired.");
      if (Number(response.headers.get("content-length")) > MAX_VIDEO_BYTES) throw new Error("Video exceeds the 150 MB limit.");
      const { open } = await import("node:fs/promises");
      const file = await open(temporary, "w", 0o600);
      let size = 0;
      const reader = response.body.getReader();
      try {
        while (true) {
          const { value: chunk, done } = await reader.read(); if (done) break;
          size += chunk.length;
          if (size > MAX_VIDEO_BYTES) throw new Error("Video exceeds the 150 MB limit.");
          await file.write(chunk);
        }
      } finally { await reader.cancel().catch(()=>{}); await file.close(); }
      await rename(temporary, target); return target;
    } catch (err) {
      await unlink(temporary).catch(() => {});
      if (signal.aborted) throw err;
    }
  }
  const raw = path.join(dir, "download.mp4"), normalized = path.join(dir, "normalized.mp4");
  try {
    await run(PYTHON, ["-m", "yt_dlp", "--ignore-config", "--no-plugin-dirs", "--js-runtimes", `node:${process.execPath}`, "--no-playlist", "--no-progress", "--no-part", "--no-continue", "--force-overwrites", "--max-filesize", "150M", "-f", "b[ext=mp4]/b", "--socket-timeout", "20", "--retries", "1", "-o", raw, "--", parseVideoLink(reel.url).url], { signal, timeout: 180000 });
    if (!existsSync(raw) || (await stat(raw)).size === 0 || (await stat(raw)).size > MAX_VIDEO_BYTES) throw new Error("No downloadable video under 150 MB was returned.");
    const probe = JSON.parse((await run("ffprobe", ["-v", "error", "-show_format", "-of", "json", raw], { signal })).stdout);
    if (!(Number(probe.format?.duration)>0) || Number(probe.format.duration)>600) throw new Error("Use a video shorter than 10 minutes.");
    await run("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=720:1280:force_original_aspect_ratio=decrease:force_divisible_by=2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", normalized], { signal, timeout:300000 });
    if ((await stat(normalized)).size>MAX_VIDEO_BYTES) throw new Error("Normalized video exceeds 150 MB.");
    await rename(normalized,target); return target;
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Couldn't download this video. The platform may require login or block downloads. For Instagram, refresh media links; otherwise upload the video from its details. Videos must be under 150 MB and 10 minutes.");
  } finally { await unlink(raw).catch(()=>{}); await unlink(normalized).catch(()=>{}); }
}

export const SAMPLING_VERSION = 3;
export function frameTimes(duration: number, sceneChanges: number[] = []): number[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const end = Math.max(0, duration - 0.1);
  const times = new Set<number>([0, 0.5, 1, 2, 3, Number(end.toFixed(2))].filter(s => s < duration));
  for (let i = 1; i < 10; i++) times.add(Number((end * i / 10).toFixed(2)));
  const cuts = [...new Set(sceneChanges.filter(s => Number.isFinite(s) && s > 0 && s < end))].sort((a, b) => a - b);
  // Land inside the new shot, including short cuts in the opening. Never
  // overshoot a rapid shot by adding a fixed offset beyond its next boundary.
  const shots = cuts.map((cut, index) => ({ start: cut, end: cuts[index + 1] ?? duration, seconds: Number((cut + Math.min(0.08, ((cuts[index + 1] ?? duration) - cut) / 2)).toFixed(2)) }));
  const candidates = shots.map(shot => shot.seconds).filter(s => s < end);
  const opening = shots.filter(shot => shot.start < 3 && shot.seconds < end && ![...times].some(time => time >= shot.start && time < shot.end)).sort((a, b) => (a.end - a.start) - (b.end - b.start)).map(shot => shot.seconds);
  while (times.size < 20 && opening.length) {
    const next = opening.shift()!;
    if (Math.min(...[...times].map(t => Math.abs(next-t))) >= 0.04) times.add(next);
  }
  while (times.size < 20 && candidates.length) {
    // Fill the largest uncovered scene gap. Keep a bounded image budget.
    candidates.sort((a, b) => Math.min(...[...times].map(t => Math.abs(b-t))) - Math.min(...[...times].map(t => Math.abs(a-t))));
    const next = candidates.shift()!;
    if (Math.min(...[...times].map(t => Math.abs(next-t))) < 0.35) break;
    times.add(next);
  }
  return [...times].filter(s => s >= 0 && s < duration).sort((a, b) => a - b);
}
export function samplingComplete(evidence: MediaEvidence): boolean {
  return evidence.samplingVersion === SAMPLING_VERSION && evidence.frames.length > 0 && evidence.frames.some(frame => frame.seconds >= Math.max(0, evidence.duration - 0.25));
}
export async function extractEvidence(reel: Reel, settings: Settings, signal: AbortSignal, phase: (name: "extracting" | "transcribing", detail: string) => void): Promise<MediaEvidence> {
  const dir = mediaDir(reel.id), video = path.join(dir, "video.mp4"), manifest = path.join(dir, "evidence.json");
  const override = reel.evidence?.transcriptionSettings;
  let cached: MediaEvidence | undefined = override ? reel.evidence! : undefined;
  if (override) settings = { ...settings, whisperModel: override.model, language: override.language };
  if (existsSync(manifest)) {
    phase("extracting", "Checking saved frames and transcript.");
    cached = JSON.parse(await readFile(manifest, "utf8")) as MediaEvidence;
    if (override && reel.evidence) cached = { ...cached, transcript: reel.evidence.transcript, transcriptionSettings: override };
    if ((cached.transcript.status === "no-audio" || (cached.transcript.status === "completed" && cached.transcript.model === settings.whisperModel && (!settings.language || cached.transcript.language === settings.language))) && samplingComplete(cached) && cached.frames.every(f => existsSync(path.join(dir, f.file)))) return cached;
  }
  phase("extracting", "Reading duration and extracting the opening plus frames across the full video.");
  const probe = await run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", video], { signal });
  const info = JSON.parse(probe.stdout) as { format: { duration: string }; streams: { codec_type: string; width?: number; height?: number }[] };
  const duration = Number(info.format.duration), stream = info.streams.find(s => s.codec_type === "video");
  if (!stream || !Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error("Use a playable video between 0 and 600 seconds.");
  const hasAudio = info.streams.some(s => s.codec_type === "audio");
  const frames: Frame[] = [];
  const cuts = await run("ffmpeg", ["-nostdin", "-hide_banner", "-i", video, "-vf", "scale=160:-2,select=gt(scene\\,0.3),showinfo", "-an", "-f", "null", "-"], { signal, timeout: 120000 });
  const sceneChanges = [...cuts.stderr.matchAll(/pts_time:([\d.]+)/g)].map(match => Number(match[1]));
  const times = frameTimes(duration, sceneChanges);
  for (let offset = 0; offset < times.length; offset += 3) {
    phase("extracting", `Extracting frames ${offset + 1}–${Math.min(offset + 3, times.length)} of ${times.length}.`);
    signal.throwIfAborted();
    const batch = await Promise.allSettled(times.slice(offset, offset + 3).map(async seconds => {
      const file = `frame-v${SAMPLING_VERSION}-${seconds.toFixed(2).replace(".", "-")}.jpg`;
      await run("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-ss", String(seconds), "-i", video, "-frames:v", "1", "-vf", "scale=640:640:force_original_aspect_ratio=decrease:out_range=pc,format=yuvj420p", "-color_range", "pc", "-strict", "unofficial", "-q:v", "3", path.join(dir, file)], { signal, timeout: 30000 });
      return existsSync(path.join(dir, file)) ? { file, seconds } : null;
    }));
    // Settle the whole batch before failing, so cancelled/failed jobs leave no
    // background decoders writing into a later attempt's evidence directory.
    for (const result of batch) {
      if (result.status === "rejected") throw result.reason;
      if (result.value) frames.push(result.value);
    }
  }
  if (!frames.length) throw new Error("No readable video frames were extracted.");
  let transcript: Transcript = { text: "", language: null, segments: [], engine: "none", model: "", status: "no-audio", note: "This file has no audio track." };
  const warnings = ["Visual analysis uses sampled frames, not continuous video playback. Quick gestures and transitions between samples may be missed.", "Scene-change detection estimates visual changes; it does not measure viewer retention."];
  if (hasAudio && cached?.transcript.status === "completed" && cached.transcript.model === settings.whisperModel && (!settings.language || cached.transcript.language === settings.language)) {
    transcript = cached.transcript;
  } else if (hasAudio) {
    phase("transcribing", `Transcribing locally with Whisper ${settings.whisperModel}. The model may download on first use.`);
    transcript = await transcribeVideo(video, { model: settings.whisperModel, language: settings.language }, duration, signal);
  }
  const evidence: MediaEvidence = { ...(override ? { transcriptionSettings: override } : {}), samplingVersion: SAMPLING_VERSION, duration, width: stream.width || 0, height: stream.height || 0, hasAudio, frames, sceneChanges, transcript, warnings };
  await writeFile(manifest, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  return evidence;
}

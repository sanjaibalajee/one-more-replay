import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".local/cache/uv"); mkdirSync(cache, { recursive: true });
const env = { ...process.env, UV_CACHE_DIR: cache };
for (const args of [["venv", "--allow-existing", "--python", "3.12", ".venv"], ["pip", "install", "--python", ".venv/bin/python", "-r", "requirements-media.txt"]]) {
  const result = spawnSync("uv", args, { cwd: root, env, stdio: "inherit" });
  if (result.error || result.status !== 0) { console.error(result.error?.message || "Media setup failed. Install uv, then retry npm run setup:media."); process.exit(1); }
}
for (const program of ["ffmpeg", "ffprobe"]) {
  const result = spawnSync(program, ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) { console.error(`${program} is missing. Install FFmpeg (macOS: brew install ffmpeg), then retry.`); process.exit(1); }
}
console.log("Local transcription and download tools are ready. Whisper downloads the selected model on first use.");

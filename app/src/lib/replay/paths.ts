import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export const ROOT = path.resolve(process.env.REPLAY_ROOT || (existsSync(path.join(process.cwd(), "app/package.json")) ? process.cwd() : path.join(process.cwd(), "..")));
export const LOCAL = path.resolve(process.env.REPLAY_DATA_DIR || path.join(ROOT, ".local"));
export const ARTIFACTS = path.join(LOCAL, "media");
export const PYTHON = process.env.REPLAY_PYTHON || path.join(ROOT, ".venv", "bin", "python");
export function ensureLocal() { mkdirSync(ARTIFACTS, { recursive: true, mode: 0o700 }); }
export function mediaDir(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid media ID");
  ensureLocal();
  const dir = path.join(ARTIFACTS, id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

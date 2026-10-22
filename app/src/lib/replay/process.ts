import { spawn } from "node:child_process";
import path from "node:path";

export function cleanError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/(?:sk-[A-Za-z0-9_-]+|apify_api_[A-Za-z0-9_-]+)/g, "[redacted]").replace(/([?&](?:token|key|api_key)=)[^&\s]+/gi, "$1[redacted]").slice(0, 1600);
}
export class ProcessError extends Error {
  constructor(message: string, public stdout: string, public stderr: string) { super(message); }
}
export function run(command: string, args: string[], options: { cwd?: string; input?: string; signal?: AbortSignal; timeout?: number; env?: NodeJS.ProcessEnv } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    options.signal?.throwIfAborted();
    const grouped = process.platform !== "win32";
    const child = spawn(command, args, { cwd: options.cwd, env: options.env || process.env, stdio: ["pipe", "pipe", "pipe"], shell: false, detached: grouped });
    let stdout = "", stderr = "", timedOut = false;
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    const kill = (signal: NodeJS.Signals) => {
      try { if (grouped && child.pid) process.kill(-child.pid, signal); else child.kill(signal); } catch { /* process already exited */ }
    };
    const terminate = () => { kill("SIGTERM"); forceTimer ||= setTimeout(() => kill("SIGKILL"), 2000); };
    const onAbort = () => terminate();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) terminate();
    const timer = setTimeout(() => { timedOut = true; terminate(); }, options.timeout || 120000);
    const cleanup = () => { clearTimeout(timer); clearTimeout(forceTimer); options.signal?.removeEventListener("abort", onAbort); };
    child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-2_000_000); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-200000); });
    child.on("error", err => { cleanup(); reject(new Error(`${path.basename(command)} could not run: ${cleanError(err)}`)); });
    child.on("close", code => {
      cleanup();
      if (options.signal?.aborted) reject(new ProcessError("Cancelled.", stdout, stderr));
      else if (timedOut) reject(new ProcessError(`${path.basename(command)} timed out. Try again or select fewer Reels.`, stdout, stderr));
      else if (code !== 0) reject(new ProcessError(`${path.basename(command)} exited with ${code}: ${cleanError(stderr.slice(-1200))}`, stdout, stderr));
      else resolve({ stdout, stderr });
    });
    child.stdin.on("error", () => { /* close/error events above report process failures */ });
    child.stdin.end(options.input);
  });
}

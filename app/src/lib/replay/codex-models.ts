import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { cleanError } from "./process";
import type { ModelOption } from "./models";
import type { ReasoningEffort } from "./types";

const efforts = new Set<ReasoningEffort>(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);
export interface CodexModel extends ModelOption { isDefault: boolean; defaultEffort: ReasoningEffort }
// Only public model metadata, obtained through the official CLI. No thread or inference is started.
export function codexModels(signal?: AbortSignal): Promise<CodexModel[]> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const env = { ...process.env };
    delete env.OPENAI_API_KEY; delete env.CODEX_API_KEY; delete env.OPENAI_BASE_URL;
    const child = spawn(process.env.CODEX_BIN || "codex", ["app-server", "--listen", "stdio://", "-c", 'model_provider="openai"'], { cwd: tmpdir(), env, stdio: ["pipe", "pipe", "pipe"], shell: false });
    let buffer = "", done = false, pages = 0;
    const models: CodexModel[] = [];
    const finish = (error?: Error) => {
      if (done) return;
      done = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      child.stdin.end(); child.kill();
      const force = setTimeout(() => child.kill("SIGKILL"), 2000);
      force.unref(); child.once("close", () => clearTimeout(force));
      if (error) reject(error); else resolve(models);
    };
    const abort = () => finish(new Error("Cancelled."));
    const timer = setTimeout(() => finish(new Error("Codex model discovery timed out. Check Codex login or choose an explicit model in Connections.")), 15000);
    signal?.addEventListener("abort", abort, { once: true });
    const send = (message: object) => child.stdin.write(`${JSON.stringify(message)}\n`);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (done) return;
      buffer += chunk;
      if (buffer.length > 1_000_000) return finish(new Error("Codex model catalogue was too large."));
      let end: number;
      while (!done && (end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const message = JSON.parse(line);
          if (message.error && (message.id === 1 || message.id === 2)) return finish(new Error(`Codex model discovery failed: ${cleanError(message.error.message)}`));
          if (message.id === 1) {
            send({ method: "initialized" });
            send({ id: 2, method: "model/list", params: { limit: 100 } });
          } else if (message.id === 2) {
            if (!Array.isArray(message.result?.data)) return finish(new Error("Codex returned an invalid model catalogue."));
            for (const item of message.result.data) {
              if (item.hidden || typeof item.model !== "string" || !item.inputModalities?.includes("image")) continue;
              const supported: ReasoningEffort[] = (item.supportedReasoningEfforts || []).map((e: { reasoningEffort: ReasoningEffort }) => e.reasoningEffort).filter((e: ReasoningEffort) => efforts.has(e));
              models.push({ id: item.model, label: item.displayName || item.model, description: typeof item.description === "string" ? item.description : "", efforts: supported, isDefault: item.isDefault === true, defaultEffort: efforts.has(item.defaultReasoningEffort) ? item.defaultReasoningEffort : "default" });
            }
            if (message.result.nextCursor && ++pages < 10) send({ id: 2, method: "model/list", params: { limit: 100, cursor: message.result.nextCursor } });
            else if (!models.length) finish(new Error("Codex returned no image-capable models. Check your CLI version and sign-in."));
            else finish();
          }
        } catch { finish(new Error("Codex returned invalid model metadata.")); }
      }
    });
    child.stderr.resume(); // Diagnostics may contain unrelated local paths; never return them to the UI.
    child.stdin.on("error", () => {});
    child.on("error", error => finish(new Error(`Codex model discovery could not start: ${cleanError(error)}`)));
    child.on("close", () => { if (!done) finish(new Error("Codex closed before returning its model catalogue.")); });
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "one_more_replay", version: "0.1.0" } } });
    if (signal?.aborted) abort();
  });
}

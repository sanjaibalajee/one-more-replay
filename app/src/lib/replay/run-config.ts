import { createHash } from "node:crypto";
import { privateSettings } from "./store";
import type { Job, Settings } from "./types";

export const connectionId = (key: string) => createHash("sha256").update(key).digest("hex");
export function captureRunSettings(kind: Job["kind"], brandContext?: string): Settings {
  const { apifyToken, openaiKey, ...settings } = privateSettings();
  return { ...settings, brandContext: brandContext ?? settings.brandContext,
    connectionId: kind === "collect" ? connectionId(apifyToken) : settings.provider === "openai" ? connectionId(openaiKey) : undefined };
}
export function assertConnection(settings: Settings, key: string) {
  if (settings.connectionId && settings.connectionId !== connectionId(key)) throw new Error("The connection changed after this job was requested. Retry to approve the current connection.");
}

import { isCodexUsageLimit, providerError } from "@/lib/replay/provider-errors";

export function ProviderError({ message }: { message: string }) {
  return <>{providerError(message)}{isCodexUsageLimit(message) && <> <a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">View Codex usage</a></>}</>;
}

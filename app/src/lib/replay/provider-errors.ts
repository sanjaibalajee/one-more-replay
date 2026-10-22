// Also normalize older saved CLI errors at display time without rewriting research records.
export function isCodexUsageLimit(message: string): boolean {
  return /(?:codex|chatgpt|chatgpt\.com)/i.test(message) && /(?:hit your usage limit|usage limit reached)/i.test(message);
}
export function providerError(message: string): string {
  return isCodexUsageLimit(message)
    ? "Codex subscription usage limit reached. Check your ChatGPT usage, or wait for the limit to reset before retrying. Saved reports and media are kept."
    : message;
}

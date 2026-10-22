import type { Account, Reel } from "./types";
import { currentTranscript } from "./transcript";
const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase();
export function buildCatalogueSearch(
  reels: Reel[],
  accounts: Account[],
): Map<string, string> {
  const creators = new Map(
    accounts.map((account) => [account.id, account.username]),
  );
  return new Map(
    reels.map((reel) => {
      const report = reel.analysis;
      const text = [
        reel.caption,
        reel.shortcode,
        creators.get(reel.accountId),
        reel.creatorName,
        reel.annotation?.notes,
        ...(reel.annotation?.tags || []),
        report?.title,
        report?.summary,
        report?.hook.label,
        report?.hook.spokenHook,
        report?.hook.visualHook,
        report?.editorial?.verdict,
        ...(report?.transferablePatterns || []),
        ...(report?.findings || []).map(
          (finding) => `${finding.title} ${finding.detail}`,
        ),
        currentTranscript(reel)?.text,
      ]
        .filter(Boolean)
        .join("\n");
      return [reel.id, normalize(text)];
    }),
  );
}
export function catalogueTerms(query: string) {
  return normalize(query).trim().split(/\s+/u).filter(Boolean);
}
export function catalogueMatches(
  indexed: string | undefined,
  query: string | readonly string[],
) {
  const terms = typeof query === "string" ? catalogueTerms(query) : query;
  return terms.every((term) => indexed?.includes(term));
}

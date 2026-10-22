"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/replay/shared/notice";
import {
  applicableReview,
  transcriptEditVersion,
} from "@/lib/replay/transcript";
import type { Reel } from "@/lib/replay/types";
import styles from "./evidence.module.css";
import { transcriptionLanguages } from "@/lib/replay/transcription-languages";

const names = new Intl.DisplayNames(["en"], { type: "language" });
const languageOverrides: Record<string, string> = {
  ba: "Bashkir",
  bo: "Tibetan",
};
const languages = transcriptionLanguages
  .map((code) => ({
    code,
    name: languageOverrides[code] || names.of(code) || code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

export function TranscriptionRetry({
  reel,
  busy,
  refreshed,
  close,
}: {
  reel: Reel;
  busy: boolean;
  refreshed: () => Promise<void>;
  close: () => void;
}) {
  const [model, setModel] = useState(
    reel.evidence?.transcriptionSettings?.model ||
      reel.evidence?.transcript.model ||
      "base",
  );
  const [language, setLanguage] = useState(
    reel.evidence?.transcriptionSettings?.language ??
      reel.evidence?.transcript.language ??
      "",
  );
  const [replace, setReplace] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [revision] = useState(() => transcriptEditVersion(reel));
  const hasCorrections = Boolean(applicableReview(reel));
  return (
    <form
      className={styles.retry}
      aria-label="Transcribe again"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        try {
          const response = await fetch("/api/replay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "transcript-retry",
              reelId: reel.id,
              expectedRevision: revision,
              options: { model, language: language.trim().toLowerCase() },
              replaceCorrections: replace,
            }),
          });
          const result = await response.json();
          if (!response.ok)
            throw new Error(result.error || "Could not start transcription.");
          await refreshed();
          close();
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not start transcription.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div>
        <h4>Transcribe again</h4>
        <p className={styles.note}>
          Runs locally, with word timing. Your report stays available. A new
          model may download on first use.
        </p>
      </div>
      <div className={styles.retryFields}>
        <label>
          Recognition model
          <NativeSelect
            value={model}
            disabled={pending}
            onChange={(event) => setModel(event.target.value)}
          >
            <option value="tiny">Tiny · fastest</option>
            <option value="base">Base · quick</option>
            <option value="small">Small · more detail</option>
            <option value="medium">Medium · slower</option>
            <option value="large-v3">Large v3 · most demanding</option>
            <option value="turbo">Turbo · larger, faster model</option>
          </NativeSelect>
        </label>
        <label>
          Spoken language
          <NativeSelect
            autoFocus
            value={language}
            disabled={pending}
            onChange={(event) => setLanguage(event.target.value)}
          >
            <option value="">Detect automatically</option>
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <p className={styles.note}>
        Choose the main spoken language if detection was wrong. Mixed-language
        speech may still need corrections.
      </p>
      {hasCorrections && (
        <label className={styles.confirm}>
          <Checkbox
            checked={replace}
            disabled={pending}
            onCheckedChange={(value) => setReplace(value === true)}
          />
          Replace my saved wording corrections if this succeeds. Export them
          first if you need a copy.
        </label>
      )}
      {error && <Notice danger>{error}</Notice>}
      <div className={styles.retryFooter}>
        <span className={styles.note}>No LLM tokens or API charge.</span>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy || pending || (hasCorrections && !replace)}
          >
            {pending ? "Starting…" : "Transcribe locally"}
          </Button>
        </div>
      </div>
    </form>
  );
}

"use client";
import { type Action } from "@/components/replay/shared/action";
import { Notice } from "@/components/replay/shared/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, type FormEvent } from "react";

export function ImportForm({
  accountId,
  busy,
  run,
  done,
}: {
  accountId?: string;
  busy: boolean;
  run: Action;
  done: () => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (!file || !accountId)
        throw new Error("Select an account and a JSON file.");
      if (file.size > 5_000_000) throw new Error("Use a JSON file under 5 MB.");
      const parsed = JSON.parse(await file.text()),
        rows = Array.isArray(parsed) ? parsed : parsed.items;
      if (!Array.isArray(rows))
        throw new Error(
          "The file must contain an array of Apify Reel records.",
        );
      if (await run({ action: "import", accountId, rows })) done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read the file.");
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <Label>
        Apify JSON export
        <Input
          type="file"
          accept=".json,application/json"
          required
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </Label>
      <Notice>
        Import one account at a time. Captions, dates, media links, and
        available counts are preserved. Existing reports stay saved.
      </Notice>
      {error && <Notice danger>{error}</Notice>}
      <Button
        variant="default"
        className="btn primary"
        disabled={busy || !accountId}
      >
        Import Reels
      </Button>
    </form>
  );
}

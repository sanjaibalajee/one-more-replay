"use client";
import { Notice } from "@/components/replay/shared/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";

export function UploadForm({
  accountId,
  reelId,
  done,
}: {
  accountId?: string;
  reelId?: string;
  done: (id: string) => void | Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (accountId) form.set("accountId", accountId);
      if (reelId) form.set("reelId", reelId);
      const response = await fetch("/api/replay/upload", {
          method: "POST",
          body: form,
        }),
        result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await done(result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <Label>
        Video file
        <Input
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          required
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </Label>
      {reelId && (
        <Notice>
          Replacing this video clears its transcript and report so they can be
          regenerated from the new file.
        </Notice>
      )}
      {error && <Notice danger>{error}</Notice>}
      <Button
        variant="default"
        className="btn primary"
        disabled={busy || !file}
      >
        {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
        {busy ? "Uploading…" : "Add video"}
      </Button>
    </form>
  );
}

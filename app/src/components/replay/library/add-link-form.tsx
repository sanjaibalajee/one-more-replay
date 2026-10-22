"use client";
import { type Action } from "@/components/replay/shared/action";
import { Notice } from "@/components/replay/shared/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2 } from "lucide-react";
import { useState, type FormEvent } from "react";

export function AddLink({
  run,
  done,
  busy,
  error,
}: {
  run: Action;
  done: (id: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [url, setUrl] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await run<{ id: string }>({ action: "link", url });
    if (result) done(result.id);
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      {error && <Notice danger>{error}</Notice>}
      <Label>
        Video URL
        <Input
          autoFocus
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/…"
        />
      </Label>
      <Notice>
        Instagram Reels, full TikTok video links and YouTube Shorts. Saves one
        video and fetches its public details. No Apify credits or AI analysis.
      </Notice>
      <p className="field-note">
        If the platform blocks access, you can upload the video to the saved
        link. Public videos under 10 minutes and 150 MB.
      </p>
      <Button variant="default" className="btn primary" disabled={busy}>
        <Link2 size={15} />
        Add video link
      </Button>
    </form>
  );
}

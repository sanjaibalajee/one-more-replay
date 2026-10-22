"use client";
import { ready } from "@/components/replay/research/helpers";
import { type Action } from "@/components/replay/shared/action";
import { Notice } from "@/components/replay/shared/notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Reel } from "@/lib/replay/types";
import { Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";

export function AdaptForm({
  reel,
  run,
  done,
  busy,
  error,
  brief,
}: {
  reel: Reel;
  run: Action;
  done: () => void;
  busy: boolean;
  error: string | null;
  brief?: string;
}) {
  const [topic, setTopic] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await run({ action: "adapt", reelId: reel.id, topic })) done();
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      {error && <Notice danger>{error}</Notice>}
      <p>
        Borrow the mechanism behind{" "}
        <strong>{reel.analysis?.hook.label || "this opening"}</strong> and turn
        it into three original concepts.
      </p>
      <Label>
        What do you want to make a video about?
        <Textarea
          required
          maxLength={3000}
          rows={3}
          placeholder="A specific topic, audience problem or offer…"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
      </Label>
      <Notice>
        {brief
          ? `Uses your saved creator brief: ${brief}`
          : "No creator brief is saved. Add your audience, language and production constraints in Connections for more useful ideas."}
      </Notice>
      <p className="field-note">
        Uses the selected model and its plan limits or API billing. Saves a
        separate report with opening lines, shot lists and a test for each
        concept.
      </p>
      <Button
        variant="default"
        className="btn primary"
        disabled={busy || !ready(reel)}
      >
        <Sparkles size={15} />
        Create three concepts
      </Button>
    </form>
  );
}

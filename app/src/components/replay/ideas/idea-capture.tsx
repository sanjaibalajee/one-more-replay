"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { Action } from "@/components/replay/shared/action";
import type { IdeaSession } from "@/lib/replay/idea-types";

export function IdeaCapture({
  run,
  busy,
  created,
}: {
  run: Action;
  busy: boolean;
  created: (id: string) => void;
}) {
  const [text, setText] = useState(() => {
    try {
      const saved = sessionStorage.getItem("replay:new-idea");
      if (saved && saved.length <= 5000) return saved;
    } catch {
      /* Capture still works without browser storage. */
    }
    return "";
  });
  const [id] = useState(() => crypto.randomUUID());
  function change(value: string) {
    setText(value);
    try {
      sessionStorage.setItem("replay:new-idea", value);
    } catch {
      /* The server save remains available. */
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    const idea = await run<IdeaSession>({
      action: "idea-create",
      id,
      text: text.trim(),
    });
    if (idea) {
      try {
        sessionStorage.removeItem("replay:new-idea");
      } catch {
        /* Saved on the server. */
      }
      created(idea.id);
    }
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      <Field>
        <FieldLabel htmlFor="new-idea-text">
          What would you like to make?
        </FieldLabel>
        <Textarea
          id="new-idea-text"
          autoFocus
          required
          rows={7}
          maxLength={5000}
          value={text}
          onChange={(event) => change(event.target.value)}
          placeholder="A rough thought, an opening line, or a script you’re already working on…"
        />
      </Field>
      <p className="field-note">
        Saved on this computer. No AI call or analysis needed.
      </p>
      <Button type="submit" disabled={busy || !text.trim()}>
        {busy ? "Saving…" : "Save idea"}
      </Button>
    </form>
  );
}

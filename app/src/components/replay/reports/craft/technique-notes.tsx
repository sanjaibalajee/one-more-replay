"use client";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { CraftNote } from "@/lib/replay/craft/schema";
import { techniqueLabels } from "@/lib/replay/craft/techniques";
import styles from "./technique-notes.module.css";

export function TechniqueNotes({
  notes,
  proof,
}: {
  notes?: CraftNote[];
  proof: (ids?: string[]) => ReactNode;
}) {
  if (!notes?.length) return null;
  return (
    <section className={styles.notes} aria-label="Creative techniques">
      <h3>Techniques to learn from</h3>
      <p className={styles.intro}>
        What the device does, where it can fall short, and how to borrow it.
        Audience effects are editorial hypotheses.
      </p>
      {notes.map((note) => (
        <article key={note.technique}>
          <header>
            <h4>{techniqueLabels[note.technique]}</h4>
            <Badge variant="secondary">
              {note.status === "observed" ? "Observed device" : "Tentative"}
            </Badge>
          </header>
          <p>{note.observation}</p>
          {proof(note.evidenceIds)}
          <dl>
            <dt>What it does</dt>
            <dd>{note.mechanism}</dd>
            <dt>The tradeoff</dt>
            <dd>{note.tradeoff}</dd>
            <dt>Try the principle</dt>
            <dd>{note.adaptation}</dd>
          </dl>
        </article>
      ))}
    </section>
  );
}

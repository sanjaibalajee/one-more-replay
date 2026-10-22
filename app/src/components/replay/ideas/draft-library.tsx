"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { NativeSelect } from "@/components/ui/native-select";
import { ideaStages, stageLabel } from "@/lib/replay/idea-workflow";
import type { IdeaSession } from "@/lib/replay/idea-types";
import { scriptLengthLabel } from "@/lib/replay/script";
import styles from "./ideas.module.css";

export function DraftLibrary({
  ideas,
  query,
  open,
}: {
  ideas: IdeaSession[];
  query: string;
  open?: (id: string) => void;
}) {
  const [stage, setStage] = useState("all");
  const matches = ideas.filter(
    (idea) =>
      idea.savedDraft &&
      (stage === "all" || (idea.stage || "draft") === stage) &&
      `${idea.savedDraft.title} ${idea.savedDraft.hook} ${idea.savedDraft.body} ${idea.savedDraft.notes}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <section className={styles.library} aria-label="My drafts">
      <div className={styles.libraryHeader}>
        <h2>My drafts</h2>
        <NativeSelect
          aria-label="Filter draft stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
        >
          <option value="all">All stages</option>
          {ideaStages.map((stage) => (
            <option key={stage} value={stage}>
              {stageLabel(stage)}
            </option>
          ))}
        </NativeSelect>
      </div>
      {matches.length ? (
        <div className="pattern-grid">
          {matches.map((idea) => (
            <Card key={idea.id}>
              <CardHeader>
                <div className={styles.cardStage}>
                  <Badge variant="secondary">{stageLabel(idea.stage)}</Badge>
                  <small>{scriptLengthLabel(idea.savedDraft!)}</small>
                </div>
                <CardTitle>{idea.savedDraft!.title}</CardTitle>
                <CardDescription>
                  {idea.sourceKind === "manual"
                    ? "Your own idea"
                    : `From ${idea.sourceTitle}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="saved-idea-hook">
                  {idea.savedDraft!.hook || idea.savedDraft!.body}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => open?.(idea.id)}
                >
                  Open draft
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="empty-state">
          <h3>
            {query || stage !== "all"
              ? "No matching drafts"
              : "Your next video starts here"}
          </h3>
          <p>
            {query || stage !== "all"
              ? "Try another search or stage."
              : "Capture an idea, or save a concept from a report. You can write it yourself and use chat only when helpful."}
          </p>
        </Empty>
      )}
    </section>
  );
}

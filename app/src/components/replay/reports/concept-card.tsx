"use client";
import { ConceptProduction } from "./concept-production";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Analysis } from "@/lib/replay/types";
import {
  Bookmark,
  Check,
  Copy,
  MoreHorizontal,
  PencilLine,
} from "lucide-react";
import { useState, type ReactNode } from "react";

export type Idea = Analysis["suggestedAngles"][number];

export function conceptScript(idea: Idea) {
  return {
    hook: idea.opening,
    body: idea.body || idea.structure,
    cta: idea.cta || "No separate CTA was saved in this older report.",
  };
}

export function Concept({
  idea,
  index,
  citations,
  refine,
  save,
}: {
  idea: Idea;
  index: number;
  citations?: ReactNode;
  refine?: () => void;
  save?: () => Promise<boolean>;
}) {
  const [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false);
  async function saveIdea() {
    if (!save) return;
    setSaving(true);
    try {
      setSaved(await save());
    } finally {
      setSaving(false);
    }
  }
  const [copied, setCopied] = useState(false),
    [copyError, setCopyError] = useState(false),
    script = conceptScript(idea);
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `Hook\n${script.hook}\n\nBody\n${script.body}\n\nCTA\n${script.cta}`,
      );
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <Card role="article" className="idea concept-card">
      <div className="idea-heading">
        <span>Concept {index + 1}</span>
        <span>
          {idea.format?.replaceAll("-", " ")}
          {idea.durationSeconds ? ` · ${idea.durationSeconds}s` : ""}
        </span>
      </div>
      <h3>{idea.idea}</h3>
      <div
        className="script-sections"
        aria-label={`Script for concept ${index + 1}`}
      >
        {(["hook", "body", "cta"] as const).map((section, i) => (
          <section
            className={`script-block ${section}`}
            key={section}
            data-script-section={section}
          >
            <div className="script-label">
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h4>
                {section === "cta"
                  ? "CTA"
                  : section.charAt(0).toUpperCase() + section.slice(1)}
              </h4>
            </div>
            <p>{script[section]}</p>
          </section>
        ))}
      </div>
      <div className="concept-actions">
        {refine && (
          <Button size="sm" onClick={refine}>
            <PencilLine size={14} />
            Edit idea
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Actions for concept ${index + 1}`}
            >
              <MoreHorizontal size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {save && (
              <DropdownMenuItem
                disabled={saving || saved}
                onSelect={() => void saveIdea()}
              >
                {saved ? <Check size={14} /> : <Bookmark size={14} />}{" "}
                {saved
                  ? "Saved to Inspiration"
                  : saving
                    ? "Saving…"
                    : "Save idea"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => void copy()}>
              <Copy size={14} />
              {copied ? "Copied" : "Copy script"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {saved && (
          <span className="muted" role="status">
            Saved to Inspiration
          </span>
        )}
        {copied && (
          <span className="muted" role="status">
            Hook, body and CTA copied.
          </span>
        )}
        {copyError && (
          <span className="muted" role="status">
            Could not copy. Select the script text or export Markdown.
          </span>
        )}
      </div>
      <ConceptProduction idea={idea} citations={citations} />
    </Card>
  );
}

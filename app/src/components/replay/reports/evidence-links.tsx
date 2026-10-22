"use client";
import { clock } from "@/components/replay/shared/format";
import { Button } from "@/components/ui/button";
import { type EvidenceSource } from "@/lib/replay/evidence";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export function EvidenceLinks({
  ids,
  sources,
  select,
}: {
  ids?: string[];
  sources: EvidenceSource[];
  select: (source: EvidenceSource) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!ids?.length) return null;
  const available = [...new Set(ids)]
    .map((id) => sources.find((source) => source.id === id))
    .filter((source) => source !== undefined);
  return (
    <div className="evidence-links" aria-label="Supporting evidence">
      {(expanded ? available : available.slice(0, 2)).map((source) => {
        return (
          <Button
            variant="ghost"
            key={source.id}
            className="evidence-link"
            title={source.text}
            onClick={() => select(source)}
          >
            {source.seconds !== null && <span>{clock(source.seconds)}</span>}
            {source.kind === "frame" ? "Frame" : source.label}
            <ArrowRight size={11} />
          </Button>
        );
      })}
      {available.length > 2 && (
        <Button
          variant="ghost"
          className="evidence-link evidence-more"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Fewer sources" : `+${available.length - 2} sources`}
        </Button>
      )}
    </div>
  );
}

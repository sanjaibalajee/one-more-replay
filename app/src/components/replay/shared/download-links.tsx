"use client";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, FileJson } from "lucide-react";

export function DownloadLinks({
  id,
  comparison = false,
  research = false,
}: {
  id: string;
  comparison?: boolean;
  research?: boolean;
}) {
  const base = `/api/replay/export?id=${encodeURIComponent(id)}${research ? "&type=research" : comparison ? "&type=comparison" : ""}`;
  return (
    <div className="button-row">
      <Button asChild variant="outline" size="sm" className="btn small">
        <a href={base}>
          <ArrowDownToLine size={14} />
          Markdown
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="btn small">
        <a href={`${base}&format=json`}>
          <FileJson size={14} />
          JSON
        </a>
      </Button>
    </div>
  );
}

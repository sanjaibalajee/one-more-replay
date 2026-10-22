"use client";
import { type Action } from "@/components/replay/shared/action";
import { Notice } from "@/components/replay/shared/notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Collection } from "@/lib/replay/research-types";
import type { Snapshot } from "@/lib/replay/types";
import { Bookmark, FolderPlus } from "lucide-react";
import { useState, type FormEvent } from "react";

export function CollectionPicker({
  data,
  ids,
  run,
  close,
  busy,
  error,
}: {
  data: Snapshot;
  ids: string[];
  run: Action;
  close: () => void;
  busy: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  async function add(id: string) {
    if (await run({ action: "collection-add", id, reelIds: ids })) close();
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    const result = await run<Collection>({ action: "collection", name });
    if (result) await add(result.id);
  }
  return (
    <div className="form-stack">
      {error && <Notice danger>{error}</Notice>}
      <p className="muted">
        Add {ids.length} selected {ids.length === 1 ? "video" : "videos"}. A
        video can belong to several collections.
      </p>
      <div className="collection-choices">
        {data.collections.map((c) => (
          <Button
            variant="outline"
            className="btn"
            disabled={busy}
            key={c.id}
            onClick={() => void add(c.id)}
          >
            <Bookmark size={15} />
            {c.name}
            <small>{c.reelIds.length}</small>
          </Button>
        ))}
      </div>
      <form className="form-stack" onSubmit={create}>
        <Label>
          New collection name
          <Input
            required
            maxLength={80}
            placeholder="Hooks to test"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Label>
        <Button variant="default" className="btn primary" disabled={busy}>
          <FolderPlus size={15} />
          Create & add videos
        </Button>
      </form>
    </div>
  );
}

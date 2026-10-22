"use client";
import { ready } from "@/components/replay/research/helpers";
import { type Action } from "@/components/replay/shared/action";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { ctaTypes, hookTypes, humanize } from "@/lib/replay/research-types";
import type { Reel } from "@/lib/replay/types";
import { FolderPlus, Sparkles } from "lucide-react";
import { useState } from "react";

export function ReelResearchTools({
  reel,
  run,
  busy,
  add,
  adapt,
}: {
  reel: Reel;
  run: Action;
  busy: boolean;
  add: () => void;
  adapt: () => void;
}) {
  const [notes, setNotes] = useState(reel.annotation?.notes || ""),
    [tags, setTags] = useState(reel.annotation?.tags.join(", ") || "");
  const [hook, setHook] = useState<string>(
      reel.annotation?.hookType || "unknown",
    ),
    [cta, setCta] = useState<string>(reel.annotation?.ctaType || "unknown"),
    [saved, setSaved] = useState(false);
  return (
    <div className="research-tools">
      <div className="button-row">
        <Button variant="outline" className="btn small" onClick={add}>
          <FolderPlus size={14} />
          Add to collection
        </Button>
        <Button
          variant="outline"
          className="btn small"
          disabled={!ready(reel) || busy}
          title={
            !ready(reel)
              ? "Run evidence-linked analysis first"
              : "Create original concepts for your topic"
          }
          onClick={adapt}
        >
          <Sparkles size={14} />
          Adapt this pattern
        </Button>
      </div>
      {!ready(reel) && (
        <p className="muted">
          Analyze this video to adapt its pattern. Older reports need Analyze
          again for source links.
        </p>
      )}
      <Disclosure title={<>Notes & categories</>}>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run({
              action: "annotate",
              reelId: reel.id,
              annotation: {
                notes,
                tags: [
                  ...new Set(
                    tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  ),
                ],
                hookType: hook,
                ctaType: cta,
              },
            }).then((r) => {
              if (r) setSaved(true);
            });
          }}
        >
          <Label>
            Your notes
            <Textarea
              value={notes}
              maxLength={5000}
              rows={3}
              onChange={(e) => {
                setNotes(e.target.value);
                setSaved(false);
              }}
              placeholder="What is worth remembering or trying?"
            />
          </Label>
          <Label>
            Tags, separated by commas
            <Input
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                setSaved(false);
              }}
              placeholder="product reveal, low budget, Tamil"
            />
          </Label>
          <div className="form-columns">
            <Label>
              Hook category
              <NativeSelect
                aria-label="Hook category"
                value={hook}
                onChange={(e) => {
                  setHook(e.target.value);
                  setSaved(false);
                }}
              >
                {hookTypes.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <Label>
              CTA category
              <NativeSelect
                aria-label="CTA category"
                value={cta}
                onChange={(e) => {
                  setCta(e.target.value);
                  setSaved(false);
                }}
              >
                {ctaTypes.map((t) => (
                  <option key={t} value={t}>
                    {humanize(t)}
                  </option>
                ))}
              </NativeSelect>
            </Label>
          </div>
          <p className="field-note">
            Unknown uses the analysis category when available. Your category
            overrides the model without changing its report. Notes and tags are
            searchable in Inspiration. Use up to 12 tags, 40 characters each.
          </p>
          <div className="button-row">
            <Button variant="outline" className="btn small" disabled={busy}>
              Save notes
            </Button>
            {saved && (
              <span className="muted" role="status">
                Saved
              </span>
            )}
          </div>
        </form>
      </Disclosure>
    </div>
  );
}

"use client";
import { Card } from "@/components/ui/card";
/* eslint-disable @next/next/no-img-element -- Local frames and allowlisted proxy images. */
import { phaseLabel } from "@/components/replay/jobs/job-state";
import { CreatorIdentity } from "@/components/replay/shared/creator-identity";
import { clock, date, fmt } from "@/components/replay/shared/format";
import { asset, image } from "@/components/replay/shared/media-url";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { platformFor, platformLabel } from "@/lib/replay/research-types";
import type { Account, Reel } from "@/lib/replay/types";
import {
  ArrowRight,
  CheckCheck,
  Clapperboard,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Star,
} from "lucide-react";
import { useState } from "react";

export function ReelCard({
  reel,
  account,
  selected,
  selectionFull,
  toggle,
  open,
  star,
}: {
  reel: Reel;
  account?: Account;
  selected: boolean;
  selectionFull: boolean;
  toggle: () => void;
  open: () => void;
  star: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = reel.evidence?.frames[0]
    ? asset(reel.id, reel.evidence.frames[0].file)
    : reel.thumbnail
      ? image(reel.thumbnail)
      : "";
  return (
    <Card
      role="article"
      className={`reel-card ${selected ? "is-selected" : ""}`}
    >
      <div className="reel-preview">
        <Button
          variant="ghost"
          className="reel-cover"
          onClick={open}
          aria-label={`Open Reel: ${reel.caption.slice(0, 70) || reel.shortcode}`}
        >
          {src && src !== failedSrc ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              onError={() => setFailedSrc(src)}
            />
          ) : (
            <div className="thumbnail-fallback">
              <Clapperboard size={32} strokeWidth={1.2} />
              <span>
                {reel.source === "upload"
                  ? "Uploaded video"
                  : platformLabel[platformFor(reel)]}
              </span>
            </div>
          )}
          <span className="preview-shade" />
        </Button>
        <Checkbox
          className="reel-checkbox"
          aria-label={`Select Reel ${reel.source === "upload" ? reel.id : reel.shortcode}`}
          checked={selected}
          disabled={!selected && selectionFull}
          onCheckedChange={toggle}
        />
        <Button
          variant="ghost"
          className={`star-button ${reel.starred ? "starred" : ""}`}
          title={reel.starred ? "Remove from saved" : "Save Reel"}
          aria-label={reel.starred ? "Unsave Reel" : "Save Reel"}
          aria-pressed={reel.starred}
          onClick={star}
        >
          <Star size={15} fill={reel.starred ? "currentColor" : "none"} />
        </Button>
        <div className="preview-bottom">
          <span>
            <Clapperboard size={12} />
            {reel.evidence ? clock(reel.evidence.duration) : "REEL"}
          </span>
          {reel.performance?.multiple != null &&
            reel.performance.quality !== "weak" && (
              <span
                className={`baseline-badge ${reel.performance.multiple >= 2 ? "outlier" : ""}`}
              >
                {reel.performance.multiple.toFixed(1)}×{" "}
                {reel.performance.cohort === "similar"
                  ? "similar Reels"
                  : "account"}
              </span>
            )}
        </div>
      </div>
      <div className="reel-card-body">
        <div className="reel-byline">
          <span>
            <CreatorIdentity reel={reel} account={account} />
          </span>
          <span>
            {date(reel.postedAt)}
            {reel.performance?.ageDays != null && (
              <small>
                {Math.floor(reel.performance.ageDays)}d at collection
              </small>
            )}
          </span>
        </div>
        <p className="reel-caption">{reel.caption || "No caption supplied."}</p>
        <div className="reel-metrics">
          <span title="Views">
            <Eye size={13} />
            {fmt(reel.views)}
          </span>
          <span title="Likes">
            <Heart size={12} />
            {fmt(reel.likes)}
          </span>
          <span title="Comments">
            <MessageCircle size={12} />
            {fmt(reel.comments)}
          </span>
        </div>
        <Button
          variant="ghost"
          className={`reel-report-link ${reel.analysis ? "ready" : reel.status === "failed" ? "failed" : ""}`}
          onClick={open}
        >
          {reel.analysis ? (
            <>
              <CheckCheck size={13} />
              Report ready
            </>
          ) : reel.status === "failed" ? (
            "Analysis needs a retry"
          ) : ["idle", "cancelled"].includes(reel.status) ? (
            "Open Reel"
          ) : (
            <>
              <Loader2 size={13} className="spin" />
              {phaseLabel(reel.status)}
            </>
          )}
          <ArrowRight size={13} />
        </Button>
      </div>
    </Card>
  );
}

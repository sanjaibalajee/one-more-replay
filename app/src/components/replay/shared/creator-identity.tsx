"use client";
import { image } from "@/components/replay/shared/media-url";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  platformFor,
  platformLabel,
  type Platform,
} from "@/lib/replay/research-types";
import type { Account, Reel } from "@/lib/replay/types";
import { Clapperboard } from "lucide-react";

export function PlatformMark({
  platform,
  label = false,
}: {
  platform: Platform;
  label?: boolean;
}) {
  return (
    <span
      className="platform-mark"
      role={label ? undefined : "img"}
      aria-label={label ? undefined : platformLabel[platform]}
      title={platformLabel[platform]}
    >
      {platform === "local" ? (
        <Clapperboard size={13} aria-hidden />
      ) : (
        <span
          className="platform-glyph"
          aria-hidden
          style={{
            maskImage: `url(/platforms/${platform}.svg)`,
            WebkitMaskImage: `url(/platforms/${platform}.svg)`,
          }}
        />
      )}
      {label && <span>{platformLabel[platform]}</span>}
    </span>
  );
}

export function ProfileAvatar({
  name,
  src,
  platform,
  size = "small",
  badge = true,
}: {
  name: string;
  src?: string;
  platform: Platform;
  size?: "small" | "large";
  badge?: boolean;
}) {
  return (
    <span className={`profile-avatar ${size}`}>
      <Avatar
        className="profile-picture"
        size={size === "large" ? "lg" : "default"}
      >
        {src && (
          <AvatarImage
            src={image(src)}
            alt={`${name} profile`}
            loading="lazy"
          />
        )}
        <AvatarFallback aria-hidden>
          {name.replace(/^@/, "").slice(0, 1).toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      {badge && (
        <span className="avatar-platform" aria-hidden>
          <PlatformMark platform={platform} />
        </span>
      )}
    </span>
  );
}

export function creatorLabel(reel: Reel, account?: Account) {
  return (
    reel.creatorName ||
    (account?.kind === "inbox"
      ? "Creator unavailable"
      : account?.username === "local_uploads"
        ? "Local video"
        : account
          ? `@${account.username}`
          : "Creator unavailable")
  );
}

export function CreatorIdentity({
  reel,
  account,
}: {
  reel: Reel;
  account?: Account;
}) {
  const label = creatorLabel(reel, account),
    src =
      reel.creatorAvatarUrl ||
      (account?.kind !== "inbox" ? account?.profileImageUrl : undefined);
  return (
    <span className="creator-identity">
      <ProfileAvatar
        name={label}
        src={src}
        platform={platformFor(reel)}
        badge={false}
      />
      <span>
        <strong>{label}</strong>
        <PlatformMark platform={platformFor(reel)} label />
      </span>
    </span>
  );
}

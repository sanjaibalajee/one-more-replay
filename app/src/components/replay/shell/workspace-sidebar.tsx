"use client";

import { ProfileAvatar } from "@/components/replay/shared/creator-identity";
import type { View } from "@/components/replay/workspace/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Readiness, Snapshot } from "@/lib/replay/types";
import {
  MoreHorizontal,
  BarChart3,
  Bookmark,
  Coins,
  FolderHeart,
  Layers2,
  Plus,
  Repeat2,
  ScanSearch,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";

const navigation = [
  { id: "library", label: "Reel library", icon: Layers2 },
  { id: "inspiration", label: "Inspiration", icon: Bookmark },
  { id: "analytics", label: "Niche analytics", icon: BarChart3 },
  { id: "gaps", label: "Creative gaps", icon: ScanSearch },
  { id: "reports", label: "Reports", icon: FolderHeart },
  { id: "usage", label: "Usage & costs", icon: Coins },
  { id: "connections", label: "Connections", icon: Settings2 },
] as const;

export function WorkspaceSidebar({
  data,
  health,
  view,
  accountId,
  navigate,
  selectAccount,
  addAccount,
}: {
  data: Snapshot | null;
  health: Readiness | null;
  view: View;
  accountId: string;
  navigate: (view: View) => void;
  selectAccount: (id: string) => void;
  addAccount: () => void;
}) {
  const reportCount =
    (data?.reels.filter((reel) => reel.analysis).length || 0) +
    (data?.comparisons.length || 0) +
    (data?.research.length || 0);
  const api = data?.settings.provider === "openai";
  const connected = api
    ? data?.settings.hasOpenaiKey
    : health?.codex.subscription;
  return (
    <aside className="replay-sidebar">
      <Link href="/" className="brand" aria-label="One More Replay home">
        <span className="brand-icon">
          <Repeat2 size={23} strokeWidth={2.3} />
        </span>
        <span>One More Replay</span>
      </Link>
      <nav className="main-nav" aria-label="Main navigation">
        {navigation
          .filter((item) =>
            ["library", "inspiration", "reports"].includes(item.id),
          )
          .map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              className={`nav-link ${view === id ? "chosen" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={17} />
              {label}
              {id === "library" && <span>{data?.reels.length || 0}</span>}
              {id === "reports" && <span>{reportCount}</span>}
            </Button>
          ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`nav-link ${!["library", "inspiration", "reports"].includes(view) ? "chosen" : ""}`}
            >
              <MoreHorizontal size={17} />
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {navigation
              .filter(
                (item) =>
                  !["library", "inspiration", "reports"].includes(item.id),
              )
              .map(({ id, label, icon: Icon }) => (
                <DropdownMenuItem key={id} onSelect={() => navigate(id)}>
                  <Icon size={16} />
                  {label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <div className="sidebar-section">
        <span className="eyebrow">Accounts</span>
        <Button
          variant="outline"
          className="icon-btn"
          aria-label="Add account"
          onClick={addAccount}
        >
          <Plus size={16} />
        </Button>
      </div>
      <div className="account-list">
        <Button
          variant="ghost"
          className={`account-link ${accountId === "all" && view === "library" ? "chosen" : ""}`}
          onClick={() => selectAccount("all")}
        >
          <span className="avatar all">
            <Users size={15} />
          </span>
          <span>All accounts</span>
        </Button>
        {data?.accounts.map((account) => (
          <Button
            variant="ghost"
            key={account.id}
            className={`account-link ${accountId === account.id && view === "library" ? "chosen" : ""}`}
            onClick={() => selectAccount(account.id)}
          >
            <ProfileAvatar
              name={account.kind === "inbox" ? account.label : account.username}
              src={account.profileImageUrl}
              platform={
                account.platform ||
                (account.username === "local_uploads" ? "local" : "instagram")
              }
            />
            <span>
              {account.kind === "inbox"
                ? account.label
                : account.username === "local_uploads"
                  ? "Local videos"
                  : `@${account.username}`}
            </span>
            <small>
              {account.role === "own" ? "Yours · " : ""}
              {account.reelCount}
            </small>
          </Button>
        ))}
        {!data?.accounts.length && (
          <p className="sidebar-hint">No accounts added.</p>
        )}
      </div>
      <div className="sidebar-bottom">
        <Button
          variant="ghost"
          className="connection-summary"
          onClick={() => navigate("connections")}
        >
          <span className={`status-dot ${connected ? "online" : ""}`} />
          <span>
            {api
              ? connected
                ? "OpenAI API connected"
                : "Connect OpenAI API"
              : connected
                ? "Codex connected"
                : "Connect Codex"}
          </span>
        </Button>
      </div>
    </aside>
  );
}

"use client";
import { CreatorIdentity } from "@/components/replay/shared/creator-identity";
import { download } from "@/components/replay/shared/download-json";
import { date } from "@/components/replay/shared/format";
import { Notice } from "@/components/replay/shared/notice";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  analyticsGroups,
  roleFor,
  type AnalyticsDimension,
} from "@/lib/replay/research";
import {
  humanize,
  platformFor,
  platformLabel,
  roles,
} from "@/lib/replay/research-types";
import type { Snapshot } from "@/lib/replay/types";
import { ArrowRight, Download } from "lucide-react";
import { useMemo, useState } from "react";

export function Analytics({
  data,
  open,
}: {
  data: Snapshot;
  open: (id: string) => void;
}) {
  const [account, setAccount] = useState("all"),
    [platform, setPlatform] = useState("all"),
    [role, setRole] = useState("all"),
    [collection, setCollection] = useState("all"),
    [days, setDays] = useState("all"),
    [dimension, setDimension] = useState<AnalyticsDimension>("hook"),
    [drill, setDrill] = useState<string | null>(null);
  const [asOf] = useState(() => Date.now());
  const reels = useMemo(
    () =>
      data.reels.filter(
        (r) =>
          (account === "all" || r.accountId === account) &&
          (platform === "all" || platformFor(r) === platform) &&
          (role === "all" ||
            roleFor(data.accounts.find((a) => a.id === r.accountId)!) ===
              role) &&
          (collection === "all" ||
            data.collections
              .find((c) => c.id === collection)
              ?.reelIds.includes(r.id)) &&
          (days === "all" ||
            Boolean(
              r.postedAt &&
              Date.parse(r.postedAt) >= asOf - Number(days) * 86400000,
            )),
      ),
    [data, account, platform, role, collection, days, asOf],
  );
  const groups = analyticsGroups(reels, dimension),
    analyzed = reels.filter((r) => r.analysis),
    known = groups
      .filter((g) => g.key !== "unknown")
      .reduce((n, g) => n + g.count, 0),
    group = groups.find((g) => g.key === drill);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Niche analytics</h1>
          <p>Patterns in your research library. Filters define the sample.</p>
        </div>
        <Button
          variant="outline"
          className="btn"
          onClick={() =>
            download("one-more-replay-analytics.json", {
              filters: {
                account,
                platform,
                role,
                collection,
                postedWithinDays: days,
              },
              dimension,
              videoCount: reels.length,
              groups,
            })
          }
        >
          <Download size={15} />
          Export data
        </Button>
      </div>
      <div className="research-filters">
        <Label>
          Account
          <NativeSelect
            aria-label="Account"
            value={account}
            onChange={(e) => {
              setAccount(e.target.value);
              setDrill(null);
            }}
          >
            <option value="all">All accounts</option>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.kind === "inbox" ? a.label : `@${a.username}`}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label>
          Platform
          <NativeSelect
            aria-label="Platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="all">All platforms</option>
            {Object.entries(platformLabel).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label>
          Account role
          <NativeSelect
            aria-label="Account role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="all">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r === "own" ? "Your account" : humanize(r)}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label>
          Collection
          <NativeSelect
            aria-label="Collection"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
          >
            <option value="all">All collections</option>
            {data.collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Label>
        <Label>
          Published
          <NativeSelect
            aria-label="Published"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="all">Any time</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </NativeSelect>
        </Label>
      </div>
      <div className="research-stats">
        <div>
          <strong>{reels.length}</strong>
          <span>videos in sample</span>
        </div>
        <div>
          <strong>{analyzed.length}</strong>
          <span>with analysis</span>
        </div>
        <div>
          <strong>
            {known} / {reels.length}
          </strong>
          <span>classified for {dimension}</span>
        </div>
        <div>
          <strong>{reels.filter((r) => r.views !== null).length}</strong>
          <span>with public views</span>
        </div>
      </div>
      <Notice>
        {reels.length < 10 ? "Small sample: fewer than 10 videos. " : ""}This is
        your collected library, not the whole niche. Unknown categories stay
        visible. Account-relative medians need 5 videos with matched,
        moderate-quality baselines; cross-creator raw views are never pooled
        into a ranking. This remains descriptive, not causal.
      </Notice>
      <div className="collection-tabs" aria-label="Analytics dimension">
        {["hook", "format", "length", "cta"].map((d) => (
          <Button
            variant="ghost"
            className={dimension === d ? "chosen" : ""}
            key={d}
            onClick={() => {
              setDimension(d as AnalyticsDimension);
              setDrill(null);
            }}
          >
            {d === "cta" ? "CTA" : humanize(d)}
          </Button>
        ))}
      </div>
      <div className="analytics-table-wrap">
        <Table className="analytics-table">
          <TableHeader>
            <TableRow>
              <TableHead>
                {dimension === "cta" ? "CTA" : humanize(dimension)}
              </TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Share</TableHead>
              <TableHead>Creators</TableHead>
              <TableHead>Matched baseline median</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.key}>
                <TableCell>
                  <Button
                    variant="ghost"
                    className="text-link"
                    onClick={() => setDrill(g.key)}
                  >
                    {humanize(g.key)}
                    <ArrowRight size={12} />
                  </Button>
                </TableCell>
                <TableCell>{g.count}</TableCell>
                <TableCell>
                  <span className="share-bar">
                    <i style={{ width: `${g.share * 100}%` }} />
                  </span>
                  {Math.round(g.share * 100)}%
                </TableCell>
                <TableCell>
                  {g.creators}
                  {g.unknownCreators > 0 && (
                    <small>
                      {g.unknownCreators} unknown{" "}
                      {g.unknownCreators === 1 ? "creator" : "creators"}
                    </small>
                  )}
                </TableCell>
                <TableCell>
                  {g.medianMultiple === null
                    ? "Insufficient evidence"
                    : `${g.medianMultiple.toFixed(2)}× own-account median`}
                  <small>
                    {g.baselineCount} usable baseline{" "}
                    {g.baselineCount === 1 ? "example" : "examples"}
                  </small>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!groups.length && (
        <p className="research-empty">No videos match these filters.</p>
      )}
      {group && (
        <section className="research-section">
          <div className="section-heading">
            <h2>{humanize(group.key)} examples</h2>
            <Button
              variant="ghost"
              className="text-link"
              onClick={() => setDrill(null)}
            >
              Close
            </Button>
          </div>
          <div className="research-example-list">
            {reels
              .filter((r) => group.reelIds.includes(r.id))
              .map((r) => (
                <Button variant="ghost" key={r.id} onClick={() => open(r.id)}>
                  <span>
                    <CreatorIdentity
                      reel={r}
                      account={data.accounts.find((a) => a.id === r.accountId)}
                    />
                    <span>
                      {r.analysis?.title ||
                        r.caption.slice(0, 120) ||
                        "Unanalyzed video"}
                    </span>
                  </span>
                  <small>
                    {date(r.postedAt)}
                    <br />
                    {r.analysis ? "Open evidence" : "Analyze to classify"}
                  </small>
                  <ArrowRight size={15} />
                </Button>
              ))}
          </div>
        </section>
      )}
    </>
  );
}

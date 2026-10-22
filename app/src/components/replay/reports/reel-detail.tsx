"use client";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
/* eslint-disable @next/next/no-img-element -- Local frames and allowlisted proxy images. */
import { JobProgress } from "@/components/replay/jobs/job-progress";
import { UploadForm } from "@/components/replay/library/upload-form";
import { Concept } from "@/components/replay/reports/concept-card";
import { EvidenceLinks } from "@/components/replay/reports/evidence-links";
import { ReportSection } from "@/components/replay/reports/report-section";
import { StoryStructure } from "@/components/replay/reports/story-structure";
import { DownloadLinks } from "@/components/replay/shared/download-links";
import { clock, date, fmt } from "@/components/replay/shared/format";
import { asset, image } from "@/components/replay/shared/media-url";
import { Notice } from "@/components/replay/shared/notice";
import { ProviderError } from "@/components/replay/shared/provider-error";
import { UsageReceipt } from "@/components/replay/usage/usage-receipt";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { sourcesFor, type EvidenceSource } from "@/lib/replay/evidence";
import { platformFor, platformLabel } from "@/lib/replay/research-types";
import type { Job, Reel } from "@/lib/replay/types";
import {
  ChevronDown,
  Clapperboard,
  ExternalLink,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const reportTabs = ["overview", "ideas", "evidence"];

const mobileQuery = "(max-width: 620px)";

const subscribeMobile = (callback: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};

const mobileSnapshot = () => window.matchMedia(mobileQuery).matches;

const serverMobileSnapshot = () => false;

export function ReelDetail({
  reel,
  busy,
  analyze,
  refreshed,
  job,
  initialSource,
  refineIdea,
  saveIdea,
}: {
  reel: Reel;
  busy: boolean;
  analyze: (force: boolean) => void;
  refreshed: () => Promise<void>;
  job?: Job;
  initialSource?: string | null;
  refineIdea?: (index: number) => void;
  saveIdea?: (index: number) => Promise<boolean>;
}) {
  const [evidenceTab, setEvidenceTab] = useState("breakdown");
  const [tab, setTab] = useState("overview"),
    [replace, setReplace] = useState(false),
    [source, setSource] = useState<EvidenceSource | null>(
      () =>
        sourcesFor(reel).find((source) => source.id === initialSource) || null,
    ),
    [playerError, setPlayerError] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(Boolean(initialSource)),
    mobile = useSyncExternalStore(
      subscribeMobile,
      mobileSnapshot,
      serverMobileSnapshot,
    );
  const videoRef = useRef<HTMLVideoElement>(null),
    playerRef = useRef<HTMLDivElement>(null);
  const a = reel.analysis,
    sources = sourcesFor(reel),
    hasVideo = Boolean(
      reel.evidence || reel.mediaRevision || reel.source === "upload",
    );
  const initialSeconds = sourcesFor(reel).find(
    (source) => source.id === initialSource,
  )?.seconds;
  const videoSrc = `${asset(reel.id, "video.mp4")}?v=${encodeURIComponent(reel.mediaRevision || reel.analyzedAt || reel.collectedAt)}`;
  useEffect(() => {
    const video = videoRef.current;
    if (video && !video.getAttribute("src")) {
      video.src = videoSrc;
      video.load();
    }
    const seekInitial = () => {
      if (video && initialSeconds != null) video.currentTime = initialSeconds;
    };
    if (video?.readyState) seekInitial();
    else video?.addEventListener("loadedmetadata", seekInitial, { once: true });
    return () => {
      if (video) {
        video.removeEventListener("loadedmetadata", seekInitial);
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [initialSeconds, hasVideo, videoSrc]);
  function seek(seconds: number) {
    setMediaOpen(true);
    const video = videoRef.current;
    if (video) {
      const playAt = () => {
        video.currentTime = seconds;
        void video.play().catch(() => {});
      };
      if (video.readyState >= 1) playAt();
      else video.addEventListener("loadedmetadata", playAt, { once: true });
      if (window.innerWidth <= 850)
        playerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }
  }
  function selectSource(value: EvidenceSource) {
    setMediaOpen(true);
    setSource(value);
    if (value.seconds !== null) seek(value.seconds);
  }
  const proof = (ids?: string[]) => (
    <EvidenceLinks ids={ids} sources={sources} select={selectSource} />
  );
  const performance = reel.performance;
  const section = tab === "evidence" ? evidenceTab : tab;
  return (
    <div className="reel-detail">
      <aside className="detail-media" data-collapsed={mobile && !mediaOpen}>
        <Button
          variant="ghost"
          className="mobile-media-toggle"
          aria-label="Video and metrics"
          aria-expanded={!mobile || mediaOpen}
          onClick={() => {
            if (mediaOpen) videoRef.current?.pause();
            setMediaOpen(!mediaOpen);
          }}
        >
          Video and metrics
          <span>
            {mediaOpen ? "Hide" : "Show"}
            <ChevronDown size={14} />
          </span>
        </Button>
        <div className="detail-player" ref={playerRef}>
          {hasVideo ? (
            <video
              aria-label="Reel video"
              controls
              playsInline
              preload="metadata"
              poster={
                reel.evidence?.frames[0]
                  ? asset(reel.id, reel.evidence.frames[0].file)
                  : undefined
              }
              src={videoSrc}
              ref={videoRef}
              onError={() => setPlayerError(true)}
            />
          ) : reel.thumbnail ? (
            <img src={image(reel.thumbnail)} alt="Reel preview" />
          ) : (
            <div className="thumbnail-fallback">
              <Clapperboard size={36} />
              <span>Video not downloaded</span>
            </div>
          )}
        </div>
        {playerError && (
          <Notice danger>
            Could not play this file. Supply a video file below to replace it.
          </Notice>
        )}
        {source && (
          <div className="evidence-focus" role="status">
            <div>
              <strong>
                {source.label}
                {source.seconds !== null ? ` · ${clock(source.seconds)}` : ""}
              </strong>
              <Button
                variant="ghost"
                className="text-link"
                onClick={() => setSource(null)}
              >
                Hide
              </Button>
            </div>
            {source.file && (
              <img
                src={asset(reel.id, source.file)}
                alt={`Supporting frame at ${source.seconds}s`}
              />
            )}
            {source.kind === "transcript" ? (
              <blockquote>{source.text}</blockquote>
            ) : (
              <p>{source.text}</p>
            )}
            <small>
              {source.kind === "transcript"
                ? "Exact ASR output; transcription may contain errors."
                : source.kind === "frame"
                  ? "A sampled frame, not continuous video."
                  : "Recorded evidence used for this report."}
            </small>
          </div>
        )}
        <div className="detail-stats">
          <span>
            <strong>{fmt(reel.views)}</strong>views
          </span>
          <span>
            <strong>{fmt(reel.likes)}</strong>likes
          </span>
          <span>
            <strong>{fmt(reel.comments)}</strong>comments
          </span>
        </div>
        <div className="reel-facts">
          <span>Published {date(reel.postedAt)}</span>
          <span>
            {performance?.ageDays != null
              ? `${Math.floor(performance.ageDays)} days old at collection`
              : "Post age unavailable"}
          </span>
          <span>
            {reel.evidence
              ? `${reel.evidence.duration.toFixed(1)}s`
              : performance?.durationSeconds
                ? `${performance.durationSeconds}s`
                : "Duration unavailable"}
            {a?.format ? ` · ${a.format.replaceAll("-", " ")}` : ""}
          </span>
        </div>
        {performance?.multiple != null && (
          <div className="baseline-note">
            <strong>{performance.multiple.toFixed(1)}×</strong>
            <span>
              {performance.cohort === "similar"
                ? "similar Reels’ median"
                : "account median"}
              <small>
                {performance.sampleSize} peers · {fmt(performance.medianViews)}{" "}
                median views
              </small>
              {performance.standout && (
                <small>Above typical views · 2× threshold</small>
              )}
            </span>
          </div>
        )}
        {performance && (
          <Disclosure
            className="baseline-details"
            title={
              <>
                {performance.quality === "moderate"
                  ? "Comparison context"
                  : "Weak comparison — see why"}
              </>
            }
          >
            <p>{performance.note}</p>
            <p>
              Metrics collected {date(reel.collectedAt)}. This sidebar uses the
              latest collected metrics; report citations retain their original
              snapshot.
            </p>
          </Disclosure>
        )}
        <Disclosure className="caption-details" title={<>Original caption</>}>
          <p>{reel.caption || "No caption supplied."}</p>
        </Disclosure>
        {reel.url && (
          <a
            className="text-link"
            href={reel.url}
            target="_blank"
            rel="noreferrer"
          >
            Open on {platformLabel[platformFor(reel)]}
            <ExternalLink size={13} />
          </a>
        )}
        <Button
          variant="ghost"
          className="text-link"
          disabled={busy}
          onClick={() => setReplace((value) => !value)}
        >
          <Upload size={13} />
          {replace ? "Close upload" : "Supply a video file"}
        </Button>
        {replace && (
          <UploadForm
            reelId={reel.id}
            done={async () => {
              await refreshed();
              setReplace(false);
              setPlayerError(false);
            }}
          />
        )}
      </aside>
      <div className="detail-report">
        {reel.error && <Notice danger><ProviderError message={reel.error} /></Notice>}
        {job && (
          <div className="inline-progress">
            <JobProgress job={job} />
          </div>
        )}
        {!a ? (
          <div className="report-not-ready">
            <h2>
              {job?.kind === "resolve"
                ? "Fetching video details"
                : job?.kind === "analyze"
                  ? "Analysis in progress"
                  : "Analyze this Reel"}
            </h2>
            <p>
              The report will link its findings to frames, transcript segments
              and available metrics, then suggest three shootable concepts.
            </p>
            <Button
              variant="default"
              className="btn primary"
              disabled={busy || Boolean(job)}
              onClick={() => analyze(false)}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Clapperboard size={16} />
              )}
              {job?.kind === "resolve"
                ? "Fetching details…"
                : job?.kind === "analyze"
                  ? "Processing…"
                  : "Analyze this Reel"}
            </Button>
          </div>
        ) : (
          <>
          <UsageReceipt usage={reel.analysisUsage} />
          <Tabs value={tab} onValueChange={setTab} className="report-tabs">
            {a.version !== 2 && (
              <Notice>
                This saved report uses the earlier format. Analyze again to add
                evidence links, critical findings and shot lists.
              </Notice>
            )}
            <div className="report-tools">
              <TabsList
                className="report-tab-list"
                aria-label="Report sections"
              >
                {reportTabs.map((value) => (
                  <TabsTrigger value={value} key={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tab === "evidence" && <div className="source-tabs"><NativeSelect aria-label="Evidence view" value={evidenceTab} onChange={event => setEvidenceTab(event.target.value)}>{["breakdown", "transcript", "frames"].map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase()+value.slice(1)}</option>)}</NativeSelect></div>}
            <TabsContent value={tab} className="report-prose" tabIndex={0}>
              {section === "overview" ? (
                <>
                  <p className="report-summary">
                    {a.editorial?.verdict || a.summary}
                  </p>
                  {proof(a.editorial?.evidenceIds || a.support?.summary)}
                  {a.editorial ? (
                    <ReportSection title="What I would change">
                      <p className="section-note">
                        Editorial suggestions, in priority order.
                      </p>
                      {a.editorial.changes.map((change, i) => (
                        <div className="editorial-change" key={i}>
                          <span className="edit-number">{i + 1}</span>
                          <div>
                            <h4>{change.action}</h4>
                            <p>{change.reason}</p>
                            <blockquote>
                              <span>Try this</span>
                              {change.example}
                            </blockquote>
                            {proof(change.evidenceIds)}
                          </div>
                        </div>
                      ))}
                    </ReportSection>
                  ) : (
                    <div className="report-takeaways">
                      {[
                        a.findings?.find(
                          (f) =>
                            f.kind === "distinctive" || f.kind === "strength",
                        ),
                        a.findings?.find((f) => f.kind === "weakness"),
                      ]
                        .filter((f) => f !== undefined)
                        .map((finding, i) => (
                          <section key={i}>
                            <span className="eyebrow">
                              {i === 0 ? "What works" : "Worth a second look"}
                            </span>
                            <h3>{finding.title}</h3>
                            <p>{finding.detail}</p>
                            {proof(finding.evidenceIds)}
                          </section>
                        ))}
                    </div>
                  )}
                  <Disclosure
                    className="story-disclosure"
                    title={<>Hook, body & ending</>}
                  >
                    <StoryStructure
                      analysis={a}
                      sources={sources}
                      proof={proof}
                      seek={(seconds) => {
                        const match = sources.find(
                          (s) => s.seconds === seconds,
                        );
                        if (match) selectSource(match);
                        else seek(seconds);
                      }}
                    />
                  </Disclosure>

                  {!!a.hypotheses.length && (
                    <ReportSection title="Possible creative mechanisms">
                      {a.hypotheses.map((h, i) => (
                        <div className="hypothesis" key={i}>
                          <div>
                            <h4>{h.driver}</h4>
                            <span className="confidence">
                              {h.confidence} confidence
                            </span>
                          </div>
                          <p>{h.evidence}</p>
                          {proof(h.evidenceIds)}
                        </div>
                      ))}
                    </ReportSection>
                  )}
                  <ReportSection title="Patterns to adapt">
                    <ul>
                      {a.transferablePatterns.map((pattern, i) => (
                        <li key={i}>
                          {pattern}
                          {proof(a.support?.patterns[i])}
                        </li>
                      ))}
                    </ul>
                  </ReportSection>
                </>
              ) : section === "breakdown" ? (
                <>
                  {!!a.findings?.length && (
                    <ReportSection title="What stands out">
                      {a.findings.map((finding, i) => (
                        <div className="finding" key={i}>
                          <Badge variant="secondary" className="tag subtle">
                            {finding.kind}
                          </Badge>
                          <h4>{finding.title}</h4>
                          <p>{finding.detail}</p>
                          {proof(finding.evidenceIds)}
                        </div>
                      ))}
                    </ReportSection>
                  )}
                  <ReportSection title="Story beats">
                    <div className="beats">
                      {a.beats.map((b, i) => (
                        <div className="beat" key={i}>
                          <Button
                            variant="ghost"
                            className="timestamp"
                            onClick={() => seek(b.startSeconds)}
                          >
                            {clock(b.startSeconds)}
                          </Button>
                          <div>
                            <h4>{b.whatHappens}</h4>
                            <p>{b.purpose}</p>
                            {proof(b.evidenceIds)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ReportSection>
                  <ReportSection title="Observed moments">
                    {a.observations.map((o, i) => (
                      <div className="observation" key={i}>
                        <Button
                          variant="ghost"
                          className="timestamp"
                          onClick={() => seek(o.timestampSeconds)}
                        >
                          {clock(o.timestampSeconds)}
                        </Button>
                        <div>
                          <Badge variant="secondary" className="tag subtle">
                            {o.category}
                          </Badge>
                          <p>{o.detail}</p>
                          {proof(o.evidenceIds)}
                        </div>
                      </div>
                    ))}
                  </ReportSection>
                  <ReportSection title="Pacing, payoff and CTA">
                    <h4>Pacing</h4>
                    <p>{a.pacing}</p>
                    {proof(a.support?.pacing)}
                    <h4>Payoff</h4>
                    <p>{a.payoff}</p>
                    {proof(a.support?.payoff)}
                    <h4>Call to action</h4>
                    <p>{a.cta}</p>
                    {proof(a.support?.cta)}
                  </ReportSection>
                </>
              ) : section === "ideas" ? (
                <>
                  <p className="section-note">
                    Concepts to test, inspired by the creative mechanism.
                    Suggested scenes are new production directions.
                  </p>
                  {a.suggestedAngles.map((idea, i) => (
                    <Concept
                      key={i}
                      idea={idea}
                      index={i}
                      citations={proof(idea.evidenceIds)}
                      refine={refineIdea ? () => refineIdea(i) : undefined}
                      save={saveIdea ? () => saveIdea(i) : undefined}
                    />
                  ))}
                </>
              ) : section === "transcript" ? (
                <div className="transcript">
                  <Notice>
                    {reel.evidence?.transcript.note ||
                      "Transcript unavailable."}
                  </Notice>
                  <p className="detail-caveat">
                    {reel.evidence?.transcript.engine} ·{" "}
                    {reel.evidence?.transcript.model} ·{" "}
                    {reel.evidence?.transcript.language ||
                      "No language detected"}
                  </p>
                  {reel.evidence?.transcript.segments.length ? (
                    reel.evidence.transcript.segments.map((segment, i) => (
                      <Button
                        variant="ghost"
                        key={i}
                        onClick={() => {
                          const item = sources.find(
                            (s) => s.id === `T${i + 1}`,
                          );
                          if (item) selectSource(item);
                          else seek(segment.start);
                        }}
                      >
                        <span className="timestamp">
                          {clock(segment.start)}
                        </span>
                        <span>{segment.text}</span>
                      </Button>
                    ))
                  ) : (
                    <p>No transcribed speech is available.</p>
                  )}
                </div>
              ) : (
                <div className="frames">
                  <p className="section-note">
                    Sampled frames. Click to seek to the exact moment.
                  </p>
                  <div className="frame-grid">
                    {reel.evidence?.frames.map((frame, i) => (
                      <Button
                        variant="ghost"
                        key={frame.file}
                        onClick={() => {
                          const item = sources.find(
                            (s) => s.id === `F${i + 1}`,
                          );
                          if (item) selectSource(item);
                          else seek(frame.seconds);
                        }}
                      >
                        <img
                          src={asset(reel.id, frame.file)}
                          alt={`Video at ${frame.seconds.toFixed(1)} seconds`}
                          loading="lazy"
                        />
                        <span>{frame.seconds.toFixed(1)}s</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <Disclosure
                className="limitations"
                title={<>Limits and uncertainty</>}
              >
                <ul>
                  {[...a.limitations, ...(reel.evidence?.warnings || [])].map(
                    (limit, i) => (
                      <li key={i}>{limit}</li>
                    ),
                  )}
                </ul>
              </Disclosure>
              <Disclosure
                className="report-metadata"
                title={<>Report details & exports</>}
              >
                <DownloadLinks id={reel.id} />
                <Button
                  variant="outline"
                  className="btn small"
                  disabled={busy}
                  onClick={() => analyze(true)}
                >
                  <RefreshCw size={14} />
                  Analyze again
                </Button>
              </Disclosure>
            </TabsContent>
          </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

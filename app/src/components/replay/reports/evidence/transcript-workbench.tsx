"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MoreHorizontal, Pencil, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Notice } from "@/components/replay/shared/notice";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { clock } from "@/components/replay/shared/format";
import { downloadText } from "@/components/replay/shared/download-text";
import {
  applicableReview,
  currentTranscript,
  recognitionFlags,
  transcriptChangedSinceReport,
  transcriptEditVersion,
  transcriptSrt,
} from "@/lib/replay/transcript";
import type { Job, Reel } from "@/lib/replay/types";
import styles from "./evidence.module.css";
import { saveTranscriptDraft, useTranscriptDraft } from "./transcript-draft";

import { TranscriptionRetry } from "./transcription-retry";
import { timedWords } from "@/lib/replay/transcript-timing";

const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase();

export function TranscriptWorkbench({
  reel,
  busy,
  refreshed,
  seek,
  videoRef,
  analyze,
  transcriptionJob,
}: {
  reel: Reel;
  busy: boolean;
  refreshed: () => Promise<void>;
  seek: (seconds: number, endSeconds?: number) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  analyze: () => void;
  transcriptionJob?: Job;
}) {
  const transcript = useMemo(() => currentTranscript(reel), [reel]);
  const [retry, setRetry] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const draft = useTranscriptDraft(reel.id);
  const editing = Boolean(draft),
    lines = draft?.lines || [];
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [active, setActive] = useState(-1);
  const editButton = useRef<HTMLButtonElement>(null);
  const reviewed = useMemo(() => applicableReview(reel), [reel]);
  const stale = useMemo(() => transcriptChangedSinceReport(reel), [reel]);
  const editVersion = useMemo(() => transcriptEditVersion(reel), [reel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      setPlayhead(video.currentTime);
      setActive(
        transcript?.segments.findIndex(
          (segment) =>
            segment.start <= video.currentTime &&
            segment.end > video.currentTime,
        ) ?? -1,
      );
    };
    update();
    video.addEventListener("timeupdate", update);
    return () => video.removeEventListener("timeupdate", update);
  }, [videoRef, transcript]);

  if (!transcript) return <p>No transcript is available.</p>;
  const rows = transcript.segments.map((segment, index) => ({
    segment,
    index,
    text: editing ? (lines[index] ?? segment.text) : segment.text,
    flags: recognitionFlags(segment),
  }));
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  const visible = rows.filter(
    (row) =>
      terms.every((term) => normalize(row.text).includes(term)) &&
      (filter === "all" ||
        (filter === "review" && row.flags.length) ||
        (filter === "corrected" && row.segment.reviewed)),
  );
  const changed =
    editing &&
    lines.some(
      (text, index) => text.trim() !== transcript.segments[index]?.text,
    );
  const conflict = draft && draft.expectedRevision !== editVersion;

  function edit(original = false) {
    videoRef.current?.pause();
    saveTranscriptDraft(reel.id, {
      lines: (original ? reel.evidence!.transcript : transcript!).segments.map(
        (segment) => segment.text,
      ),
      expectedRevision: editVersion!,
    });
    setFilter("all");
    setQuery("");
    setError("");
    setNotice("");
  }

  async function save() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "transcript-save",
          reelId: reel.id,
          expectedRevision: draft!.expectedRevision,
          lines,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not save the transcript.");
      await refreshed();
      saveTranscriptDraft(reel.id, null);
      setNotice("Corrections saved.");
      requestAnimationFrame(() => editButton.current?.focus());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save the transcript.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.workbench} aria-label="Transcript review">
      <header className={styles.heading}>
        <div>
          <h3>Transcript</h3>
          <p>
            {transcript.language || "Language unknown"} ·{" "}
            {transcript.model || transcript.engine}
            {reviewed ? " · Corrections saved" : " · Speech recognition"}
          </p>
        </div>
        {!editing && !retry && (
          <div className={styles.actions}>
            <Button
              ref={editButton}
              variant="outline"
              size="sm"
              disabled={busy || !transcript.segments.length}
              onClick={() => edit()}
            >
              <Pencil size={13} />
              Correct wording
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Transcript actions"
                >
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={busy || !reel.evidence?.hasAudio}
                  onSelect={() => {
                    videoRef.current?.pause();
                    setRetry(true);
                  }}
                >
                  Transcribe again…
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!transcript.segments.length}
                  onSelect={() =>
                    downloadText(
                      `${reel.shortcode || "transcript"}.srt`,
                      transcriptSrt(transcript),
                    )
                  }
                >
                  Export subtitles (.srt)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    downloadText(
                      `${reel.shortcode || "transcript"}-transcript.txt`,
                      transcript.segments
                        .map((row) => `${clock(row.start)} ${row.text}`)
                        .join("\n"),
                    )
                  }
                >
                  Export transcript (.txt)
                </DropdownMenuItem>
                {reviewed && (
                  <DropdownMenuItem disabled={busy} onSelect={() => edit(true)}>
                    Restore original wording…
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>
      {retry && (
        <TranscriptionRetry
          reel={reel}
          busy={busy}
          refreshed={refreshed}
          close={() => {
            setRetry(false);
            requestAnimationFrame(() => editButton.current?.focus());
          }}
        />
      )}
      <p className={styles.note}>
        {editing
          ? "Correct the wording or clear words that were never spoken. Timing stays fixed."
          : "Play a timestamp to hear just that line."}
      </p>
      {error && <Notice danger>{error}</Notice>}
      {transcriptionJob?.phase === "failed" && (
        <div>
          <Notice danger>
            Local transcription failed. Your previous wording was kept. Check
            the video file and local Whisper setup, then try again from the
            transcript menu.
          </Notice>
          <Disclosure title={<>Failure details</>}>
            <p className={styles.note}>{transcriptionJob.detail}</p>
          </Disclosure>
        </div>
      )}
      {transcriptionJob?.phase === "cancelled" && (
        <p className={styles.status} role="status">
          Local transcription cancelled. Your previous wording was kept.
        </p>
      )}
      {conflict && (
        <Notice>
          Your saved transcript changed while these edits were open. Export the
          unsaved text, then cancel to load the current version.{" "}
          <Button
            variant="link"
            onClick={() =>
              downloadText("unsaved-transcript.txt", lines.join("\n"))
            }
          >
            Export unsaved text
          </Button>
        </Notice>
      )}
      {notice && (
        <p className={styles.status} role="status">
          {notice}
        </p>
      )}
      {!editing && !retry && stale && (
        <div className={styles.nextStep}>
          <p>The saved report uses an earlier transcript.</p>
          <Button size="sm" disabled={busy} onClick={analyze}>
            {reviewed
              ? "Analyze with corrections"
              : "Analyze current transcript"}
          </Button>
        </div>
      )}
      {!!transcript.segments.length && (
        <div className={styles.filters}>
          <label className={styles.search}>
            <Search size={14} aria-hidden="true" />
            <Input
              aria-label="Search transcript"
              placeholder="Find a word or phrase"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <NativeSelect
            aria-label="Filter transcript lines"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All lines</option>
            <option value="review">Check wording</option>
            <option value="corrected">Corrected lines</option>
          </NativeSelect>
        </div>
      )}
      <div className={styles.lines}>
        {visible.map(({ segment, index, text, flags }) => (
          <div
            className={styles.line}
            data-active={active === index}
            key={index}
          >
            <Button
              variant="ghost"
              className={styles.time}
              aria-label={`Play line ${index + 1} at ${clock(segment.start)}`}
              onClick={() => seek(segment.start, segment.end)}
            >
              {clock(segment.start)}
            </Button>
            <div className={styles.wording}>
              {editing ? (
                <Textarea
                  aria-label={`Transcript line ${index + 1}`}
                  autoFocus={index === 0}
                  rows={2}
                  maxLength={4000}
                  value={text}
                  onFocus={() => videoRef.current?.pause()}
                  onChange={(event) =>
                    saveTranscriptDraft(reel.id, {
                      ...draft!,
                      lines: lines.map((line, i) =>
                        i === index ? event.target.value : line,
                      ),
                    })
                  }
                />
              ) : (
                <p>
                  {timedWords(segment)?.map((word, wordIndex) => (
                    <span
                      key={wordIndex}
                      className={
                        playhead >= word.start && playhead < word.end
                          ? styles.activeWord
                          : undefined
                      }
                    >
                      {word.text}
                    </span>
                  )) ||
                    text || <span className={styles.note}>Cleared by you</span>}
                </p>
              )}
              {!editing &&
                (segment.reviewed ? (
                  <span className={styles.corrected}>Corrected by you</span>
                ) : (
                  flags.length > 0 && (
                    <Badge variant="secondary" title={flags.join(". ")}>
                      Check wording
                    </Badge>
                  )
                ))}
            </div>
          </div>
        ))}
        {!visible.length && (
          <p className={styles.note}>
            {transcript.segments.length
              ? "No lines match this search or filter."
              : "No transcribed speech is available."}
          </p>
        )}
      </div>
      {editing && (
        <footer className={styles.saveBar}>
          <p>{changed ? "Unsaved corrections" : "No wording changes"}</p>
          <div className={styles.actions}>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                saveTranscriptDraft(reel.id, null);
                setError("");
                requestAnimationFrame(() => editButton.current?.focus());
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!changed || pending || busy || Boolean(conflict)}
              onClick={() => void save()}
            >
              {pending ? "Saving…" : "Save corrections"}
            </Button>
          </div>
        </footer>
      )}
      <p className={styles.note}>{transcript.note}</p>
    </section>
  );
}

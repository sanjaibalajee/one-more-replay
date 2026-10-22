"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { scriptLength, scriptLengthLabel } from "@/lib/replay/script";
import type { IdeaDraft } from "@/lib/replay/idea-types";
import styles from "./ideas.module.css";

export function ScriptReader({
  draft,
  close,
}: {
  draft: IdeaDraft;
  close: () => void;
}) {
  const [playing, setPlaying] = useState(false),
    [pace, setPace] = useState(150);
  const viewport = useRef<HTMLDivElement>(null);
  const { words } = scriptLength(draft);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    viewport.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!playing) return;
    const element = viewport.current;
    if (!element) return;
    let frame: number,
      previous: number | undefined,
      position = element.scrollTop;
    const tick = (now: number) => {
      const distance = element.scrollHeight - element.clientHeight;
      const delta = previous === undefined ? 0 : Math.min(now - previous, 100);
      previous = now;
      position +=
        ((delta / 1000) * distance) / Math.max(1, (words / pace) * 60);
      element.scrollTop = position;
      if (element.scrollTop >= distance - 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, pace, words]);
  function restart() {
    setPlaying(false);
    if (viewport.current) viewport.current.scrollTop = 0;
    viewport.current?.focus({ preventScroll: true });
  }
  function togglePlayback() {
    const element = viewport.current;
    if (
      !playing &&
      element &&
      element.scrollTop >= element.scrollHeight - element.clientHeight - 1
    )
      element.scrollTop = 0;
    setPlaying((value) => !value);
  }
  return (
    <section className={styles.reader} aria-label="Read-through">
      <div className={styles.readerHeading}>
        <Button variant="ghost" onClick={close}>
          <ArrowLeft size={14} />
          Back to draft
        </Button>
        <p>{scriptLengthLabel(draft)}</p>
      </div>
      <h1>{draft.title}</h1>
      <div className={styles.readerControls}>
        <Button onClick={togglePlayback}>
          {playing ? <Pause size={15} /> : <Play size={15} />}
          {playing ? "Pause" : "Start scrolling"}
        </Button>
        <NativeSelect
          aria-label="Reading pace"
          value={pace}
          onChange={(event) => {
            setPlaying(false);
            setPace(Number(event.target.value));
          }}
        >
          {[120, 150, 180].map((value) => (
            <option key={value} value={value}>
              {value} words / min
            </option>
          ))}
        </NativeSelect>
        <Button
          variant="ghost"
          onClick={restart}
          aria-label="Restart read-through"
        >
          <RotateCcw size={16} />
        </Button>
      </div>
      <div
        ref={viewport}
        className={styles.readerViewport}
        role="region"
        aria-label="Script to read"
        tabIndex={0}
        onWheel={() => setPlaying(false)}
        onTouchStart={() => setPlaying(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
          if (event.target === event.currentTarget && event.code === "Space") {
            event.preventDefault();
            togglePlayback();
          }
        }}
      >
        {(
          [
            ["Hook", draft.hook],
            ["Body", draft.body],
            ["CTA", draft.cta],
          ] as const
        )
          .filter(([, text]) => text.trim())
          .map(([label, text]) => (
            <section key={label}>
              <h3>{label}</h3>
              <p>{text}</p>
            </section>
          ))}
      </div>
      <p className="field-note">
        Space to pause or resume · Esc to edit. Timing assumes 120–180 words per
        minute; language, pauses and delivery can change it.
      </p>
    </section>
  );
}

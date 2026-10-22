"use client";
import { type Action } from "@/components/replay/shared/action";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { Notice } from "@/components/replay/shared/notice";
import { downloadText } from "@/components/replay/shared/download-text";
import { UsageReceipt } from "@/components/replay/usage/usage-receipt";
import { RunUsage } from "@/components/replay/usage/run-usage";
import { ProviderError } from "@/components/replay/shared/provider-error";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Message,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ideaStages,
  stageLabel,
  type IdeaStage,
} from "@/lib/replay/idea-workflow";
import type { IdeaDraft, IdeaSession } from "@/lib/replay/idea-types";
import {
  scriptLengthLabel,
  scriptMarkdown,
  scriptText,
} from "@/lib/replay/script";
import type { Job, PublicSettings } from "@/lib/replay/types";
import {
  Bookmark,
  Check,
  Copy,
  Download,
  MoreHorizontal,
  Play,
  Send,
  Square,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import styles from "./ideas.module.css";
import { restoreDraftState, type DraftState } from "./draft-state";

const ScriptReader = dynamic(
  () => import("./script-reader").then((module) => module.ScriptReader),
  { ssr: false, loading: () => <p role="status">Opening your script…</p> },
);

const unsentKey = (id: string) => `replay:unsent-idea:${id}`;

function unsent(session: IdeaSession): DraftState {
  try {
    return restoreDraftState(
      session,
      JSON.parse(sessionStorage.getItem(unsentKey(session.id)) || "null"),
    );
  } catch {
    /* Storage can be unavailable; the server draft still opens. */
  }
  return restoreDraftState(session, null);
}

export function IdeaChat({
  session,
  run,
  busy,
  job,
  settings,
  openSource,
}: {
  session: IdeaSession;
  run: Action;
  busy: boolean;
  job?: Job;
  settings: PublicSettings;
  openSource: () => void;
}) {
  const prefix = useId(),
    [initial] = useState(() => unsent(session)),
    [draft, setDraft] = useState<IdeaDraft>(initial.draft),
    [stage, setStage] = useState<IdeaStage>(initial.stage),
    [message, setMessage] = useState(initial.message),
    [copyState, setCopyState] = useState("");
  const [reading, setReading] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(initial.chat);
  const [editorTab, setEditorTab] = useState(initial.tab);
  const readButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        unsentKey(session.id),
        JSON.stringify({
          version: session.updatedAt,
          draft,
          message,
          stage,
          tab: editorTab,
          chat: conversationOpen,
          messageCount: session.messages.length,
        }),
      );
    } catch {
      /* Saving and sending still work if browser storage is full. */
    }
  }, [
    session.id,
    session.updatedAt,
    session.messages.length,
    draft,
    message,
    stage,
    editorTab,
    conversationOpen,
  ]);
  const pending = Boolean(
      job && !["completed", "failed", "cancelled"].includes(job.phase),
    ),
    disabled = pending || busy;
  const saved =
    session.savedDraft &&
    JSON.stringify(session.savedDraft) === JSON.stringify(draft) &&
    (session.stage || "draft") === stage;
  const connection = job && pending ? job.runSettings || settings : settings;
  const providerLabel =
    connection.provider === "codex" ? "Codex subscription" : "OpenAI API";
  const last = session.messages.at(-1);
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!message.trim() || disabled) return;
    await run({
      action: "idea-message",
      id: session.id,
      message: message.trim(),
      draft,
      stage,
      expectedUpdatedAt: session.updatedAt,
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(scriptText(draft));
      setCopyState("Copied");
    } catch {
      setCopyState("Select the script text to copy it.");
    }
  }
  function field(key: keyof IdeaDraft, label: string, rows: number) {
    return (
      <Field>
        <FieldLabel htmlFor={`${prefix}-${key}`}>{label}</FieldLabel>
        {key === "title" ? (
          <Input
            id={`${prefix}-${key}`}
            value={draft[key]}
            maxLength={140}
            disabled={disabled}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        ) : (
          <Textarea
            id={`${prefix}-${key}`}
            rows={rows}
            value={draft[key]}
            disabled={disabled}
            maxLength={key === "body" ? 5000 : key === "notes" ? 2000 : 600}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
          />
        )}
      </Field>
    );
  }
  if (reading)
    return (
      <ScriptReader
        draft={draft}
        close={() => {
          setReading(false);
          requestAnimationFrame(() => readButton.current?.focus());
        }}
      />
    );
  return (
    <Tabs
      value={editorTab}
      onValueChange={(value) => {
        setEditorTab(value);
        if (value === "conversation") setConversationOpen(true);
      }}
      className="idea-editor"
    >
      {conversationOpen && (
        <TabsList className="idea-mobile-tabs" aria-label="Idea editor view">
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="draft">Your draft</TabsTrigger>
        </TabsList>
      )}
      <div
        className={`idea-workbench ${conversationOpen ? "" : styles.workbenchClosed}`}
      >
        <TabsContent forceMount value="conversation" className="idea-chat-pane">
          <section className="idea-conversation" aria-label="Idea conversation">
            <div className="idea-chat-heading">
              <div>
                <h3>Refine this idea</h3>
                <p>
                  {session.sourceKind === "manual"
                    ? session.sourceTitle
                    : `From ${session.sourceTitle}`}
                </p>
              </div>
              {session.sourceKind !== "manual" && (
                <Button variant="outline" size="sm" onClick={openSource}>
                  Source report
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close idea chat"
                onClick={() => {
                  setConversationOpen(false);
                  setEditorTab("draft");
                }}
              >
                <X size={15} />
              </Button>
            </div>
            <MessageScrollerProvider autoScroll>
              <MessageScroller className="idea-messages">
                <MessageScrollerViewport>
                  <MessageScrollerContent>
                    <MessageScrollerItem messageId="welcome">
                      <Message>
                        <MessageContent>
                          <MessageHeader>Idea editor</MessageHeader>
                          <Bubble variant="muted">
                            <BubbleContent>
                              Make the opening sharper, change the audience,
                              shorten the script, or adapt it to your setup. You
                              can also edit and save the draft without chatting.
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                    {session.messages.map((item) => (
                      <MessageScrollerItem
                        key={item.id}
                        messageId={item.id}
                        scrollAnchor={item.role === "user"}
                      >
                        <Message align={item.role === "user" ? "end" : "start"}>
                          <MessageContent>
                            <MessageHeader>
                              {item.role === "user" ? "You" : "Idea editor"}
                            </MessageHeader>
                            <Bubble
                              variant={
                                item.role === "user" ? "secondary" : "muted"
                              }
                            >
                              <BubbleContent>
                                <p className="chat-text">{item.text}</p>
                              </BubbleContent>
                            </Bubble>
                            {item.usage && <UsageReceipt usage={item.usage} />}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}
                    {pending && (
                      <MessageScrollerItem messageId="pending">
                        <p role="status" className="chat-pending">
                          {job?.phase === "queued"
                            ? "Waiting in the queue…"
                            : "Working on your idea…"}
                        </p>
                      </MessageScrollerItem>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
            {pending && job && <RunUsage job={job} />}
            {job?.phase === "failed" && (
              <Notice danger>
                <ProviderError message={job.detail} />
              </Notice>
            )}
            <form onSubmit={send} className="idea-composer">
              <Field>
                <FieldLabel htmlFor={`${prefix}-message`}>
                  What would you like to change?
                </FieldLabel>
                <Textarea
                  id={`${prefix}-message`}
                  placeholder="Make this a 20-second Tamil video I can film alone…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={disabled}
                  maxLength={2000}
                  rows={3}
                />
              </Field>
              <div className="button-row">
                <Button type="submit" disabled={disabled || !message.trim()}>
                  <Send size={14} />
                  Send
                </Button>
                {pending && (
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run({ action: "cancel", jobId: job!.id })
                    }
                  >
                    <Square size={13} />
                    Stop
                  </Button>
                )}
                {!pending && last?.role === "user" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run({
                        action: "idea-message",
                        id: session.id,
                        message: last.text,
                        retryMessageId: last.id,
                      })
                    }
                  >
                    Retry last message
                  </Button>
                )}
              </div>
              <p className="field-note">
                Each send uses {providerLabel}
                {connection.provider === "codex" ? " allowance" : " billing"}.
                Usage appears with the reply. Opening or saving this draft does
                not start AI work.
              </p>
            </form>
          </section>
        </TabsContent>
        <TabsContent forceMount value="draft" className="idea-draft-pane">
          <Card className="idea-draft">
            <CardHeader>
              <div className={styles.draftHeader}>
                <CardTitle>Your draft</CardTitle>
                {!conversationOpen && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConversationOpen(true);
                      setEditorTab("conversation");
                    }}
                  >
                    Ask for a revision
                  </Button>
                )}
              </div>
              <CardDescription>
                Edit your script, then read it aloud before filming.
              </CardDescription>
            </CardHeader>
            <CardContent className="idea-draft-fields">
              {field("title", "Title", 1)}
              <div className={styles.draftMetadata}>
                <p className="field-note" aria-live="polite">
                  {scriptLengthLabel(draft)}
                </p>
                <NativeSelect
                  aria-label="Draft stage"
                  value={stage}
                  disabled={disabled}
                  onChange={(event) =>
                    setStage(event.target.value as IdeaStage)
                  }
                >
                  {ideaStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stageLabel(stage)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {field("hook", "Hook", 3)}
              {field("body", "Body", 6)}
              {field("cta", "CTA", 2)}
              {field("notes", "Production notes", 3)}
              <div className="button-row">
                <Button
                  disabled={
                    disabled ||
                    !draft.title.trim() ||
                    !draft.body.trim() ||
                    Boolean(saved)
                  }
                  onClick={() =>
                    void run({
                      action: "idea-save",
                      id: session.id,
                      draft,
                      stage,
                      expectedUpdatedAt: session.updatedAt,
                    })
                  }
                >
                  {saved ? <Check size={14} /> : <Bookmark size={14} />}{" "}
                  {saved ? "Saved to Inspiration" : "Save to Inspiration"}
                </Button>
                <Button
                  ref={readButton}
                  variant="outline"
                  onClick={() => setReading(true)}
                  disabled={!scriptText(draft).trim()}
                >
                  <Play size={14} />
                  Read script
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" aria-label="Script actions">
                      <MoreHorizontal size={17} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void copy()}>
                      <Copy size={14} />
                      Copy script
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        downloadText(
                          `${draft.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 70) || "video-script"}.md`,
                          scriptMarkdown(draft),
                        )
                      }
                    >
                      <Download size={14} />
                      Download script
                    </DropdownMenuItem>
                    {session.sourceKind !== "manual" && (
                      <DropdownMenuItem onSelect={openSource}>
                        Open source report
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {copyState && (
                <p role="status" className="field-note">
                  {copyState}
                </p>
              )}
              {Object.keys(session.sourcesByReel).length > 0 && (
                <Disclosure
                  className="brief-snapshot"
                  title={<>Original source evidence</>}
                >
                  <p>
                    These are the report’s saved source excerpts. This
                    conversation does not fetch or re-analyze the video.
                  </p>
                  {Object.entries(session.sourcesByReel).map(
                    ([reelId, sources]) => (
                      <div key={reelId}>
                        {sources
                          .filter(
                            (source) =>
                              source.kind === "frame" ||
                              source.kind === "transcript",
                          )
                          .slice(0, 12)
                          .map((source) => (
                            <p key={source.id}>
                              <strong>
                                {source.id}
                                {source.seconds !== null
                                  ? ` · ${source.seconds}s`
                                  : ""}
                              </strong>{" "}
                              {source.text}
                            </p>
                          ))}
                      </div>
                    ),
                  )}
                </Disclosure>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </div>
    </Tabs>
  );
}

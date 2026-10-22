"use client";
import { type Action } from "@/components/replay/shared/action";
import { Disclosure } from "@/components/replay/shared/disclosure";
import { Notice } from "@/components/replay/shared/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  CODEX_MODELS,
  OPENAI_MODELS,
  supportedEfforts,
  type ModelOption,
} from "@/lib/replay/models";
import type { CodexModel } from "@/lib/replay/codex-models";
import type {
  CreativeBrief,
  PublicSettings,
  Readiness,
  ReasoningEffort,
} from "@/lib/replay/types";
import { Check, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";

export const emptyBrief: CreativeBrief = {
  business: "",
  audience: "",
  language: "",
  tone: "",
  constraints: "",
  goal: "",
};

export function Connections({
  settings,
  health,
  save,
  checkHealth,
}: {
  settings: PublicSettings;
  health: Readiness | null;
  save: Action;
  checkHealth: () => Promise<void>;
}) {
  const providerId = useId();
  const [form, setForm] = useState({
    provider: settings.provider,
    codexModel: settings.codexModel,
    openaiModel: settings.openaiModel || OPENAI_MODELS[0].id,
    whisperModel: settings.whisperModel,
    language: settings.language,
    brandContext: settings.brandContext,
    codexEffort: settings.codexEffort || "medium",
    openaiEffort: supportedEfforts(
      settings.openaiModel || OPENAI_MODELS[0].id,
      "openai",
    ).includes(settings.openaiEffort || "medium")
      ? settings.openaiEffort || "medium"
      : "default",
  });
  const [brief, setBrief] = useState<CreativeBrief>({
    ...emptyBrief,
    ...settings.brief,
  });
  const [apifyToken, setApifyToken] = useState(""),
    [openaiKey, setOpenaiKey] = useState(""),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(OPENAI_MODELS),
    [modelNote, setModelNote] = useState(
      "Suggested models. Availability depends on your API account.",
    ),
    [modelsBusy, setModelsBusy] = useState(false);
  const [codexOptions, setCodexOptions] = useState<CodexModel[]>([]);
  const [codexNote, setCodexNote] = useState("Checking the Codex CLI model catalogue…");
  function change(key: string, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }
  async function loadModels() {
    setModelsBusy(true);
    try {
      const response = await fetch(`/api/replay/models?provider=${form.provider}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (form.provider === "codex") { setCodexOptions(result.models); setCodexNote(result.note || ""); }
      else { setModels(result.models); setModelNote(result.note || ""); }
    } catch (error) {
      const note = `${error instanceof Error ? error.message : "Could not load models."} Showing suggested models.`;
      if (form.provider === "codex") setCodexNote(note);
      else { setModelNote(note); setModels(OPENAI_MODELS); }
    } finally {
      setModelsBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/replay/models?provider=${form.provider}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result;
      })
      .then((result) => {
        if (form.provider === "codex") { setCodexOptions(result.models); setCodexNote(result.note || ""); }
        else { setModels(result.models); setModelNote(result.note || ""); }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          const note = `${error.message} Showing suggested models.`;
          if (form.provider === "codex") setCodexNote(note); else setModelNote(note);
        }
      });
    return () => controller.abort();
  }, [settings.hasOpenaiKey, form.provider]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    const result = await save({
      action: "settings",
      ...form,
      brief,
      ...(apifyToken ? { apifyToken } : {}),
      ...(openaiKey ? { openaiKey } : {}),
    });
    if (result) {
      setSaved(true);
      setApifyToken("");
      setOpenaiKey("");
      await checkHealth();
    }
    setBusy(false);
  }
  const provider = form.provider,
    model = provider === "codex" ? form.codexModel : form.openaiModel;
  const effortKey = provider === "codex" ? "codexEffort" : "openaiEffort",
    effort = form[effortKey];
  const codexDefault = codexOptions.find(option => option.isDefault);
  const effortsFor = (id: string) => provider === "codex"
    ? (id ? codexOptions.find(option => option.id === id) : codexDefault)?.efforts || supportedEfforts(id, provider)
    : supportedEfforts(id, provider);
  const efforts = effortsFor(model);
  function chooseModel(value: string) {
    const supported = effortsFor(value);
    setForm((previous) => ({
      ...previous,
      [provider === "codex" ? "codexModel" : "openaiModel"]: value,
      [effortKey]: supported.includes(previous[effortKey] as ReasoningEffort)
        ? previous[effortKey]
        : "default",
    }));
    setSaved(false);
  }
  const options = provider === "codex" ? codexOptions.length ? codexOptions : CODEX_MODELS : models;
  return (
    <div className="connections-page">
      <div className="page-heading">
        <div>
          <h1>Connections</h1>
          <p>Choose your analyst and set the context for useful ideas.</p>
        </div>
      </div>
      <form onSubmit={submit} className="connections-form">
        <Card className="connection-card">
          <div className="connection-heading">
            <div>
              <h2>Account collection</h2>
              <p>Fetch public Reel metadata and video links through Apify.</p>
            </div>
            <Badge variant="secondary" className="tag">
              {settings.hasApifyToken ? "Token saved" : "Not connected"}
            </Badge>
          </div>
          <Label>
            Apify API token
            <Input
              type="password"
              autoComplete="off"
              placeholder={
                settings.hasApifyToken
                  ? "Saved — enter a new token to replace it"
                  : "apify_api_…"
              }
              value={apifyToken}
              onChange={(e) => {
                setApifyToken(e.target.value);
                setSaved(false);
              }}
            />
          </Label>
          <p className="field-note">
            Collection uses separate Apify credits. Importing an existing JSON
            export does not start a scraper.{" "}
            <a
              href="https://console.apify.com/settings/integrations"
              target="_blank"
              rel="noreferrer"
            >
              Get a token <ExternalLink size={12} />
            </a>
          </p>
        </Card>
        <Card className="connection-card">
          <div className="connection-heading">
            <div>
              <h2>Choose your analyst</h2>
              <p>Only the Reels you select are analyzed.</p>
            </div>
          </div>
          <RadioGroup
            className="provider-options"
            aria-label="Analysis connection"
            value={provider}
            onValueChange={(value) =>
              change("provider", value as "codex" | "openai")
            }
          >
            <Label
              htmlFor={`${providerId}-codex`}
              className={provider === "codex" ? "selected" : ""}
            >
              <RadioGroupItem id={`${providerId}-codex`} value="codex" />
              <span>
                <strong>Codex subscription</strong>
                <small>ChatGPT login on this computer</small>
              </span>
            </Label>
            <Label
              htmlFor={`${providerId}-openai`}
              className={provider === "openai" ? "selected" : ""}
            >
              <RadioGroupItem id={`${providerId}-openai`} value="openai" />
              <span>
                <strong>OpenAI API</strong>
                <small>Your API key; separate billing</small>
              </span>
            </Label>
          </RadioGroup>
          {provider === "codex" ? (
            <div className="readiness-row">
              <span>{health?.codex.detail || "Checking Codex login…"}</span>
              <Button
                variant="ghost"
                type="button"
                className="text-link"
                onClick={() => void checkHealth()}
              >
                <RefreshCw size={13} />
                Check
              </Button>
            </div>
          ) : (
            <Label>
              OpenAI API key
              <Input
                type="password"
                autoComplete="off"
                placeholder={
                  settings.hasOpenaiKey
                    ? "Saved — enter a new key to replace it"
                    : "sk-…"
                }
                value={openaiKey}
                onChange={(e) => {
                  setOpenaiKey(e.target.value);
                  setSaved(false);
                }}
              />
            </Label>
          )}
          {provider === "codex" && health && !health.codex.subscription && (
            <Notice>
              Run <code>codex login</code> in your terminal and sign in with
              ChatGPT.
            </Notice>
          )}
          <div className="form-columns">
            <Label>
              {provider === "codex" ? "Codex model" : "OpenAI model"}
              <NativeSelect
                aria-label={
                  provider === "codex" ? "Codex model" : "OpenAI model"
                }
                value={model}
                onChange={(e) => chooseModel(e.target.value)}
              >
                {provider === "codex" && (
                  <option value="">{codexDefault ? `Codex default · ${codexDefault.id}` : "Codex default (resolved before running)"}</option>
                )}
                {model && !options.some((option) => option.id === model) && (
                  <option value={model}>{model} (saved model)</option>
                )}
                {options.map((option) => (
                  <option value={option.id} key={option.id}>
                    {option.label}
                    {option.id !== option.label &&
                    option.id !==
                      OPENAI_MODELS.find((m) => m.label === option.label)?.id
                      ? ` · ${option.id}`
                      : ""}{" "}
                    — {option.description}
                  </option>
                ))}
              </NativeSelect>
            </Label>
            <Label>
              Reasoning effort
              <NativeSelect
                value={effort}
                onChange={(e) => change(effortKey, e.target.value)}
              >
                <option value="default">Model default</option>
                {effort !== "default" && !efforts.includes(effort as ReasoningEffort) && <option value={effort}>{effort} (saved; verify support)</option>}
                {efforts.map((value) => (
                  <option key={value} value={value}>
                    {value === "xhigh"
                      ? "Extra high"
                      : value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </NativeSelect>
            </Label>
          </div>
          <p className="field-note">
            Higher effort can take longer and use more allowance or API tokens.
            Only supported levels are shown.{" "}
            {provider === "codex" && "The resolved model and effort are pinned before each job starts."}
          </p>
          <div className="readiness-row">
            <p className="field-note">{provider === "codex" ? codexNote : modelNote}</p>
            <Button variant="ghost" type="button" className="text-link" disabled={modelsBusy} onClick={() => void loadModels()}>
              <RefreshCw size={13} className={modelsBusy ? "spin" : ""} />Refresh models
            </Button>
          </div>
          {provider === "openai" && (
            <>
              <Disclosure title={<>Use another model ID</>}>
                <Label>
                  Custom model ID
                  <Input
                    value={form.openaiModel}
                    onChange={(e) => chooseModel(e.target.value)}
                  />
                </Label>
                <p className="field-note">
                  Requires image inputs and structured outputs. Unknown models
                  use Model default effort.
                </p>
              </Disclosure>
            </>
          )}
        </Card>
        <Card className="connection-card">
          <div className="connection-heading">
            <div>
              <h2>Transcription</h2>
              <p>Whisper runs locally on this computer.</p>
            </div>
            <Badge variant="secondary" className="tag">
              {!health
                ? "Checking…"
                : health.whisper && health.ffmpeg
                  ? "Ready"
                  : "Check setup"}
            </Badge>
          </div>
          <div className="form-columns">
            <Label>
              Whisper model
              <NativeSelect
                value={form.whisperModel}
                onChange={(e) => change("whisperModel", e.target.value)}
              >
                {["tiny", "base", "small", "medium", "large-v3", "turbo"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </NativeSelect>
            </Label>
            <Label>
              Speech language
              <Input
                placeholder="Auto-detect, or en / hi / ta"
                value={form.language}
                onChange={(e) =>
                  change("language", e.target.value.toLowerCase())
                }
              />
            </Label>
          </div>
          <p className="field-note">
            Base is a useful first choice. Models download on first use. Leave
            language blank to auto-detect.
          </p>
          {health && (!health.whisper || !health.ffmpeg || !health.ffprobe) && (
            <Notice>
              Run <code>npm run setup:media</code> from the repo root. FFmpeg
              must also be installed.
            </Notice>
          )}
        </Card>
        <Card className="connection-card">
          <div className="connection-heading">
            <div>
              <h2>Creative brief</h2>
              <p>
                Used to turn findings into three concepts you can actually
                shoot.
              </p>
            </div>
          </div>
          <div className="form-stack">
            <Label>
              Creator, niche and offer
              <Textarea
                rows={3}
                placeholder="What do you create? What topics, expertise, products or services can you share?"
                value={brief.business}
                onChange={(e) => {
                  setBrief((b) => ({ ...b, business: e.target.value }));
                  setSaved(false);
                }}
              />
            </Label>
            <Label>
              Audience
              <Textarea
                rows={2}
                placeholder="Who is watching? What do they struggle with or want to know?"
                value={brief.audience}
                onChange={(e) => {
                  setBrief((b) => ({ ...b, audience: e.target.value }));
                  setSaved(false);
                }}
              />
            </Label>
            <div className="form-columns">
              <Label>
                Content language
                <Input
                  placeholder="e.g. Tamil with conversational English"
                  value={brief.language}
                  onChange={(e) => {
                    setBrief((b) => ({ ...b, language: e.target.value }));
                    setSaved(false);
                  }}
                />
              </Label>
              <Label>
                Tone
                <Input
                  placeholder="e.g. direct, warm, dry humor"
                  value={brief.tone}
                  onChange={(e) => {
                    setBrief((b) => ({ ...b, tone: e.target.value }));
                    setSaved(false);
                  }}
                />
              </Label>
            </div>
            <Label>
              Production constraints
              <Textarea
                rows={2}
                placeholder="People, equipment, location, time and budget. e.g. one person, phone, home setup, 30 minutes."
                value={brief.constraints}
                onChange={(e) => {
                  setBrief((b) => ({ ...b, constraints: e.target.value }));
                  setSaved(false);
                }}
              />
            </Label>
            <Label>
              Goal
              <Input
                placeholder="e.g. audience growth, watch time, community replies, enquiries"
                value={brief.goal}
                onChange={(e) => {
                  setBrief((b) => ({ ...b, goal: e.target.value }));
                  setSaved(false);
                }}
              />
            </Label>
            <Label>
              Additional context
              <Textarea
                rows={2}
                placeholder="Existing brand notes, topics to avoid, or relevant details"
                value={form.brandContext}
                onChange={(e) => change("brandContext", e.target.value)}
              />
            </Label>
          </div>
          <p className="field-note">
            Applies to future analyses and comparisons. Existing reports are
            preserved.
          </p>
        </Card>
        <div className="settings-footer">
          <span role="status">
            {saved
              ? "Connections saved."
              : "Changes are saved on this computer."}
          </span>
          <Button variant="default" className="btn primary" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            {saved ? "Saved" : "Save connections"}
          </Button>
        </div>
      </form>
    </div>
  );
}

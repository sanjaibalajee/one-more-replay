# One More Replay

Local video-research app built with Next.js 16, React 19, shadcn Radix Luma and SQLite. Collect public Reel metadata, select videos explicitly, and generate evidence-linked reports, comparisons and editable ideas.

## Run

Requires Node.js 22+, uv, FFmpeg/ffprobe and the Codex CLI.

```bash
npm run setup
npm run setup:media
codex login
npm run dev
```

Open http://127.0.0.1:3210. Configure connections and the creative brief in the app. Codex uses the local ChatGPT login; optional OpenAI Responses API mode uses a separate API key and billing. Instagram account collection uses Apify, while JSON imports and local uploads work without it.

## Features

- Instagram catalogues and individual Instagram, TikTok or YouTube links; explicit selection for AI work.
- FFmpeg frame sampling, local Whisper transcription, timestamped evidence and Markdown/JSON exports.
- Searchable transcript review, wording corrections and SRT export; reports preserve their original evidence until explicit reanalysis.
- Account-relative baselines, saved collections, descriptive analytics and creative-gap comparisons.
- Own idea capture, draft stages, speaking-length estimates, read-through and script exports. Optional idea chat and explicit saving to Inspiration.
- Provider-reported tokens and LiteLLM USD estimates by model. Codex model/effort are resolved through the official CLI and pinned per job. API equivalents are reference estimates, not subscription charges; missing usage stays unavailable.
- Serial jobs, cancellation, retries, upload conflict protection and saved request configuration.

Frames are sparse samples, not continuous video analysis. Public counts cannot establish retention, paid reach or causation.

## Structure

```text
app/src/app/                 pages and local API routes
app/src/components/replay/   feature UI, shell, workspace and state hooks
app/src/components/ui/       shadcn Luma primitives
app/src/lib/replay/          SQLite, queue, media and model integrations
app/src/styles/              theme, registry utilities and app styles
app/tests/                   contract and browser tests
scripts/                     controller and media setup
```

See the [UI structure guide](app/src/components/replay/README.md). Runtime data, credentials and media stay in ignored `.local/`. Run one server per data directory. `REPLAY_DATA_DIR` isolates test data; other overrides are in `.env.example`.

## Development

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:media
cd app
PLAYWRIGHT_BROWSERS_PATH=../.local/browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=../.local/browsers npm run test:e2e
```

Browser tests use isolated data and port 3211. Model responses are mocked. With the app running, `npm run replay -- help` lists controller commands.

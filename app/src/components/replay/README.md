# Replay UI

`components/ui/` contains the official shadcn Radix Luma primitives. This directory contains the app's feature components and compositions. Import specific modules directly; avoid a barrel that pulls every screen into the initial client bundle.

| Folder | Responsibility |
| --- | --- |
| `workspace/` | Coordinates focused pages and explicit actions. `use-workspace-data.ts` owns coalesced refreshes, health checks and abortable activity polling; unchanged activity retains catalogue identity. |
| `shell/` | Navigation, account switching and appearance control. |
| `library/` | Catalogue presentation, filters, selection, pagination, link/import/upload forms. `use-library-state.ts` owns its view state and derived results. |
| `reports/` | Individual/comparison reports, source links, story structure and proposed scripts. `report-overview` prioritizes the creative decision. `evidence/` owns input checks, lazy transcript review, session drafts, local recognition retry and subtitle exports. |
| `research/` | Adaptation, own/peer gap selection, saved research and per-video annotations. |
| `collections/`, `inspiration/`, `analytics/` | Collection management, saved inspiration and descriptive catalogue analytics. |
| `ideas/` | Own idea capture, saved drafts and stages, optional chat and script read-through. Reader loads on demand; feature styles live in `ideas.module.css`. |
| `connections/`, `usage/`, `jobs/` | Connection settings, token/cost receipts and job progress. |
| `shared/` | App-specific compositions such as WorkspacePage, Notice, Disclosure, identity and export links; pure formatting/media URL helpers stay separate. |

## Design and behavior

- Use existing tokens in `src/styles/theme.css`: system typography, neutral surfaces, restrained borders/shadows, compact spacing and a blue focus indicator. Luma primitives should inherit this language.
- `src/app/globals.css` is the CSS entrypoint. `styles/shadcn.css` contains the versioned official utilities; `styles/replay.css` contains component compositions and `styles/workspace.css` contains focused-page layouts.
- Check the shadcn registry before adding controls. Compose existing primitives instead of recreating their keyboard and selection behavior. Disclosure uses Collapsible with an explicit button trigger; mounted closed content preserves unsent form state and is hidden from navigation.
- Treat captions, transcripts and source text as text. Keep model/media work, credentials and persistence in server modules under `lib/replay`.
- Opening a report, editing a draft and saving inspiration do not start model work. Preserve exact selections and show billing/allowance implications on explicit model actions.
- Verify mobile width, keyboard operation, light/dark appearance, playback/source seeking and the saved-idea workflow after shared component changes.

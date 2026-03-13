# HighlightSmith

HighlightSmith is a local-first highlight scouting system for long-form stream recordings. It analyzes measurable signals, surfaces likely moments worth reviewing, suggests clip boundaries, and keeps final editorial control with the human creator.

This repository is the monorepo foundation for the project. It is structured to feel like a real product codebase now, while staying honest about what is still placeholder logic.

## Monorepo Layout

- `apps/desktopapp`
  - primary Tauri + React desktop shell
  - local project/session creation
  - placeholder review workflow screens
- `apps/webapp`
  - complementary browser surface
  - project browsing, candidate history, profile inspection
- `services/analyzer`
  - Python analysis core scaffold
  - CLI and lightweight HTTP entrypoints
- `services/api`
  - TypeScript API/bridge service for the apps
- `packages/shared-types`
  - shared DTOs, enums, schemas, and mock data
- `packages/domain`
  - reusable business helpers and review workflow helpers
- `packages/ui`
  - shared UI primitives used by webapp and desktopapp
- `packages/storage`
  - SQLite contracts and migration placeholders
- `packages/media`
  - media utilities and future FFmpeg wrappers
- `packages/scoring`
  - reason code vocabulary and confidence helpers
- `packages/profiles`
  - profile presets and signal-weight placeholders
- `packages/export`
  - JSON/timestamp export helpers and EDL placeholder
- `packages/ai-assist`
  - optional AI-assist placeholder helpers only
- `scripts`
  - root-first bash wrappers for bootstrap, dev, verify, and doctor flows

## Bootstrap

```bash
pnpm bootstrap
```

That runs environment checks and installs workspace dependencies.

## Run Surfaces And Services

```bash
pnpm dev:desktop
pnpm dev:web
pnpm dev:analyzer
pnpm dev:api
pnpm dev:both
```

`dev:both` starts analyzer + API + webapp together as the easiest multi-surface development loop from the repo root.
The API bridge currently runs directly from TypeScript with `tsx`.

## Verify The Repo

```bash
pnpm verify:web
pnpm verify:desktop
pnpm verify:analyzer
pnpm verify:api
pnpm verify:all
pnpm test
pnpm health
pnpm run doctor
```

Use `pnpm health` as the primary repo health check. `pnpm doctor` is a built-in pnpm command and does not run the HighlightSmith script.

## Local Tool Versions

- Node is pinned in `.nvmrc`
- Python is pinned in `.python-version`

## What Is Real Versus Stubbed

Real now:

- coherent pnpm workspace wiring
- desktopapp and webapp placeholder surfaces
- shared contracts, profiles, scoring helpers, and UI primitives
- analyzer CLI, analyzer HTTP server, and SQLite persistence scaffold
- API bridge with placeholder routes and analyzer health bridge
- root-first scripts for bootstrapping, running, and verification

Still stubbed on purpose:

- FFmpeg execution and media probing
- real acoustic feature extraction
- real offline STT provider integration
- analyzer job orchestration beyond mock/demo flows
- packaged production build output for the API bridge
- persistent desktopapp SQLite adapter
- any AI-dependent logic in the core engine

## Documentation

- `docs/repo-map.md`
- `docs/architecture.md`
- `docs/analyzer-pipeline.md`
- `docs/scoring-model.md`
- `docs/profiles.md`
- `docs/desktopapp.md`
- `docs/webapp.md`
- `docs/api.md`
- `docs/storage.md`
- `docs/verification.md`
- `docs/archive/2026-03-13/`

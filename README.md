# HighlightSmith

HighlightSmith is a local-first highlight scouting tool for long-form recordings. It analyzes offline inputs, surfaces likely moments worth reviewing, suggests clip boundaries, and keeps final editorial judgment with the creator.

This repository is the V0 foundation scaffold. It is intentionally modular, explicit about stubs, and organized so optional AI-assisted layers can be added later without becoming required for core signal detection.

## Current Scaffold

- `apps/desktop`
  - Tauri 2 + React + TypeScript review shell
  - mock candidate flow with local review-state persistence
  - placeholder file picker bridge for local desktop mode
- `services/analyzer`
  - Python pipeline skeleton with ingest, segmentation, transcript, speaker activity, acoustic features, scoring, and boundary shaping stages
  - SQLite persistence for project sessions and review decisions
  - mock analysis CLI for immediate end-to-end testing
- `packages/shared`
  - shared domain models and schemas for sessions, candidates, segments, reason codes, profiles, and settings
- `packages/media`
  - FFmpeg/ffprobe command builders and supported-input definitions
- `packages/storage`
  - SQLite schema plan and serialization helpers
- `packages/scoring`
  - reason-code labels and score summary helpers
- `packages/profiles`
  - broad mode and future contextual profile definitions
- `packages/export`
  - JSON and timestamp export helpers

## What Is Stubbed

- real FFmpeg ingest execution
- real offline speech-to-text provider
- actual acoustic feature extraction from media
- desktop-to-analyzer runtime bridge
- persistent SQLite access from the Tauri shell

Those seams are marked with TODOs where implementation belongs.

## Prerequisites

- Node 22+
- `corepack enable`
- Rust toolchain for `tauri dev` / `tauri build`
- FFmpeg for future ingest work

## Commands

```bash
pnpm install
pnpm dev:web
pnpm dev:desktop
pnpm typecheck
pnpm analyzer:mock
pnpm analyzer:test
```

`pnpm dev:web` runs the review UI in a browser preview. `pnpm dev:desktop` is the real desktop path once Rust/Tauri prerequisites are installed.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/V0_FOUNDATION.md`
- `docs/archive/2026-03-13/`

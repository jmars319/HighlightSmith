# Architecture

## Product Shape

HighlightSmith is a signal-driven highlight scouting system. It is not an autonomous editor.

Core flow:

1. ingest local recording
2. preprocess and analyze measurable signals
3. surface candidate windows
4. shape suggested clip segments
5. present candidates for human review
6. store review outcomes locally

## Runtime Surfaces

- `desktopapp` is the primary V1 surface
- `webapp` is a companion surface
- `analyzer` is the analysis core
- `api` is the app-facing bridge

## Guiding Constraints

- local-first
- offline core
- human editorial control
- explainable confidence bands and reason codes
- AI optional, never required for the core engine

# HighlightSmith Architecture

## Product Thesis

HighlightSmith is a creator-owned highlight scouting system. It finds likely moments worth reviewing quickly, suggests clip boundaries, and preserves full human editorial control.

It is not an automated editor and does not claim semantic understanding of gameplay or stream content.

## Foundation Principles

- Local-first
- Offline core
- Explainable scoring
- Modular pipeline
- Human review required
- AI optional later, never mandatory for core detection

## Repository Layout

```text
apps/desktop         Desktop shell and review UI
services/analyzer    Python analysis pipeline entrypoint
packages/shared      Shared schemas and domain models
packages/storage     SQLite schema plan and serialization helpers
packages/media       FFmpeg/ffprobe command builders
packages/scoring     Score summary helpers and reason-code mapping
packages/profiles    Broad and contextual profile definitions
packages/export      JSON and timestamp export helpers
docs                 Architecture and workflow documentation
```

## Pipeline Layers

### 1. Ingest Layer

Responsibilities:
- accept local media files
- validate supported formats
- gather metadata
- extract normalized audio
- establish timeline references

Current status:
- supported file validation and FFmpeg command builders are scaffolded
- actual ffprobe / ffmpeg execution is still TODO

### 2. Segmentation Layer

Responsibilities:
- create small micro windows for signal analysis
- support future adaptive region merging

Current status:
- micro-window generation is implemented in Python
- adaptive region merging remains TODO

### 3. Transcript Layer

Responsibilities:
- produce timestamped transcript chunks
- keep provider boundary abstract

Current status:
- stub provider returns deterministic local transcript data
- real offline STT provider is still TODO

### 4. Speaker Activity Layer

Responsibilities:
- detect speech presence
- estimate overlap activity
- compute speech density

Current status:
- heuristic speech regions are derived from transcript timing
- true VAD / overlap modeling is still TODO

### 5. Acoustic Feature Layer

Responsibilities:
- compute measurable per-window audio signals
- preserve explainability

Current status:
- deterministic feature synthesis exists for scaffold runs
- real feature extraction from waveforms is still TODO

### 6. Event Scoring Layer

Responsibilities:
- combine multiple weak signals into candidate likelihood
- preserve reason-code breakdown

Current status:
- lightweight heuristic scoring produces explainable candidates
- profile-aware weighting and negative suppression are only partially stubbed

### 7. Boundary Shaping Layer

Responsibilities:
- turn candidate windows into usable clip suggestions
- extend for setup and resolution
- trim obvious dead air

Current status:
- padding-based shaping exists
- smarter dead-air trimming is still TODO

### 8. Review UI Layer

Responsibilities:
- list candidates
- show confidence bands and reason codes
- expose accept / reject / retime / relabel actions
- persist creator decisions locally

Current status:
- desktop UI shell is implemented with mock data and local review persistence
- analyzer bridge and playback preview are still TODO

## Storage Model

The scaffold includes a SQLite schema plan for:

- `project_sessions`
- `candidate_windows`
- `review_decisions`
- `analysis_artifacts`

The Python analyzer can already persist mock sessions to SQLite. The desktop app currently persists temporary review actions in local storage until the desktop SQLite bridge is wired in.

## Integration Direction

Short-term integration path:

1. add ffprobe/ffmpeg execution in the analyzer or Rust shell
2. add real offline transcription provider
3. expose analyzer invocation to Tauri via command or sidecar process
4. replace mock session loading with analyzer result ingestion
5. move desktop review persistence from local storage to SQLite

## Non-Goals In This Foundation

- live monitoring
- Twitch / YouTube ingestion
- automatic clip rendering
- publishing
- cloud sync
- objective “best moment” claims
- AI-dependent core detection

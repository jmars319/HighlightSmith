# V0 Foundation Notes

## What This Scaffold Is For

This repository gives HighlightSmith a real starting point without pretending the hard parts are already solved.

It provides:

- a modern workspace layout
- a desktop review shell
- shared schemas
- a Python analyzer entrypoint
- local SQLite persistence
- mock candidate data flowing end-to-end

## Immediate Next Build Steps

1. Replace mock ingest metadata with real `ffprobe` output.
2. Add normalized audio extraction and cached project artifacts.
3. Swap the transcript stub for a real offline STT provider interface implementation.
4. Replace deterministic feature synthesis with waveform-driven acoustic features.
5. Wire the analyzer to the Tauri shell.
6. Add local media preview / jump-to-time playback in the review UI.
7. Store desktop review decisions in SQLite instead of local storage.

## Design Constraints Locked In

- offline core analysis
- single-user local workflow
- local file input only in V0
- confidence bands, not public numeric ranking
- explainable reason codes
- candidate window and suggested segment both modeled separately
- broad mode remains available even after personalization exists

## Notes On Existing Archive

The markdown files moved into `docs/archive/2026-03-13/` were early ideation artifacts from an older cloud-oriented direction. They are preserved for reference but should not override the current brief.

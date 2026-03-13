# HighlightSmith Analyzer

Offline-first Python analysis scaffold for HighlightSmith.

## Current Status

- Real:
  - pipeline orchestration entrypoint
  - explicit domain models
  - mock transcript, speech, feature, scoring, and boundary flow
  - SQLite persistence for project sessions and review decisions
- Stubbed:
  - FFmpeg metadata probing
  - actual audio feature extraction
  - actual STT provider implementation
  - desktop-to-analyzer bridge beyond placeholder HTTP routes

## Run Mock Analysis

```bash
PYTHONPATH=services/analyzer/src python3 -m highlightsmith_analyzer.cli --mock
```

## Run Analyzer Service

```bash
PYTHONPATH=services/analyzer/src python3 -m highlightsmith_analyzer.server
```

This starts a lightweight local HTTP server with:

- `GET /health`
- `GET /session/mock`
- `POST /analyze/mock`

## Persist Mock Analysis To SQLite

```bash
mkdir -p .local
PYTHONPATH=services/analyzer/src python3 -m highlightsmith_analyzer.cli --mock --persist --database .local/highlightsmith.sqlite3
```

## Run Tests

```bash
PYTHONPATH=services/analyzer/src python3 -m unittest discover -s services/analyzer/tests -p 'test_*.py'
```

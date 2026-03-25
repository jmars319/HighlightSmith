# HighlightSmith Analyzer

Offline-first Python analysis scaffold for HighlightSmith.

## Current Status

- Real:
  - pipeline orchestration entrypoint
  - explicit domain models
  - mock transcript, speech, feature, scoring, and boundary flow
  - SQLite persistence for project sessions and review decisions
  - local-file analyze route that returns a real persisted `ProjectSession`
- Stubbed:
  - actual audio feature extraction
  - actual STT provider implementation
  - richer signal extraction and learned scoring beyond deterministic seeded heuristics

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
- `GET /session/<sessionId>`
- `POST /analyze`
- `POST /analyze/mock`
- `POST /review`

`POST /analyze` accepts a JSON body with:

- `sourcePath`
- optional `profileId`
- optional `sessionTitle`
- optional `persist`
- optional `databasePath`

It analyzes a real local file path, persists the resulting session by default, and
returns the session payload in the shared camelCase contract shape expected by the
API bridge.

`GET /session/<sessionId>` loads one persisted session from SQLite and reapplies
the current review decisions before returning it.

`POST /review` accepts:

- `sessionId`
- `candidateId`
- `action`
- optional `label`
- optional `adjustedSegment`
- optional `notes`
- optional `timestamp`

It upserts one local review decision for the candidate and returns the updated
session payload as the current source of truth.

## Persist Mock Analysis To SQLite

```bash
mkdir -p .local
PYTHONPATH=services/analyzer/src python3 -m highlightsmith_analyzer.cli --mock --persist --database .local/highlightsmith.sqlite3
```

## Run Tests

```bash
PYTHONPATH=services/analyzer/src python3 -m unittest discover -s services/analyzer/tests -p 'test_*.py'
```

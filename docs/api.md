# API

## Role

The API service is the stable bridge between UI apps and backend logic.

## Placeholder Endpoints

- `GET /health`
- `GET /api/projects`
- `GET /api/candidates/current`
- `GET /api/profiles`
- `GET /api/bridge/analyzer`

## Current Direction

The API returns mock/shared data now, but the route boundaries are set up to become the stable app-facing contract later.

At this scaffold stage, the service runs directly from TypeScript with `tsx`. The current `build` step is a compile verification step, not a packaged production artifact flow.

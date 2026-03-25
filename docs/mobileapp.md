# Mobileapp

## Role

`mobileapp` is a companion surface only.

It is appropriate for:

- project browsing
- candidate queue visibility
- accepted clip/status checks
- profile visibility

It is not appropriate for:

- local media ingest
- analyzer execution
- heavy clip editing
- becoming the primary review workstation

## Current State

- Expo + React Native scaffold under `apps/mobileapp`
- local mock companion data derived from shared workspace packages
- no fake sync layer and no mobile-specific analysis path

## Why It Exists Now

The repo already has a clear primary/secondary split between desktop and web. A thin mobile boundary is useful now because it clarifies what a legitimate mobile role would be without pretending that the core product problems are solved.

## Next Real Integration

When the API stops serving mock-only project data, mobile should load project summaries, candidate history, and accepted clips from that stable bridge. Review actions should remain limited until local persistence and a real sync story exist.

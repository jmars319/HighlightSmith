# vaexcore pulse Tester Guide

This guide is for local unsigned tester builds.

## What You Receive

- `vaexcore pulse.app`
- `vaexcore-pulse-<version>-mac-<arch>-unsigned.zip`
- `.zip.sha256`
- JSON manifest
- tester handoff markdown

The build is unsigned and not notarized.

## First Launch

1. Unzip the unsigned artifact.
2. Move `vaexcore pulse.app` to `/Applications`.
3. Launch from Finder.
4. If macOS blocks the app, Control-click `vaexcore pulse.app`, choose Open, then confirm Open.

## Update Flow

Quit vaexcore pulse before updating.

Replace only:

`/Applications/vaexcore pulse.app`

Keep app data in place:

`~/Library/Application Support/vaexcore pulse`

Do not remove Application Support during normal updates.

## Diagnostics And Support Bundle

Run this from the repo:

```bash
pnpm diagnostics
```

The diagnostics bundle shows the active config path safely:

`~/Library/Application Support/vaexcore pulse`

Diagnostics must never expose tokens, secrets, OAuth codes, refresh tokens, local config contents, or credential material.

## Integrity Check

From the folder containing the release artifacts:

```bash
shasum -a 256 -c vaexcore-pulse-<version>-mac-<arch>-unsigned.zip.sha256
```

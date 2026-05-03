#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Desktop Dev"
require_cmd pnpm
require_cmd cargo
info "Starting desktopapp"
note "The Tauri window should open and the web UI will be served at http://127.0.0.1:1421"
print_command pnpm --filter @vaexcore/pulse-desktopapp tauri:dev
run_from_root pnpm --filter @vaexcore/pulse-desktopapp tauri:dev

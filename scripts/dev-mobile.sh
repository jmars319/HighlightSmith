#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Mobile Dev"
require_cmd pnpm
info "Starting mobile companion app"
note "Expo will print the local dev URL and QR code"
print_command pnpm --filter @highlightsmith/mobileapp dev
run_from_root pnpm --filter @highlightsmith/mobileapp dev

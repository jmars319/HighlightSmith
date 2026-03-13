#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "API Dev"
require_cmd pnpm
info "Starting API bridge"
note "Expected URL: http://127.0.0.1:4010"
print_command pnpm --filter @highlightsmith/api dev
run_from_root pnpm --filter @highlightsmith/api dev

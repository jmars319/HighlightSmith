#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Desktop Verification"
require_cmd pnpm
require_cmd cargo
run_step "Running desktopapp verification" pnpm --filter @highlightsmith/desktopapp verify
success "Desktopapp verification passed"

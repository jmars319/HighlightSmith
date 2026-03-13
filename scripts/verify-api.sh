#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "API Verification"
require_cmd pnpm
run_step "Running API bridge compile step" pnpm --filter @highlightsmith/api build
success "API bridge verification passed"

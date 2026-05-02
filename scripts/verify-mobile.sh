#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Mobile Verification"
require_cmd pnpm
run_step "Running mobileapp typecheck" pnpm --filter @vaexcore/pulse-mobileapp typecheck
success "Mobileapp verification passed"

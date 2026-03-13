#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Full Verification"
run_step "Running workspace test suite" pnpm test
run_step "Verifying webapp" bash ./scripts/verify-web.sh
run_step "Verifying desktopapp" bash ./scripts/verify-desktop.sh
run_step "Verifying analyzer" bash ./scripts/verify-analyzer.sh
run_step "Verifying API bridge" bash ./scripts/verify-api.sh

success "All verification scripts completed"

#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Web Verification"
require_cmd pnpm
run_step "Running webapp build verification" pnpm --filter @vaexcore/pulse-webapp build
success "Webapp verification passed"

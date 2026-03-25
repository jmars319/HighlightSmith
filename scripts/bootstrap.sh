#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Bootstrap"
note "Repo root: ${REPO_ROOT}"

run_step "Checking environment" bash ./scripts/check-env.sh
run_step "Installing workspace dependencies" pnpm install

success "Bootstrap complete"
note "Next steps:"
note "  pnpm dev:web"
note "  pnpm dev:desktop"
note "  pnpm dev:mobile"
note "  pnpm dev:analyzer"
note "  pnpm dev:api"

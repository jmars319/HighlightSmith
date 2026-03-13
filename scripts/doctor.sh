#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "HighlightSmith Doctor"
note "Repo root: ${REPO_ROOT}"

run_step "Running environment check" bash ./scripts/check-env.sh
run_step "Running workspace layout check" bash ./scripts/check-packages.sh
run_step "Running full verification suite" bash ./scripts/verify-all.sh

success "Doctor run completed successfully"

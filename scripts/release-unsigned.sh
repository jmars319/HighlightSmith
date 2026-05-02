#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-common.sh"

section "Unsigned Release"
run_from_root bash ./scripts/app-build.sh
run_from_root bash ./scripts/app-zip.sh
run_from_root bash ./scripts/release-check.sh

success "Unsigned release is ready"
note "App: $(vcp_app_path)"
note "Zip: ${REPO_ROOT}/release/$(vcp_artifact_slug).zip"

#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Web Dev"
require_cmd pnpm
info "Starting webapp"
note "Expected URL: http://127.0.0.1:1430"
print_command pnpm --filter @vaexcore/pulse-webapp dev
run_from_root pnpm --filter @vaexcore/pulse-webapp dev

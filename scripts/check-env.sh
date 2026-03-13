#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Environment Check"
note "Validating required and optional tooling"

require_cmd node
show_cmd_version node --version
require_cmd pnpm
show_cmd_version pnpm --version
require_cmd python3
show_cmd_version python3 --version
require_cmd cargo
show_cmd_version cargo --version

optional_cmd ffmpeg
show_cmd_version ffmpeg -version

success "Environment looks usable for the HighlightSmith scaffold"

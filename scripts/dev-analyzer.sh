#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Analyzer Dev"
require_cmd python3
info "Starting analyzer service"
note "Expected URL: http://127.0.0.1:9010"
print_command env PYTHONPATH=services/analyzer/src python3 -m highlightsmith_analyzer.server
run_from_root env PYTHONPATH=services/analyzer/src python3 -m highlightsmith_analyzer.server

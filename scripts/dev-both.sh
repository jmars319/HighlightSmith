#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Multi-Service Dev"
info "Starting analyzer, API, and webapp together"
note "Analyzer: http://127.0.0.1:9010"
note "API:      http://127.0.0.1:4010"
note "Webapp:   http://127.0.0.1:1430"
(
  cd "${REPO_ROOT}"
  bash ./scripts/dev-analyzer.sh &
  analyzer_pid=$!
  success "Analyzer process started with PID ${analyzer_pid}"
  bash ./scripts/dev-api.sh &
  api_pid=$!
  success "API process started with PID ${api_pid}"
  bash ./scripts/dev-web.sh &
  web_pid=$!
  success "Webapp process started with PID ${web_pid}"

  cleanup() {
    warn "Stopping child processes"
    kill "${analyzer_pid}" "${api_pid}" "${web_pid}" >/dev/null 2>&1 || true
  }

  trap cleanup EXIT INT TERM
  set +e
  wait -n "${analyzer_pid}" "${api_pid}" "${web_pid}"
  exit_code=$?
  set -e

  if [[ ${exit_code} -ne 0 ]]; then
    fail "One of the dev processes exited unexpectedly with code ${exit_code}"
  fi

  warn "One of the dev processes exited; shutting down the rest"
)

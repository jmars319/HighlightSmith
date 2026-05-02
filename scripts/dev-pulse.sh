#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "vaexcore pulse Desktop Stack"
require_cmd pnpm
require_cmd python3
require_cmd cargo
require_cmd curl

analyzer_health_url="${VAEXCORE_PULSE_ANALYZER_HEALTH_URL:-http://127.0.0.1:9010/health}"
api_health_url="${VAEXCORE_PULSE_API_HEALTH_URL:-http://127.0.0.1:4010/health}"
startup_timeout_seconds="${VAEXCORE_PULSE_DEV_BOOT_TIMEOUT_SECONDS:-30}"

analyzer_pid=""
api_pid=""

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "${api_pid}" || -n "${analyzer_pid}" ]]; then
    warn "Stopping vaexcore pulse background services"
    if [[ -n "${api_pid}" ]]; then
      kill "${api_pid}" >/dev/null 2>&1 || true
      wait "${api_pid}" >/dev/null 2>&1 || true
    fi
    if [[ -n "${analyzer_pid}" ]]; then
      kill "${analyzer_pid}" >/dev/null 2>&1 || true
      wait "${analyzer_pid}" >/dev/null 2>&1 || true
    fi
  fi

  exit "${exit_code}"
}

trap cleanup EXIT INT TERM

info "Starting analyzer, API bridge, and desktop app"
note "Analyzer:  http://127.0.0.1:9010"
note "API:       http://127.0.0.1:4010"
note "Desktop:   http://127.0.0.1:1420"

( cd "${REPO_ROOT}" && exec bash ./scripts/dev-analyzer.sh ) &
analyzer_pid=$!
success "Analyzer process started with PID ${analyzer_pid}"
wait_for_http "Analyzer" "${analyzer_health_url}" "${startup_timeout_seconds}"

( cd "${REPO_ROOT}" && exec bash ./scripts/dev-api.sh ) &
api_pid=$!
success "API process started with PID ${api_pid}"
wait_for_http "API bridge" "${api_health_url}" "${startup_timeout_seconds}"

info "Starting desktop app"
print_command bash ./scripts/dev-desktop.sh
run_from_root bash ./scripts/dev-desktop.sh

#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "HighlightSmith Launcher"
require_cmd curl

analyzer_health_url="${HIGHLIGHTSMITH_ANALYZER_HEALTH_URL:-http://127.0.0.1:9010/health}"
api_health_url="${HIGHLIGHTSMITH_API_HEALTH_URL:-http://127.0.0.1:4010/health}"
desktop_dev_url="${HIGHLIGHTSMITH_DESKTOP_DEV_URL:-http://127.0.0.1:1420}"

if curl --silent --fail --max-time 2 "${analyzer_health_url}" >/dev/null 2>&1 &&
  curl --silent --fail --max-time 2 "${api_health_url}" >/dev/null 2>&1 &&
  curl --silent --fail --max-time 2 "${desktop_dev_url}" >/dev/null 2>&1; then
  success "HighlightSmith already appears to be running"
  note "Analyzer: ${analyzer_health_url}"
  note "API:      ${api_health_url}"
  note "Desktop:  ${desktop_dev_url}"
  info "Check the existing HighlightSmith window or the running Terminal session."
  exit 0
fi

exec bash "${REPO_ROOT}/scripts/dev-hs.sh"

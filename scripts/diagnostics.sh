#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-common.sh"

section "Diagnostics"
require_cmd date
require_cmd mkdir
require_cmd uname

timestamp="$(date '+%Y%m%d-%H%M%S')"
bundle_dir="${REPO_ROOT}/release/diagnostics/vaexcore-pulse-diagnostics-${timestamp}"
diagnostics_file="${bundle_dir}/diagnostics.txt"

mkdir -p "${bundle_dir}"

{
  printf "Product: %s\n" "${VCP_APP_NAME}"
  printf "Package: %s\n" "${VCP_PACKAGE_NAME}"
  printf "App ID: %s\n" "${VCP_APP_ID}"
  printf "Version: %s\n" "$(vcp_version)"
  printf "Architecture: %s\n" "$(vcp_arch)"
  printf "Generated: %s\n" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf "Repo root: %s\n" "${REPO_ROOT}"
  printf "Active app data path: %s\n" "${VCP_SUPPORT_DIR}"
  printf "Legacy database fallback: %s\n" "${REPO_ROOT}/.local/vaexcore-pulse.sqlite3"
  printf "Legacy thumbnail fallback: %s\n" "${REPO_ROOT}/.local/thumbnail-suggestions"
  printf "System: %s\n" "$(uname -a)"
  printf "\nNo config contents, tokens, secrets, OAuth codes, or refresh tokens are included.\n"
} >"${diagnostics_file}"

success "Diagnostics bundle created"
note "Bundle: ${bundle_dir}"

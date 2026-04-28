#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -t 1 ]]; then
  if command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || printf '0')" -ge 8 ]]; then
    COLOR_RESET="$(tput sgr0)"
    COLOR_BOLD="$(tput bold)"
    COLOR_DIM="$(tput dim)"
    COLOR_BLUE="$(tput setaf 4)"
    COLOR_CYAN="$(tput setaf 6)"
    COLOR_GREEN="$(tput setaf 2)"
    COLOR_YELLOW="$(tput setaf 3)"
    COLOR_RED="$(tput setaf 1)"
  else
    COLOR_RESET=$'\033[0m'
    COLOR_BOLD=$'\033[1m'
    COLOR_DIM=$'\033[2m'
    COLOR_BLUE=$'\033[34m'
    COLOR_CYAN=$'\033[36m'
    COLOR_GREEN=$'\033[32m'
    COLOR_YELLOW=$'\033[33m'
    COLOR_RED=$'\033[31m'
  fi
else
  COLOR_RESET=""
  COLOR_BOLD=""
  COLOR_DIM=""
  COLOR_BLUE=""
  COLOR_CYAN=""
  COLOR_GREEN=""
  COLOR_YELLOW=""
  COLOR_RED=""
fi

print_status() {
  local label="$1"
  local color="$2"
  local message="$3"

  printf "%b[%s]%b %s\n" "${color}${COLOR_BOLD}" "${label}" "${COLOR_RESET}" "${message}"
}

section() {
  printf "\n%b== %s ==%b\n" "${COLOR_CYAN}${COLOR_BOLD}" "$1" "${COLOR_RESET}"
}

info() {
  print_status "info" "${COLOR_BLUE}" "$1"
}

success() {
  print_status " ok " "${COLOR_GREEN}" "$1"
}

warn() {
  print_status "warn" "${COLOR_YELLOW}" "$1"
}

note() {
  printf "%b->%b %s\n" "${COLOR_DIM}" "${COLOR_RESET}" "$1"
}

fail() {
  print_status "fail" "${COLOR_RED}" "$1" >&2
  exit 1
}

format_command() {
  local formatted=""
  local arg=""
  local quoted=""

  for arg in "$@"; do
    printf -v quoted '%q' "${arg}"
    formatted+="${formatted:+ }${quoted}"
  done

  printf "%s" "${formatted}"
}

print_command() {
  note "Command: $(format_command "$@")"
}

show_cmd_version() {
  local cmd="$1"
  shift

  if ! command -v "${cmd}" >/dev/null 2>&1; then
    return 0
  fi

  local version_line=""
  version_line="$("${cmd}" "$@" 2>&1 | head -n 1 || true)"

  if [[ -n "${version_line}" ]]; then
    note "${cmd} version: ${version_line}"
  fi
}

require_cmd() {
  local resolved_path=""

  resolved_path="$(command -v "$1" 2>/dev/null || true)"
  [[ -n "${resolved_path}" ]] || fail "Missing required command: $1"
  success "Found command: $1 (${resolved_path})"
}

optional_cmd() {
  local resolved_path=""

  resolved_path="$(command -v "$1" 2>/dev/null || true)"
  if [[ -z "${resolved_path}" ]]; then
    warn "Optional command not found: $1"
  else
  success "Found optional command: $1 (${resolved_path})"
  fi
}

require_path() {
  local path="$1"

  [[ -e "${REPO_ROOT}/${path}" ]] || fail "Expected path is missing: ${path}"
  success "Found path: ${path}"
}

run_from_root() {
  (
    cd "${REPO_ROOT}"
    "$@"
  )
}

run_step() {
  local description="$1"
  local exit_code=0
  shift

  info "${description}"
  print_command "$@"

  if run_from_root "$@"; then
    success "${description}"
    return 0
  else
    exit_code=$?
  fi

  fail "${description} failed with exit code ${exit_code}"
}

wait_for_http() {
  local service_name="$1"
  local url="$2"
  local timeout_seconds="${3:-30}"
  local sleep_seconds="${4:-1}"
  local elapsed_seconds=0

  info "Waiting for ${service_name}"
  note "Health URL: ${url}"

  while (( elapsed_seconds < timeout_seconds )); do
    if curl --silent --fail --max-time 2 "${url}" >/dev/null 2>&1; then
      success "${service_name} is ready"
      return 0
    fi

    sleep "${sleep_seconds}"
    elapsed_seconds=$(( elapsed_seconds + sleep_seconds ))
  done

  fail "${service_name} did not become ready within ${timeout_seconds}s"
}

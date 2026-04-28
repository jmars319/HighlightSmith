#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "HighlightSmith Launcher"
require_cmd curl
require_cmd mkdir
require_cmd nohup
require_cmd pnpm
require_cmd python3
require_cmd cargo
require_cmd pgrep
require_cmd open
require_cmd find

cd "${REPO_ROOT}"

analyzer_health_url="${HIGHLIGHTSMITH_ANALYZER_HEALTH_URL:-http://127.0.0.1:9010/health}"
api_health_url="${HIGHLIGHTSMITH_API_HEALTH_URL:-http://127.0.0.1:4010/health}"
launcher_state_dir="${REPO_ROOT}/.local/launcher"
analyzer_pid_file="${launcher_state_dir}/analyzer.pid"
api_pid_file="${launcher_state_dir}/api.pid"
desktop_pid_file="${launcher_state_dir}/desktop.pid"
analyzer_log_path="${launcher_state_dir}/analyzer.log"
api_log_path="${launcher_state_dir}/api.log"
desktop_log_path="${launcher_state_dir}/desktop.log"
legacy_stack_pid_file="${launcher_state_dir}/desktop-stack.pid"
legacy_stack_log_path="${launcher_state_dir}/desktop-stack.log"
desktop_app_path="${REPO_ROOT}/apps/desktopapp/src-tauri/target/debug/bundle/macos/HighlightSmith.app"
desktop_app_marker_path="${desktop_app_path}/Contents/MacOS/highlightsmith-desktop"
desktop_process_match="${desktop_app_path}/Contents/MacOS/highlightsmith-desktop"

mkdir -p "${launcher_state_dir}"

show_launch_error() {
  local summary="$1"
  local detail="$2"

  [[ -t 1 ]] && return 0
  command -v osascript >/dev/null 2>&1 || return 0

  osascript >/dev/null 2>&1 <<EOF || true
display alert "${summary}" message "${detail}" as critical buttons {"OK"} default button "OK"
EOF
}

cleanup_stale_pid_file() {
  local pid_file="$1"
  local existing_pid=""

  [[ -f "${pid_file}" ]] || return 0
  existing_pid="$(cat "${pid_file}" 2>/dev/null || true)"

  if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" >/dev/null 2>&1; then
    return 0
  fi

  rm -f "${pid_file}"
}

start_background_process() {
  local label="$1"
  local log_path="$2"
  local pid_file="$3"
  shift 3

  info "Starting ${label} in the background"
  note "Log: ${log_path}"
  nohup "$@" >>"${log_path}" 2>&1 </dev/null &
  local pid=$!
  echo "${pid}" >"${pid_file}"

  sleep 1
  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    warn "${label} exited during startup"
    if [[ -f "${log_path}" ]]; then
      tail -n 40 "${log_path}" >&2 || true
    fi
    show_launch_error \
      "HighlightSmith could not start" \
      "${label} exited during startup. Check ${log_path} for details."
    rm -f "${pid_file}"
    exit 1
  fi

  success "${label} is running in the background"
  note "PID: ${pid}"
}

append_log_header() {
  local log_path="$1"
  local label="$2"

  {
    printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "${label}"
  } >>"${log_path}"
}

run_logged_step() {
  local description="$1"
  local log_path="$2"
  shift 2
  local exit_code=0

  append_log_header "${log_path}" "${description}"
  printf "Command: %s\n" "$(format_command "$@")" >>"${log_path}"

  info "${description}"
  note "Log: ${log_path}"
  print_command "$@"

  if (
    cd "${REPO_ROOT}"
    "$@"
  ) >>"${log_path}" 2>&1; then
    success "${description}"
    return 0
  else
    exit_code=$?
  fi

  warn "${description} failed"
  if [[ -f "${log_path}" ]]; then
    tail -n 40 "${log_path}" >&2 || true
  fi
  show_launch_error \
    "HighlightSmith could not start" \
    "${description} failed. Check ${log_path} for details."
  exit "${exit_code}"
}

sync_desktop_pid_from_running_app() {
  local running_pid=""

  running_pid="$(pgrep -f "${desktop_process_match}" | head -n 1 || true)"
  [[ -n "${running_pid}" ]] || return 1

  echo "${running_pid}" >"${desktop_pid_file}"
  success "HighlightSmith desktop app is already running"
  note "PID: ${running_pid}"
  [[ -e "${desktop_app_path}" ]] && open "${desktop_app_path}" >/dev/null 2>&1 || true
  return 0
}

launch_desktop_app_bundle() {
  local running_pid=""
  local attempt=""

  append_log_header "${desktop_log_path}" "Open desktop app bundle"
  printf "Command: %s\n" "$(format_command open "${desktop_app_path}")" >>"${desktop_log_path}"

  info "Opening desktop app bundle"
  note "Bundle: ${desktop_app_path}"

  if ! open "${desktop_app_path}" >>"${desktop_log_path}" 2>&1; then
    warn "Opening the desktop app bundle failed"
    tail -n 40 "${desktop_log_path}" >&2 || true
    show_launch_error \
      "HighlightSmith could not start" \
      "Opening the desktop app bundle failed. Check ${desktop_log_path} for details."
    exit 1
  fi

  for attempt in {1..30}; do
    running_pid="$(pgrep -f "${desktop_process_match}" | head -n 1 || true)"
    if [[ -n "${running_pid}" ]]; then
      echo "${running_pid}" >"${desktop_pid_file}"
      success "desktop app is running in the background"
      note "PID: ${running_pid}"
      return 0
    fi

    sleep 1
  done

  warn "The desktop app bundle did not stay running after launch"
  tail -n 40 "${desktop_log_path}" >&2 || true
  show_launch_error \
    "HighlightSmith could not start" \
    "The desktop app did not stay running after launch. Check ${desktop_log_path} for details."
  exit 1
}

desktop_bundle_is_fresh() {
  local dependency_path=""

  [[ -f "${desktop_app_marker_path}" ]] || return 1

  local desktop_dependency_paths=(
    "apps/desktopapp/src"
    "apps/desktopapp/package.json"
    "apps/desktopapp/tsconfig.json"
    "apps/desktopapp/src-tauri/src"
    "apps/desktopapp/src-tauri/Cargo.toml"
    "apps/desktopapp/src-tauri/Cargo.lock"
    "apps/desktopapp/src-tauri/tauri.conf.json"
    "packages/domain/src"
    "packages/export/src"
    "packages/media/src"
    "packages/profiles/src"
    "packages/scoring/src"
    "packages/shared-types/src"
    "packages/storage/src"
    "packages/ui/src"
  )

  for dependency_path in "${desktop_dependency_paths[@]}"; do
    [[ -e "${dependency_path}" ]] || continue
    if find "${dependency_path}" -type f -newer "${desktop_app_marker_path}" -print -quit | grep -q .; then
      return 1
    fi
  done

  return 0
}

cleanup_stale_pid_file "${analyzer_pid_file}"
cleanup_stale_pid_file "${api_pid_file}"
cleanup_stale_pid_file "${desktop_pid_file}"
cleanup_stale_pid_file "${legacy_stack_pid_file}"
rm -f "${legacy_stack_log_path}"

if curl --silent --fail --max-time 2 "${analyzer_health_url}" >/dev/null 2>&1 &&
  curl --silent --fail --max-time 2 "${api_health_url}" >/dev/null 2>&1 &&
  [[ -f "${desktop_pid_file}" ]] &&
  kill -0 "$(cat "${desktop_pid_file}")" >/dev/null 2>&1; then
  success "HighlightSmith already appears to be running"
  note "Analyzer: ${analyzer_health_url}"
  note "API:      ${api_health_url}"
  note "Desktop PID: $(cat "${desktop_pid_file}")"
  [[ -e "${desktop_app_path}" ]] && open "${desktop_app_path}" >/dev/null 2>&1 || true
  info "Check the existing HighlightSmith window."
  exit 0
fi

if curl --silent --fail --max-time 2 "${analyzer_health_url}" >/dev/null 2>&1; then
  success "Analyzer is already running"
  note "Health URL: ${analyzer_health_url}"
else
  start_background_process \
    "analyzer" \
    "${analyzer_log_path}" \
    "${analyzer_pid_file}" \
    env PYTHONPATH=services/analyzer/src python3 -m highlightsmith_analyzer.server
  wait_for_http "Analyzer" "${analyzer_health_url}" 30
fi

if curl --silent --fail --max-time 2 "${api_health_url}" >/dev/null 2>&1; then
  success "API bridge is already running"
  note "Health URL: ${api_health_url}"
else
  start_background_process \
    "API bridge" \
    "${api_log_path}" \
    "${api_pid_file}" \
    pnpm --filter @highlightsmith/api dev
  wait_for_http "API bridge" "${api_health_url}" 30
fi

if [[ -f "${desktop_pid_file}" ]] && kill -0 "$(cat "${desktop_pid_file}")" >/dev/null 2>&1; then
  success "HighlightSmith desktop app is already running"
  note "PID: $(cat "${desktop_pid_file}")"
elif sync_desktop_pid_from_running_app; then
  info "Bringing the existing HighlightSmith app back under launcher tracking."
else
  if desktop_bundle_is_fresh; then
    success "Packaged desktop app is already fresh"
    note "Bundle: ${desktop_app_path}"
  else
    run_logged_step \
      "Build packaged desktop app" \
      "${desktop_log_path}" \
      pnpm --filter @highlightsmith/desktopapp exec tauri build --debug --bundles app
  fi
  launch_desktop_app_bundle
fi

success "HighlightSmith is ready without keeping Terminal open"
note "Analyzer log: ${analyzer_log_path}"
note "API log:      ${api_log_path}"
note "Desktop log:  ${desktop_log_path}"

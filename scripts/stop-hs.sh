#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Stop HighlightSmith"

launcher_state_dir="${REPO_ROOT}/.local/launcher"
analyzer_pid_file="${launcher_state_dir}/analyzer.pid"
api_pid_file="${launcher_state_dir}/api.pid"
desktop_pid_file="${launcher_state_dir}/desktop.pid"
desktop_app_path="${REPO_ROOT}/apps/desktopapp/src-tauri/target/debug/bundle/macos/HighlightSmith.app"
desktop_process_match="${desktop_app_path}/Contents/MacOS/highlightsmith-desktop"

stop_pid() {
  local label="$1"
  local pid="$2"

  info "Stopping ${label}"
  note "PID: ${pid}"
  kill "${pid}" >/dev/null 2>&1 || true

  for _ in {1..20}; do
    if ! kill -0 "${pid}" >/dev/null 2>&1; then
      success "${label} stopped"
      return 0
    fi

    sleep 1
  done

  warn "${label} did not stop cleanly after 20 seconds"
  note "You can force-stop PID ${pid} if needed."
  return 1
}

stop_tracked_process() {
  local label="$1"
  local pid_file="$2"
  local pid=""

  if [[ ! -f "${pid_file}" ]]; then
    note "No tracked ${label} PID file"
    return 0
  fi

  pid="$(cat "${pid_file}" 2>/dev/null || true)"
  if [[ -z "${pid}" ]]; then
    warn "Tracked ${label} PID file was empty"
    rm -f "${pid_file}"
    return 0
  fi

  if ! kill -0 "${pid}" >/dev/null 2>&1; then
    warn "Tracked ${label} PID is no longer running"
    rm -f "${pid_file}"
    return 0
  fi

  if stop_pid "${label}" "${pid}"; then
    rm -f "${pid_file}"
    return 0
  fi

  return 1
}

stop_running_desktop_app_fallback() {
  local pid=""

  pid="$(pgrep -f "${desktop_process_match}" | head -n 1 || true)"
  if [[ -z "${pid}" ]]; then
    return 0
  fi

  info "Stopping desktop app fallback"
  if stop_pid "desktop app" "${pid}"; then
    rm -f "${desktop_pid_file}"
    return 0
  fi

  return 1
}

stop_tracked_process "desktop app" "${desktop_pid_file}"
stop_running_desktop_app_fallback
stop_tracked_process "API bridge" "${api_pid_file}"
stop_tracked_process "analyzer" "${analyzer_pid_file}"

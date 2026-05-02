#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

VCP_APP_NAME="vaexcore pulse"
VCP_PACKAGE_NAME="vaexcore-pulse"
VCP_APP_ID="com.vaexil.vaexcore.pulse"
VCP_SUPPORT_DIR="${HOME}/Library/Application Support/${VCP_APP_NAME}"

vcp_version() {
  run_from_root node -p "require('./package.json').version"
}

vcp_arch() {
  local machine_arch=""
  machine_arch="$(uname -m)"

  case "${machine_arch}" in
    arm64 | aarch64)
      printf "arm64"
      ;;
    x86_64 | amd64)
      printf "x64"
      ;;
    *)
      printf "%s" "${machine_arch}"
      ;;
  esac
}

vcp_release_dir() {
  printf "%s/release/mac-%s" "${REPO_ROOT}" "$(vcp_arch)"
}

vcp_release_storage_dir() {
  printf "%s/release/mac-%s.noindex" "${REPO_ROOT}" "$(vcp_arch)"
}

vcp_app_path() {
  printf "%s/%s.app" "$(vcp_release_dir)" "${VCP_APP_NAME}"
}

vcp_artifact_slug() {
  printf "%s-%s-mac-%s-unsigned" "${VCP_PACKAGE_NAME}" "$(vcp_version)" "$(vcp_arch)"
}

vcp_disable_spotlight_indexing() {
  local directory="$1"

  mkdir -p "${directory}"
  : >"${directory}/.metadata_never_index"
}

vcp_set_plist_string() {
  local plist_path="$1"
  local key="$2"
  local value="$3"

  if /usr/libexec/PlistBuddy -c "Print :${key}" "${plist_path}" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Set :${key} ${value}" "${plist_path}"
  else
    /usr/libexec/PlistBuddy -c "Add :${key} string ${value}" "${plist_path}"
  fi
}

vcp_normalize_app_bundle() {
  local app_path="$1"
  local version="$2"
  local plist_path="${app_path}/Contents/Info.plist"
  local macos_dir="${app_path}/Contents/MacOS"
  local old_executable=""
  local old_executable_path=""
  local new_executable_path="${macos_dir}/${VCP_APP_NAME}"

  [[ -d "${app_path}" ]] || fail "Expected app bundle is missing: ${app_path}"
  [[ -f "${plist_path}" ]] || fail "Expected Info.plist is missing: ${plist_path}"

  old_executable="$(
    /usr/libexec/PlistBuddy -c "Print :CFBundleExecutable" "${plist_path}" 2>/dev/null || true
  )"
  old_executable_path="${macos_dir}/${old_executable}"

  if [[ "${old_executable}" != "${VCP_APP_NAME}" ]]; then
    if [[ -f "${new_executable_path}" ]]; then
      chmod +x "${new_executable_path}"
    elif [[ -n "${old_executable}" && -f "${old_executable_path}" ]]; then
      mv "${old_executable_path}" "${new_executable_path}"
      chmod +x "${new_executable_path}"
    else
      fail "Could not find bundle executable to normalize under ${macos_dir}"
    fi
  fi

  vcp_set_plist_string "${plist_path}" "CFBundleName" "${VCP_APP_NAME}"
  vcp_set_plist_string "${plist_path}" "CFBundleDisplayName" "${VCP_APP_NAME}"
  vcp_set_plist_string "${plist_path}" "CFBundleExecutable" "${VCP_APP_NAME}"
  vcp_set_plist_string "${plist_path}" "CFBundleIdentifier" "${VCP_APP_ID}"
  vcp_set_plist_string "${plist_path}" "CFBundleShortVersionString" "${version}"
  vcp_set_plist_string "${plist_path}" "CFBundleVersion" "${version}"

  plutil -lint "${plist_path}" >/dev/null
}

vcp_assert_release_app_metadata() {
  local app_path="$1"
  local version="$2"
  local plist_path="${app_path}/Contents/Info.plist"
  local actual=""

  [[ -d "${app_path}" ]] || fail "Expected app bundle is missing: ${app_path}"

  actual="$(/usr/libexec/PlistBuddy -c "Print :CFBundleName" "${plist_path}")"
  [[ "${actual}" == "${VCP_APP_NAME}" ]] || fail "CFBundleName was ${actual}"

  actual="$(/usr/libexec/PlistBuddy -c "Print :CFBundleDisplayName" "${plist_path}")"
  [[ "${actual}" == "${VCP_APP_NAME}" ]] || fail "CFBundleDisplayName was ${actual}"

  actual="$(/usr/libexec/PlistBuddy -c "Print :CFBundleExecutable" "${plist_path}")"
  [[ "${actual}" == "${VCP_APP_NAME}" ]] || fail "CFBundleExecutable was ${actual}"

  actual="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${plist_path}")"
  [[ "${actual}" == "${VCP_APP_ID}" ]] || fail "CFBundleIdentifier was ${actual}"

  actual="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "${plist_path}")"
  [[ "${actual}" == "${version}" ]] || fail "CFBundleShortVersionString was ${actual}"

  [[ -x "${app_path}/Contents/MacOS/${VCP_APP_NAME}" ]] ||
    fail "Bundle executable is missing or not executable"
}

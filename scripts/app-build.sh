#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-common.sh"

section "Build macOS App"
require_cmd cargo
require_cmd ditto
require_cmd node
require_cmd plutil
require_cmd pnpm
require_cmd ln
require_path "assets/icon.icns"
require_path "apps/desktopapp/src-tauri/icons/icon.icns"
require_path "apps/desktopapp/src-tauri/app-icon.png"

version="$(vcp_version)"
release_dir="$(vcp_release_dir)"
release_storage_dir="$(vcp_release_storage_dir)"
destination_app="$(vcp_app_path)"
tauri_app="${REPO_ROOT}/apps/desktopapp/src-tauri/target/release/bundle/macos/${VCP_APP_NAME}.app"
target_dir="${REPO_ROOT}/apps/desktopapp/src-tauri/target"

vcp_disable_spotlight_indexing "${target_dir}"
vcp_disable_spotlight_indexing "${REPO_ROOT}/release"

info "Building unsigned Tauri app bundle"
print_command pnpm --filter @vaexcore/pulse-desktopapp exec tauri build --bundles app
run_from_root pnpm --filter @vaexcore/pulse-desktopapp exec tauri build --bundles app

[[ -d "${tauri_app}" ]] || fail "Tauri did not produce expected app bundle: ${tauri_app}"

rm -rf "${release_dir}" "${release_storage_dir}"
mkdir -p "${release_storage_dir}"
vcp_disable_spotlight_indexing "${release_storage_dir}"
ln -s "$(basename "${release_storage_dir}")" "${release_dir}"
ditto "${tauri_app}" "${destination_app}"
rm -rf "${tauri_app}"
vcp_normalize_app_bundle "${destination_app}" "${version}"
vcp_assert_release_app_metadata "${destination_app}" "${version}"

success "Built ${destination_app}"
note "Artifact slug: $(vcp_artifact_slug)"

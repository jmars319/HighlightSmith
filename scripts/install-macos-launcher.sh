#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Install macOS Launcher"
require_cmd mkdir
require_cmd chmod
require_cmd cp
require_path "apps/desktopapp/src-tauri/icons/icon.icns"
require_path "scripts/launch-hs.sh"

launcher_name="${HIGHLIGHTSMITH_LAUNCHER_NAME:-HighlightSmith}"
launcher_bundle_id="${HIGHLIGHTSMITH_LAUNCHER_BUNDLE_ID:-com.highlightsmith.launcher}"
launcher_install_dir="${HOME}/Applications"
launcher_app_name="${launcher_name}.app"
launcher_app_path="${launcher_install_dir}/${launcher_app_name}"
legacy_launcher_app_path="${launcher_install_dir}/HighlightSmith Launcher.app"
icon_source_path="${REPO_ROOT}/apps/desktopapp/src-tauri/icons/icon.icns"
launcher_script_path="${REPO_ROOT}/scripts/launch-hs.sh"
launch_services_register="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/highlightsmith-launcher.XXXXXX")"
tmp_app_path="${tmp_dir}/${launcher_app_name}"
macos_dir="${tmp_app_path}/Contents/MacOS"
resources_dir="${tmp_app_path}/Contents/Resources"
launcher_exec_path="${macos_dir}/HighlightSmithLauncher"
launcher_script_path_quoted=""

cleanup() {
  rm -rf "${tmp_dir}"
}

trap cleanup EXIT

mkdir -p "${launcher_install_dir}"
mkdir -p "${macos_dir}" "${resources_dir}"
printf -v launcher_script_path_quoted '%q' "${launcher_script_path}"

cat >"${launcher_exec_path}" <<EOF
#!/usr/bin/env bash
set -euo pipefail

exec bash ${launcher_script_path_quoted}
EOF
chmod +x "${launcher_exec_path}"

cat >"${tmp_app_path}/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>${launcher_name}</string>
  <key>CFBundleExecutable</key>
  <string>HighlightSmithLauncher</string>
  <key>CFBundleIconFile</key>
  <string>HighlightSmithLauncher</string>
  <key>CFBundleIdentifier</key>
  <string>${launcher_bundle_id}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${launcher_name}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
</dict>
</plist>
EOF

printf 'APPL????' >"${tmp_app_path}/Contents/PkgInfo"
cp "${icon_source_path}" "${resources_dir}/HighlightSmithLauncher.icns"

if [[ -e "${launcher_app_path}" ]]; then
  info "Replacing existing launcher"
  rm -rf "${launcher_app_path}"
fi

if [[ "${legacy_launcher_app_path}" != "${launcher_app_path}" ]] && [[ -e "${legacy_launcher_app_path}" ]]; then
  info "Removing legacy launcher name"
  rm -rf "${legacy_launcher_app_path}"
fi

mv "${tmp_app_path}" "${launcher_app_path}"
touch "${launcher_app_path}"

if [[ -x "${launch_services_register}" ]]; then
  "${launch_services_register}" -f "${launcher_app_path}" >/dev/null 2>&1 || true
fi

if command -v mdimport >/dev/null 2>&1; then
  mdimport "${launcher_app_path}" >/dev/null 2>&1 || true
fi

success "Installed ${launcher_app_name}"
note "Location: ${launcher_app_path}"
info "Search for “HighlightSmith” in Spotlight or open it from ~/Applications."

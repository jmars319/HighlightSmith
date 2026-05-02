#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-common.sh"

section "Unsigned Release Check"
require_cmd grep
require_cmd node
require_cmd shasum
require_cmd ditto
require_cmd unzip

version="$(vcp_version)"
slug="$(vcp_artifact_slug)"
app_path="$(vcp_app_path)"
zip_path="${REPO_ROOT}/release/${slug}.zip"
sha_path="${zip_path}.sha256"
manifest_path="${REPO_ROOT}/release/${slug}.json"
handoff_path="${REPO_ROOT}/release/${slug}-TESTER_HANDOFF.md"
smoke_root="${REPO_ROOT}/release/smoke.noindex"
smoke_apps="${smoke_root}/Applications"
smoke_support="${smoke_root}/Application Support/${VCP_APP_NAME}"
trap 'rm -rf "${smoke_root}"' EXIT

run_step "Running typecheck" pnpm typecheck
run_step "Running full build and test verification" pnpm verify:all
run_step "Checking git whitespace" git diff --check
run_step "Checking release script syntax" bash -n \
  ./scripts/app-build.sh \
  ./scripts/app-zip.sh \
  ./scripts/diagnostics.sh \
  ./scripts/release-check.sh \
  ./scripts/release-unsigned.sh

vcp_assert_release_app_metadata "${app_path}" "${version}"

[[ -f "${zip_path}" ]] || fail "Missing zip artifact: ${zip_path}"
[[ -f "${sha_path}" ]] || fail "Missing SHA artifact: ${sha_path}"
[[ -f "${manifest_path}" ]] || fail "Missing manifest: ${manifest_path}"
[[ -f "${handoff_path}" ]] || fail "Missing tester handoff: ${handoff_path}"

info "Running tester artifact smoke"
(
  cd "${REPO_ROOT}/release"
  shasum -a 256 -c "$(basename "${sha_path}")"
  unzip -t "$(basename "${zip_path}")" >/dev/null
)

info "Running release metadata check"
node - "${manifest_path}" "${slug}" "${version}" "$(vcp_arch)" <<'NODE'
const [manifestPath, expectedSlug, expectedVersion, expectedArch] =
  process.argv.slice(2);
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const expected = {
  productName: "vaexcore pulse",
  packageName: "vaexcore-pulse",
  appId: "com.vaexil.vaexcore.pulse",
  version: expectedVersion,
  platform: "mac",
  arch: expectedArch,
  signed: false,
  notarized: false,
  artifactSlug: expectedSlug,
};
for (const [key, value] of Object.entries(expected)) {
  if (manifest[key] !== value) {
    throw new Error(`${key} was ${manifest[key]}, expected ${value}`);
  }
}
if (!/^[a-f0-9]{64}$/.test(manifest.sha256)) {
  throw new Error("sha256 is missing or malformed");
}
NODE

info "Running tester guide smoke"
grep -qi "unsigned" TESTER_GUIDE.md
grep -qi "not notarized" TESTER_GUIDE.md
grep -qi "replace only" TESTER_GUIDE.md
grep -qi "Application Support/vaexcore pulse" TESTER_GUIDE.md
grep -qi "tokens, secrets, OAuth codes, refresh tokens" TESTER_GUIDE.md
grep -qi "Diagnostics" TESTER_GUIDE.md
grep -qi "unsigned" "${handoff_path}"
grep -qi "not notarized" "${handoff_path}"
grep -qi "replace only" "${handoff_path}"
grep -qi "tokens, secrets, OAuth codes, refresh tokens" "${handoff_path}"

info "Running diagnostics smoke"
run_from_root bash ./scripts/diagnostics.sh >/dev/null
latest_diagnostics="$(find "${REPO_ROOT}/release/diagnostics" -maxdepth 1 -type d -name 'vaexcore-pulse-diagnostics-*' -print | sort | tail -n 1)"
[[ -f "${latest_diagnostics}/diagnostics.txt" ]] || fail "Diagnostics smoke did not create diagnostics.txt"
grep -q "Active app data path: ${VCP_SUPPORT_DIR}" "${latest_diagnostics}/diagnostics.txt"
grep -qi "No config contents" "${latest_diagnostics}/diagnostics.txt"

info "Running clean install smoke"
rm -rf "${smoke_root}"
mkdir -p "${smoke_apps}"
vcp_disable_spotlight_indexing "${smoke_root}"
ditto "${app_path}" "${smoke_apps}/${VCP_APP_NAME}.app"
vcp_assert_release_app_metadata "${smoke_apps}/${VCP_APP_NAME}.app" "${version}"

info "Running tester update preservation smoke"
mkdir -p "${smoke_support}"
printf "keep me\n" >"${smoke_support}/preserved.txt"
rm -rf "${smoke_apps}/${VCP_APP_NAME}.app"
ditto "${app_path}" "${smoke_apps}/${VCP_APP_NAME}.app"
[[ -f "${smoke_support}/preserved.txt" ]] || fail "Update smoke lost Application Support data"

success "Unsigned release check passed"

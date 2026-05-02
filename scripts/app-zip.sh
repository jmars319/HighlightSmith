#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/release-common.sh"

section "Package macOS App Zip"
require_cmd ditto
require_cmd node
require_cmd shasum

version="$(vcp_version)"
arch="$(vcp_arch)"
app_path="$(vcp_app_path)"
slug="$(vcp_artifact_slug)"
zip_path="${REPO_ROOT}/release/${slug}.zip"
sha_path="${zip_path}.sha256"
manifest_path="${REPO_ROOT}/release/${slug}.json"
handoff_path="${REPO_ROOT}/release/${slug}-TESTER_HANDOFF.md"

if [[ ! -d "${app_path}" ]]; then
  info "Release app bundle is missing; building it first"
  run_from_root bash ./scripts/app-build.sh
fi

vcp_assert_release_app_metadata "${app_path}" "${version}"
rm -f "${zip_path}" "${sha_path}" "${manifest_path}" "${handoff_path}"

info "Creating unsigned app zip"
print_command ditto -c -k --sequesterRsrc --keepParent "${app_path}" "${zip_path}"
(
  cd "$(dirname "${app_path}")"
  ditto -c -k --sequesterRsrc --keepParent "$(basename "${app_path}")" "${zip_path}"
)

sha256="$(shasum -a 256 "${zip_path}" | awk '{print $1}')"
printf "%s  %s\n" "${sha256}" "$(basename "${zip_path}")" >"${sha_path}"

node - "${manifest_path}" "${slug}" "${version}" "${arch}" "${sha256}" "${zip_path}" "${app_path}" <<'NODE'
const [manifestPath, slug, version, arch, sha256, zipPath, appPath] =
  process.argv.slice(2);
const fs = require("node:fs");
const path = require("node:path");

const manifest = {
  productName: "vaexcore pulse",
  packageName: "vaexcore-pulse",
  appId: "com.vaexil.vaexcore.pulse",
  version,
  platform: "mac",
  arch,
  signed: false,
  notarized: false,
  artifactSlug: slug,
  artifacts: {
    appBundle: path.relative(process.cwd(), appPath),
    zip: path.relative(process.cwd(), zipPath),
    sha256: `${path.relative(process.cwd(), zipPath)}.sha256`,
  },
  sha256,
  appDataPath: "~/Library/Application Support/vaexcore pulse",
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

cat >"${handoff_path}" <<EOF
# vaexcore pulse unsigned tester handoff

Artifact: \`${slug}.zip\`

This build is unsigned and not notarized. macOS may block first launch with a trust warning.

## Install

1. Quit any running copy of vaexcore pulse.
2. Unzip \`${slug}.zip\`.
3. Move only \`vaexcore pulse.app\` into \`/Applications\`.
4. Launch from Finder. If macOS blocks it, Control-click the app, choose Open, then confirm Open.

## Update

Quit the app, replace only \`/Applications/vaexcore pulse.app\`, and keep:

\`~/Library/Application Support/vaexcore pulse\`

Do not delete Application Support when updating.

## Diagnostics

Run \`pnpm diagnostics\` from the repo to create a local support bundle. Diagnostics show paths and environment metadata only. They must never include tokens, secrets, OAuth codes, refresh tokens, or local config contents.

## Integrity

Verify the zip with:

\`\`\`bash
shasum -a 256 -c ${slug}.zip.sha256
\`\`\`
EOF

success "Packaged ${zip_path}"
note "SHA-256: ${sha256}"
note "Manifest: ${manifest_path}"
note "Tester handoff: ${handoff_path}"

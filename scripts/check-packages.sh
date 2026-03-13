#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

required_paths=(
  "apps/desktopapp/package.json"
  "apps/webapp/package.json"
  "services/analyzer/pyproject.toml"
  "services/api/package.json"
  "packages/shared-types/package.json"
  "packages/domain/package.json"
  "packages/ui/package.json"
  "packages/storage/package.json"
  "packages/media/package.json"
  "packages/scoring/package.json"
  "packages/profiles/package.json"
  "packages/export/package.json"
  "packages/ai-assist/package.json"
)

section "Workspace Layout Check"
note "Checking required monorepo paths"

for path in "${required_paths[@]}"; do
  require_path "${path}"
done

success "Package layout matches the monorepo scaffold"

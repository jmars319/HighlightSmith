#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

section "Analyzer Verification"
require_cmd python3
run_step \
  "Running analyzer mock flow summary" \
  env \
  PYTHONPATH=services/analyzer/src \
  python3 \
  -c \
  'from vaexcore_pulse_analyzer.contracts import Settings; from vaexcore_pulse_analyzer.pipeline.orchestrator import analyze_media; session = analyze_media(None, Settings(use_mock_data=True), profile_id="generic"); print(f"Mock session: {session.id} | profile={session.profile_id} | candidates={len(session.candidates)} | transcript_chunks={len(session.transcript)}")'
run_step \
  "Running analyzer unit tests" \
  env \
  PYTHONPATH=services/analyzer/src \
  python3 \
  -m \
  unittest \
  discover \
  -s \
  services/analyzer/tests \
  -p \
  'test_*.py'

success "Analyzer verification passed"

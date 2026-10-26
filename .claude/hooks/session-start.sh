#!/bin/bash
set -euo pipefail

# Only for Claude Code cloud sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Relevo needs the OpenSpec command line (see docs/install.md). Idempotent: skip when it already runs.
if ! command -v openspec > /dev/null 2>&1; then
  OPENSPEC_TELEMETRY=0 npm install --global @fission-ai/openspec
fi

echo "OpenSpec $(openspec --version)"

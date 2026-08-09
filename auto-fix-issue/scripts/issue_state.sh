#!/usr/bin/env bash
# Thin wrapper — delegates to the canonical copy in arcanum/_lib/
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/../../arcanum/_lib/issue_state.sh" "$@"

#!/usr/bin/env bash
# Thin wrapper — delegates to the canonical copy in _lib/
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/../../_lib/github_issue.sh" "$@"

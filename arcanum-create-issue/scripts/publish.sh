#!/usr/bin/env bash
# Thin engine_dispatch shim for the "arcanum-create-issue-publish" entrypoint —
# see docs/agents/architecture/arcanum-create-issue.md ("Native commands",
# "Label rules") and docs/agents/architecture/script-engine.md for the full
# design/shared contracts. Creates the GitHub issue from a draft file,
# applies (and, if missing, creates) its labels, then deletes the draft.
#
# Native-only: this command has NO shell implementation (no *_shell.sh
# twin) and is not tracked in arcanum/_lib/migration-status.json. It is
# dispatched with `engine_dispatch --native-only`, which always runs
# core/bin/arcanum (except engine.mode=docker, which errors out).
#
# `HOME` is forwarded to the native path's explicit env-var allowlist (as
# every other native GitHub-calling shim does) so gh/token resolution
# keeps working under native's `env -i`.
#
# <repo_path> is forwarded as the first native argument, where the
# `context: 'repo'` dispatcher consumes it, so --prepend-repo-path is not
# used. Flags and labels are forwarded verbatim; the native command does
# the remaining validation (malformed label, empty title/body, ...).
#
# Usage: publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...
#
# Output and exit code: passed through unchanged from core/bin/arcanum
# arcanum-create-issue-publish (KEY=value lines on stdout; exit 0 for
# STATUS=ok, 1 for STATUS=failed, 2 for invalid input, 4 for
# FALLBACK=chat) or from engine_dispatch's docker error. A missing
# <repo_path>, <draft> or <title> is rejected here with exit 2.

set -euo pipefail

REPO_PATH="${1:-}"
DRAFT="${2:-}"
TITLE="${3:-}"

[[ -n "$REPO_PATH" && -n "$DRAFT" && -n "$TITLE" ]] || {
  echo "Usage: $0 <repo_path> <draft> \"<title>\" [--confirmed] [--shipit-confirmed] <label>..." >&2
  exit 2
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck source=../../arcanum/_lib/engine_dispatch.sh
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"
engine_dispatch "$REPO_PATH" arcanum-create-issue-publish "" --native-only HOME -- "$@"

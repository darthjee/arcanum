#!/usr/bin/env bash
# Migration 001 (next): create docs/agents/specs.md from arcanum's
# canonical init-claude/templates/specs.md, and docs/agents/specs/.gitkeep
# when docs/agents/specs/ is missing or empty — the same specs scaffold
# /init-claude creates (init-claude/scripts/setup_docs_structure_shell.sh).
# See 001.md for a human-readable summary.
#
# Usage: 001.sh config
#        001.sh run
#
# run (cwd = target repo) always exits 0. The two checks are independent:
#   - docs/agents/specs.md absent (! -e) -> copied byte-for-byte from the
#     template, stdout "Created: docs/agents/specs.md"; present (any type)
#     -> untouched, stdout "Already present, left untouched: docs/agents/specs.md".
#   - docs/agents/specs/.gitkeep present -> nothing; docs/agents/specs is
#     not a directory -> warning on stderr, nothing created; directory
#     non-empty per `ls -A` (hidden entries count) -> nothing; otherwise
#     -> empty .gitkeep created, stdout "Created: docs/agents/specs/.gitkeep".

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_SRC="${SCRIPT_DIR}/../../../../init-claude/templates/specs.md"

SPECS_INDEX_PATH="docs/agents/specs.md"
SPECS_DIR="docs/agents/specs"
SPECS_GITKEEP_PATH="${SPECS_DIR}/.gitkeep"

cmd_config() {
  echo '{"skippable": true}'
}

_ensure_specs_index() {
  if [[ -e "$SPECS_INDEX_PATH" ]]; then
    echo "Already present, left untouched: ${SPECS_INDEX_PATH}"
  else
    mkdir -p "$(dirname "$SPECS_INDEX_PATH")"
    cp "$TEMPLATE_SRC" "$SPECS_INDEX_PATH"
    echo "Created: ${SPECS_INDEX_PATH}"
  fi
}

_ensure_specs_gitkeep() {
  if [[ -e "$SPECS_GITKEEP_PATH" ]]; then
    :
  elif [[ -e "$SPECS_DIR" && ! -d "$SPECS_DIR" ]]; then
    echo "Warning: ${SPECS_DIR} exists and is not a directory — skipping ${SPECS_GITKEEP_PATH}." >&2
  elif [[ -d "$SPECS_DIR" && -n "$(ls -A "$SPECS_DIR" 2>/dev/null)" ]]; then
    :
  else
    mkdir -p "$SPECS_DIR"
    : > "$SPECS_GITKEEP_PATH"
    echo "Created: ${SPECS_GITKEEP_PATH}"
  fi
}

cmd_run() {
  _ensure_specs_index
  _ensure_specs_gitkeep
}

case "${1:-}" in
  config) cmd_config ;;
  run) cmd_run ;;
  *)
    echo "Usage: $0 {config|run}" >&2
    exit 1
    ;;
esac

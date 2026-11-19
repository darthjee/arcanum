#!/usr/bin/env bash
# Create the standard docs/agents/ directory structure and register it in AGENTS.md.
# Shell implementation behind the setup_docs_structure.sh engine_dispatch
# shim (command "init-claude-setup-docs-structure"); the native counterpart
# must stay byte-identical in stdout, stderr, exit code and resulting files.
#
# Usage: setup_docs_structure_shell.sh
#   Run from the target project root. Arguments are ignored.
#
# Creates (skipping any that already exist):
#   docs/agents/issues/.gitkeep
#   docs/agents/plans/.gitkeep
#   docs/agents/architecture.md          (placeholder)
#   docs/agents/flow.md                  (placeholder)
#   docs/agents/issue-enhancement.md     (placeholder)
#   docs/agents/arcanum-split-issue.md   (placeholder)
#
# Appends the standard ## Documentation section to AGENTS.md if not already present.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="${SCRIPT_DIR}/../templates"
SPECS_INDEX_TEMPLATE="${TEMPLATES_DIR}/specs.md"
DOCS_SECTION_TEMPLATE="${TEMPLATES_DIR}/agents-documentation-section.md"

SPECS_INDEX_PATH="docs/agents/specs.md"
SPECS_DIR="docs/agents/specs"
SPECS_GITKEEP_PATH="${SPECS_DIR}/.gitkeep"

CREATED=()
SKIPPED=()

_create_file() {
  local path="$1"
  local content="$2"
  if [[ -e "$path" ]]; then
    SKIPPED+=("$path")
  else
    mkdir -p "$(dirname "$path")"
    printf '%s\n' "$content" > "$path"
    CREATED+=("$path")
  fi
}

# --- Directory structure ---

_create_file "docs/agents/issues/.gitkeep" ""
_create_file "docs/agents/plans/.gitkeep" ""

_create_file "docs/agents/architecture.md" \
"# Architecture

## Overview

_Describe the high-level architecture of the project here._

## Source Code Layout

_Describe the directory structure and the role of each module._"

_create_file "docs/agents/flow.md" \
"# Flow

## Overview

_Describe the main runtime flow of the application here._"

_create_file "docs/agents/issue-enhancement.md" \
"# Issue Enhancement

A checklist of concerns to consider when fleshing out a vague issue idea (tagged \`Idea\`/\`Writting\`) before it reaches the \`Created\` stage. Not exhaustive — adjust or extend the list for this project's needs.

- **Scope boundaries** — what's explicitly in scope and what's explicitly out.
- **Alternative solutions** — other ways to solve the same problem, and why this one was chosen.
- **Edge cases** — inputs, states, or timing the happy path doesn't cover.
- **Backward compatibility** — whether this breaks existing behavior, data, or integrations.
- **Testing strategy** — how the change will be verified.
- **Performance & security considerations** — anything relevant to load, latency, or attack surface."

_create_file "docs/agents/arcanum-split-issue.md" \
"# Arcanum Split Issue

A checklist of concerns to consider when splitting a broad issue into sub-issues via \`/arcanum-split-issue\`. Not exhaustive — adjust or extend the list for this project's needs.

- **Sub-issue granularity** — is each sub-issue independently workable, or does it still depend on another sub-issue landing first?
- **Standalone clarity** — does each sub-issue stand on its own, without requiring the reader to have the parent issue open to understand it?
- **Shared contracts** — interfaces, schemas, or config keys touched by more than one sub-issue, and who owns getting them right first.
- **Sequencing** — is there a natural order sub-issues should be implemented/merged in, or can they proceed in parallel?
- **Responsible agents** — which specialist agent(s) each sub-issue is likely to fall to."

# --- Specs index (copied byte-for-byte from the canonical template) ---

if [[ -e "$SPECS_INDEX_PATH" ]]; then
  SKIPPED+=("$SPECS_INDEX_PATH")
  echo "Note: ${SPECS_INDEX_PATH} already exists and was left untouched; compare it with init-claude/templates/specs.md if it is outdated." >&2
else
  mkdir -p "$(dirname "$SPECS_INDEX_PATH")"
  cp "$SPECS_INDEX_TEMPLATE" "$SPECS_INDEX_PATH"
  CREATED+=("$SPECS_INDEX_PATH")
fi

# --- Specs directory placeholder ---
# Only created when docs/agents/specs/ is missing or empty (hidden entries
# count); never created inside a non-empty directory or over a non-directory.

if [[ -e "$SPECS_GITKEEP_PATH" ]]; then
  SKIPPED+=("$SPECS_GITKEEP_PATH")
elif [[ -e "$SPECS_DIR" && ! -d "$SPECS_DIR" ]]; then
  echo "Warning: ${SPECS_DIR} exists and is not a directory — skipping ${SPECS_GITKEEP_PATH}." >&2
elif [[ -d "$SPECS_DIR" && -n "$(ls -A "$SPECS_DIR" 2>/dev/null)" ]]; then
  :
else
  _create_file "$SPECS_GITKEEP_PATH" ""
fi

# --- AGENTS.md documentation section ---

AGENTS_UPDATED=false
if [[ -f "AGENTS.md" ]] && ! grep -q "^## Documentation" "AGENTS.md" 2>/dev/null; then
  printf '\n' >> "AGENTS.md"
  cat "$DOCS_SECTION_TEMPLATE" >> "AGENTS.md"
  AGENTS_UPDATED=true
elif [[ ! -f "AGENTS.md" ]]; then
  echo "Warning: AGENTS.md not found — skipping Documentation section append." >&2
elif ! grep -qF "docs/agents/specs.md" "AGENTS.md" 2>/dev/null; then
  echo "Warning: AGENTS.md has a ## Documentation section with no link to docs/agents/specs.md — add the Specs row and the ### Specs subsection from init-claude/templates/agents-documentation-section.md." >&2
fi

# --- Summary ---

if [[ ${#CREATED[@]} -gt 0 ]]; then
  echo "Created:"
  for f in "${CREATED[@]}"; do echo "  $f"; done
fi

if [[ ${#SKIPPED[@]} -gt 0 ]]; then
  echo "Already existed (skipped):"
  for f in "${SKIPPED[@]}"; do echo "  $f"; done
fi

if [[ "$AGENTS_UPDATED" == true ]]; then
  echo "AGENTS.md: appended Documentation section"
elif [[ -f "AGENTS.md" ]]; then
  echo "AGENTS.md: Documentation section already present (skipped)"
fi

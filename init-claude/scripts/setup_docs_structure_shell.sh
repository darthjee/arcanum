#!/usr/bin/env bash
# Create the standard docs/agents/ directory structure and register it in AGENTS.md.
# Usage: setup_docs_structure.sh
#   Run from the target project root.
#
# Creates (skipping any that already exist):
#   docs/agents/issues/.gitkeep
#   docs/agents/plans/.gitkeep
#   docs/agents/architecture.md  (placeholder)
#   docs/agents/flow.md          (placeholder)
#   docs/agents/issue-enhancement.md (placeholder)
#
# Appends the standard ## Documentation section to AGENTS.md if not already present.

set -euo pipefail

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

# --- AGENTS.md documentation section ---

AGENTS_UPDATED=false
if [[ -f "AGENTS.md" ]] && ! grep -q "^## Documentation" "AGENTS.md" 2>/dev/null; then
  cat >> "AGENTS.md" << 'DOCS_SECTION'

## Documentation

All project documentation lives under [`docs/agents/`](docs/agents/):

| File | Contents |
|------|----------|
| [Folder Structure](docs/agents/folder-structure.md) | Top-level directory layout and the role of each folder. |
| [Architecture](docs/agents/architecture.md) | Source layout, modules, code style, and implementation guidelines. |
| [Flow](docs/agents/flow.md) | Main runtime flow of the application. |
| [Plans](docs/agents/plans/) | Implementation plans for ongoing or upcoming features. |
| [Issues](docs/agents/issues/) | Detailed specs for open issues. |

### Issues (`docs/agents/issues/`)

Each file documents an issue in detail. Naming convention:

```
docs/agents/issues/<issue_id>_<issue_name>.md
```

Example: `docs/agents/issues/5_release_docker_image.md` for issue #5.

### Plans (`docs/agents/plans/`)

Each plan is a directory named after the issue ID and topic, containing one or more related files:

```
docs/agents/plans/<issue_id>_<topic>/<related_files>.md
```

Example: `docs/agents/plans/12_add-auth/plan.md` for issue #12.
DOCS_SECTION
  AGENTS_UPDATED=true
elif [[ ! -f "AGENTS.md" ]]; then
  echo "Warning: AGENTS.md not found — skipping Documentation section append." >&2
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

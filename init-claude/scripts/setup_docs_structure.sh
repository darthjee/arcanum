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

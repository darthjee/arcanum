# Split run_checks.sh into shell impl plus engine_dispatch shim

Rename the current `auto-fix-issue/scripts/run_checks.sh` to `run_checks_shell.sh`, content unchanged, and replace `run_checks.sh` with a thin `engine_dispatch` shim — mirroring `list_plan_agents.sh`'s split (same argument shape: no `<repo_path>` positional, `REPO_PATH` derived from the ambient git checkout for `engine_dispatch`'s own `config_chain_read` call), not `create_branch.sh`'s (which does take an explicit `<repo_path>`).

Forward `HOME` in the native env-var allowlist — the check script is arbitrary, project-defined content that may itself need `$HOME` (see [node.md](../node.md)'s Notes), the same rationale `commit_change.sh` already forwards `HOME` for.

## Files to Change
- `auto-fix-issue/scripts/run_checks_shell.sh` — new file, exact content of today's `run_checks.sh`.
- `auto-fix-issue/scripts/run_checks.sh` — replaced with the shim:
  ```bash
  #!/usr/bin/env bash
  set -euo pipefail

  AGENT="${1:-}"

  [[ -n "$AGENT" ]] || {
    echo "Usage: $0 <agent>" >&2
    exit 1
  }

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # shellcheck source=../../arcanum/_lib/engine_dispatch.sh
  source "${SCRIPT_DIR}/../../arcanum/_lib/engine_dispatch.sh"

  REPO_PATH="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

  engine_dispatch "$REPO_PATH" auto-fix-issue-run-checks "${SCRIPT_DIR}/run_checks_shell.sh" HOME -- "$@"
  ```

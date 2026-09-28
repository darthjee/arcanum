# Plan: Route auto-fix-all/scripts/github.sh through engine_dispatch (native counterparts unreachable)

Issue: [656-route-auto-fix-all-scripts-github-sh-through-engine-dispatch-native-counterparts-unreachable.md](../../issues/656-route-auto-fix-all-scripts-github-sh-through-engine-dispatch-native-counterparts-unreachable.md)

## Overview

Turn `auto-fix-all/scripts/github.sh` into a per-subcommand `engine_dispatch` shim, following the existing `auto-fix-issue/scripts/github.sh` pattern, so its 7 subcommands reach the already-built native `auto-fix-all-github-*` commands when `engine.mode=native`. The bash logic moves unchanged into `github_shell.sh`. Both GitHub shims lose their shell-only fallthrough, the migration map gets real per-subcommand keys, and the specs that assumed "github.sh is always shell" are repointed. No `core/lib` and no skill markdown changes.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Shell implementation:** `auto-fix-all/scripts/github_shell.sh` holds the current `github.sh` body **byte-for-byte unchanged in behaviour**. Same CLI: `github_shell.sh <subcommand> <repo_path> [args]`, same stdout, stderr and exit codes, same usage block with exit 1 for unknown or missing subcommands, and same `GH_INSECURE_SKIP_VERIFY=true` export.
- **Per-subcommand wrappers** (shell side of `engine_dispatch`), each a one-liner `exec bash "<dir>/github_shell.sh" <subcommand> "$@"`:

  | Subcommand | Wrapper | Native command / map key |
  | --- | --- | --- |
  | `pr-number` | `github_shell_pr_number.sh` | `auto-fix-all-github-pr-number` |
  | `pr-state` | `github_shell_pr_state.sh` | `auto-fix-all-github-pr-state` |
  | `pr-merge` | `github_shell_pr_merge.sh` | `auto-fix-all-github-pr-merge` |
  | `cleanup-branch` | `github_shell_cleanup_branch.sh` | `auto-fix-all-github-cleanup-branch` |
  | `has-shipit-label` | `github_shell_has_shipit_label.sh` | `auto-fix-all-github-has-shipit-label` |
  | `add-tag` | `github_shell_add_tag.sh` | `auto-fix-all-github-add-tag` |
  | `remove-tag` | `github_shell_remove_tag.sh` | `auto-fix-all-github-remove-tag` |

- **Shim** `auto-fix-all/scripts/github.sh`, called as `github.sh <subcommand> <repo_path> [args]` (signature unchanged for every caller):
  `engine_dispatch "$REPO_PATH" <native command> "${SCRIPT_DIR}/<wrapper>" HOME -- "${@:2}"`. Native receives `<repo_path> [rest]` with no subcommand, since its commands are `context: 'repo'`. `HOME` is forwarded for all 7 (`gh` auth, git config and credentials).
- **Unknown or missing subcommand** in either shim (`auto-fix-all/scripts/github.sh`, `auto-fix-issue/scripts/github.sh`): print that script's usage to stderr and exit 1. It never falls through to `github_shell.sh`.
- **`wait_ci_and_merge_shell.sh`** calls `github_shell.sh pr-merge` directly, not the shim, so the shell implementation stays pure shell regardless of `engine.mode`.
- **`arcanum/_lib/migration-status.json`:** the key `auto-fix-all-github` is removed, and the 7 keys in the table above are added, all `true`.

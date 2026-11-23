# Plan: Push helpers push all matching branches on a detached HEAD

Issue: [947-push-helpers-push-all-matching-branches-on-a-detached-head.md](../../issues/947-push-helpers-push-all-matching-branches-on-a-detached-head.md)

## Overview
Every "push the current branch" helper builds `git push -u origin "<branch>:<branch>"` from `git branch --show-current`. On a detached HEAD the branch is empty, so the refspec degrades to `:` ("push all matching branches"). The fix makes the push helper strict in both engines: it refuses an empty branch with a fixed message and never calls `git push`. Every commit/push entrypoint checks the branch before its first side effect, the five private native `_pushCurrentBranch` copies are consolidated onto `GitClient`, and the single best-effort caller (`monitor_pr`) keeps its tolerance in its own code.

## Agents involved

- [scripter](scripter.md): shell engine (`arcanum/_lib/push.sh` and the `*_shell.sh` entrypoints)
- [node](node.md): native engine (`core/lib/utils/git/GitClient.js`, the five commit/reply commands, the monitor) plus all specs, including shell/native parity specs

## Shared contracts

**Refusal message** (byte-identical on both engines, written to stderr):

```
refusing to push: no current branch (detached HEAD?)
```

Native: thrown as `new Error('refusing to push: no current branch (detached HEAD?)')`, rendered by the CLI's usual error path. Shell: `echo "refusing to push: no current branch (detached HEAD?)" >&2`. Parity specs compare stderr using the same convention they already use for other error messages (the native CLI's own prefix is accounted for as elsewhere).

**Helper API**

| Engine | Check only | Check + push |
|---|---|---|
| Shell (`arcanum/_lib/push.sh`) | `require_current_branch`: prints the branch name on stdout and returns `0`; on an empty name, prints the refusal on stderr and returns `1` | `push_current_branch`: calls `require_current_branch` (returns `1` without running `git push` on refusal), then `git push -u origin "<b>:<b>"` |
| Native (`GitClient`) | `requireCurrentBranch()`: resolves to the trimmed branch name; rejects with the refusal error on an empty name | `pushCurrentBranch()`: `requireCurrentBranch()`, then `git push -u origin <b>:<b>`; resolves to `git push`'s stdout; **rejects** on any failure (no longer best-effort) |

**Placement**: every entrypoint (`commit_plan`, `commit_issue`, `commit_change`, `cleanup_artifacts`, `reply_comment`) calls the check-only helper right after argument validation and `repo_path_enter` / repo resolution, **before** any `git add`, `git rm`, `git commit`, PR-number resolution side effects or `gh pr comment`. With `set -euo pipefail` in shell, a failing `require_current_branch` exits the script non-zero.

**Best-effort caller**: `monitor_pr` only. Shell keeps `push_current_branch 2>/dev/null || true`; native wraps `this._gitClient.pushCurrentBranch()` in its own `try/catch` that swallows silently.

**Exit/stdout on refusal**: non-zero exit, empty stdout, on both engines.

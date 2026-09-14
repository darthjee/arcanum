# Plan: Fix SC2034 REPO_PATH cluster: verify unused vs. sourced across auto-fix-all queue scripts

Issue: [473_fix-sc2034-repo-path-cluster-verify-unused-vs-sourced-across-auto-fix-all-queue-scripts.md](../../issues/473-fix-sc2034-repo-path-cluster-verify-unused-vs-sourced-across-auto-fix-all-queue-scripts.md)

## Overview

Codacy's ShellCheck flags `REPO_PATH="${1:?Usage: $0 <repo_path>}"` as an unused assignment (SC2034) in 5 `auto-fix-all/scripts/queue_*_shell.sh` scripts. Investigation during discussion of this issue confirmed all 5 are genuinely dead: `queue_common.sh` (the file each script sources) and everything it sources in turn (`arcanum/_lib/lock.sh`, `origin.sh`, `tags.sh`, `tag_mutate.sh`) never read a `REPO_PATH` global — `_read_queue` and friends take no `repo_path` argument at all. This contradicts the issue's original premise that the sourced queue lib reads it.

Unlike these 5, the sibling scripts `queue_push_shell.sh` and `queue_save_shell.sh` are correctly NOT flagged, because they genuinely use `$REPO_PATH` locally (`_mark_enqueued "$REPO_PATH" ...`) — leave those two untouched.

The fix is not a bare line deletion: `${1:?Usage: $0 <repo_path>}` also enforces that a `repo_path` argument was supplied, exiting with a usage message otherwise. Deleting the whole line would silently drop that check. Instead, replace the dead variable binding with a `:` (bash no-op / null command) that still evaluates `${1:?...}` for its side effect (the usage-message guard) without assigning it to an unused variable.

## Context

- Sub-issue of #464 (the broader SC2034 sweep), covering the `REPO_PATH` cluster specific to these 5 `auto-fix-all` queue scripts.
- All 5 files live under `auto-fix-all/scripts/`, squarely in `scripter`'s scope.
- Acceptance criteria require zero behavior change — this drives the choice of `: "${1:?...}"` over outright deletion.

## Implementation Steps

### Step 1 — Replace the dead `REPO_PATH` assignment in all 5 queue scripts

In each of the following files, change:

```bash
REPO_PATH="${1:?Usage: $0 <repo_path>}"
```

to:

```bash
: "${1:?Usage: $0 <repo_path>}"
```

Files and exact lines (verify the line number still matches before editing, in case the file has drifted since this plan was written):

- `auto-fix-all/scripts/queue_empty_shell.sh:12`
- `auto-fix-all/scripts/queue_wait_next_shell.sh:13`
- `auto-fix-all/scripts/queue_list_shell.sh:12`
- `auto-fix-all/scripts/queue_next_shell.sh:12`
- `auto-fix-all/scripts/queue_pop_shell.sh:12`

Do not touch `queue_push_shell.sh` or `queue_save_shell.sh` — their `REPO_PATH` assignments are genuinely used (passed into `_mark_enqueued`) and are not part of this finding.

### Step 2 — Verify no SC2034 findings and no behavior change

- Run `shellcheck` (if available locally) or the Codacy CLI over the 5 changed files and confirm the `REPO_PATH` SC2034 finding is gone from each, with no newly introduced warnings.
- Manually invoke each of the 5 scripts once with no arguments and confirm the same `Usage: <script> <repo_path>` error still prints (behavior-preserving check for the `${1:?...}` guard).
- Sanity-check `auto-fix-all/scripts/queue.sh`'s `engine_dispatch` calls (lines invoking these 5 scripts) still pass `"$REPO_PATH"` as before — no caller-side change is needed, this just confirms nothing else was disturbed.

## Files to Change

- `auto-fix-all/scripts/queue_empty_shell.sh` — replace dead `REPO_PATH=` assignment with `: "${1:?...}"`.
- `auto-fix-all/scripts/queue_wait_next_shell.sh` — same.
- `auto-fix-all/scripts/queue_list_shell.sh` — same.
- `auto-fix-all/scripts/queue_next_shell.sh` — same.
- `auto-fix-all/scripts/queue_pop_shell.sh` — same.

## Notes

- No `# shellcheck disable=SC2034` suppression is needed anywhere in this cluster — none of the 5 assignments are actually consumed by the sourced lib, so removal (via the no-op) is correct, not suppression.
- No local CI job runs ShellCheck/Codacy in this repo's `.circleci` config — verification in Step 2 is a manual/local check plus the next Codacy scan on the PR.

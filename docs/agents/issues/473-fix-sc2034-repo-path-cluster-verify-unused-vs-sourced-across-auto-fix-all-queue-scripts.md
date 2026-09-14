# Issue: Fix SC2034 REPO_PATH cluster: verify unused vs. sourced across auto-fix-all queue scripts

## Description

Part of #464 (Sweep unused shell variables flagged by ShellCheck SC2034). Codacy's ShellCheck flags `REPO_PATH` as an unused assignment (SC2034) in 5 `auto-fix-all` queue scripts: `queue_empty_shell.sh`, `queue_wait_next_shell.sh`, `queue_list_shell.sh`, `queue_next_shell.sh`, and `queue_pop_shell.sh`. Each assigns `REPO_PATH="${1:?Usage: $0 <repo_path>}"` and sources `queue_common.sh`.

## Problem

Investigation confirms all 5 assignments are genuinely dead — `queue_common.sh` (the file each script sources) and everything *it* sources in turn (`arcanum/_lib/lock.sh`, `origin.sh`, `tags.sh`, `tag_mutate.sh`) never read a `REPO_PATH` global; `_read_queue` and its siblings take no `repo_path` argument at all. This is the opposite of the issue's original premise (that ShellCheck's cross-file blindness was hiding real usage by the sourced lib). Unlike these 5, the sibling scripts `queue_push_shell.sh` and `queue_save_shell.sh` are NOT flagged, because they genuinely use `$REPO_PATH` locally (passed into `_mark_enqueued "$REPO_PATH" ...`).

However, `${1:?Usage: $0 <repo_path>}` isn't pure noise: it also enforces that a `repo_path` argument was supplied, exiting with a usage message if it's missing. A naive full-line deletion would drop that check too, changing behavior for a missing-argument call — conflicting with this issue's own "no existing script behavior changes" acceptance criterion.

## Expected Behavior

- All 5 `REPO_PATH` SC2034 findings above are resolved via the `: "${1:?...}"` no-op pattern.
- No existing script behavior changes — each script still errors with the same usage message when called without a `repo_path` argument, and behaves identically otherwise.
- Re-running ShellCheck/Codacy on the affected files shows zero SC2034 findings among these 5 locations.

## Solution

For each of the following 5 files, replace the dead assignment with a no-op that preserves the same argument-count/usage-message validation without binding an unused variable:

- `auto-fix-all/scripts/queue_empty_shell.sh:12`
- `auto-fix-all/scripts/queue_wait_next_shell.sh:13`
- `auto-fix-all/scripts/queue_list_shell.sh:12`
- `auto-fix-all/scripts/queue_next_shell.sh:12`
- `auto-fix-all/scripts/queue_pop_shell.sh:12`

```
REPO_PATH="${1:?Usage: $0 <repo_path>}"
```
becomes
```
: "${1:?Usage: $0 <repo_path>}"
```

This clears the SC2034 finding while keeping the exact same "missing argument → usage error" behavior; no `# shellcheck disable=SC2034` suppression is needed since nothing remains to suppress.

Work should be delegated to the `scripter` agent, since all affected files are under `<skill>/scripts/`.

## Benefits

- Clears 5 of the 24 outstanding Codacy/ShellCheck SC2034 findings tracked by #464.
- Keeps argument validation intact rather than silently weakening it, avoiding a regression the acceptance criteria explicitly rule out.

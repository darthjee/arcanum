# Scripter Plan: github_issue.sh / issue_state.sh write to ambient-cwd-relative paths instead of $repo_path

Main plan: [plan.md](plan.md)

## Shared contracts

You own the implementation side of both new signatures — get these exactly right, skill-writer's doc updates must match:

- `arcanum/_lib/issue_state.sh <repo_path> <get|set|set-json|append-json> <id> <field> [value]`
- `arcanum/_lib/list_agents.sh <repo_path> [agents_dir]`
- `arcanum/_lib/github_issue.sh fetch|create <repo_path> ...` — signature unchanged, internal behavior changes only.

## Implementation Steps

### Step 1 — `arcanum/_lib/issue_state.sh`: add `repo_path`, call `repo_path_enter`

- Add `source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/repo_path.sh"` near the top (the file currently has no `SCRIPT_DIR`/sourcing at all — add both).
- Shift argument parsing: `REPO_PATH="${1:-}"`, `COMMAND="${2:-}"`, `ISSUE_ID="${3:-}"`, `FIELD="${4:-}"` (and `VALUE="${5:-}"` inside `set`/`set-json`/`append-json`, currently `${4:-}`).
- Call `repo_path_enter "$REPO_PATH"` immediately after the existing arg-presence check (add `REPO_PATH` to that check too), before `STATE_DIR=".claude/state"` is used.
- Update the usage/header comment (lines 1-11) to document the new leading argument, and update all four `Usage:` error-message lines (20-24, 119-123) to match.
- `STATE_DIR`/`STATE_FILE`/`LOCK_FILE` stay literally as `".claude/state"`-relative — they're now correct because `repo_path_enter` already `cd`'d.

### Step 2 — `arcanum/_lib/list_agents.sh`: add `repo_path`, call `repo_path_enter`

- Add `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` and `source "${SCRIPT_DIR}/repo_path.sh"` near the top.
- `REPO_PATH="${1:-}"`, then call `repo_path_enter "$REPO_PATH"` before touching `AGENTS_DIR`.
- `AGENTS_DIR="${2:-.claude/agents}"` (shift from `${1:-...}`).
- Add a `[[ -n "$REPO_PATH" ]]` guard (usage error) — this script currently has no required-arg check at all since everything was optional; `repo_path` must now be required per the repo's convention (no ambient-cwd fallback).
- Update the header comment (lines 1-8) for the new signature.

### Step 3 — `arcanum/_lib/github_issue.sh`: `cmd_fetch`/`cmd_create` honor `repo_path`

- Add `source "${SCRIPT_DIR}/repo_path.sh"` alongside the existing `source` lines (17-30).
- In `cmd_fetch` (currently ~53-103) and `cmd_create` (currently ~136-178): call `repo_path_enter "$repo_path"` right after the existing arg-presence check, **before** `_load_origin "$repo_path"` (order doesn't matter functionally since `_load_origin` uses `git -C`, but doing it first keeps every subsequent line — including `_load_origin` — running from a known-correct cwd).
- No change needed to `issues_dir="docs/agents/issues"`/`mkdir -p`/`filepath=...` themselves — they become correct automatically once cwd is `repo_path`. The `FILE=$filepath` output stays a `repo_path`-relative path, matching what `resolve_and_fetch.sh`'s callers already expect (per `docs/agents/architecture/repo-path-threading.md`, `$FILE` is documented as relative to `$REPO_PATH`, not ambient cwd).
- Update `cmd_fetch`'s four `issue_state.sh` invocations (~86-96) to pass `$repo_path` as the new leading argument, e.g.:
  ```bash
  "$issue_state_script" "$repo_path" set-json "$id" tags "$tags_json"
  "$issue_state_script" "$repo_path" set      "$id" updated_at "$updated_at"
  "$issue_state_script" "$repo_path" set      "$id" title "$title"
  "$issue_state_script" "$repo_path" set      "$id" state "$issue_state"
  ```
- Update the top-of-file usage comment (lines 3-13) if it references paths in a way that implies ambient-cwd resolution (it currently doesn't explicitly, but double check after the edit).

### Step 4 — Update every other `issue_state.sh` caller (non-`.md`)

For each, insert `$REPO_PATH`/`"$repo_path"` (whichever variable name the calling script already uses — confirm before editing) as the new first argument to the `issue_state.sh` call:

- `arcanum-split-issue/scripts/create_sub_issue.sh:91` — `"${LIB_DIR}/issue_state.sh" append-json "$ISSUE_ID" sub-issues "\"$new_id\""` → prepend `"$REPO_PATH"`. Confirm the script's own `REPO_PATH` variable name/arg position (it already calls `repo_path_enter "$REPO_PATH"` at line 41) before editing.
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh:32` — `"${SCRIPT_DIR_SELF}/../../arcanum/_lib/issue_state.sh" get "$ID" pr_id` → prepend `"$REPO_PATH"` (already available, `repo_path_enter` called at line 28).
- `auto-fix-all/scripts/github.sh:47,108,109` — three `"${SCRIPT_DIR}/../../arcanum/_lib/issue_state.sh" get "$id" pr_id|pr_url` calls → prepend `"$REPO_PATH"` (already `repo_path_enter`'d via the dispatch `case`, confirm the in-scope variable name at each call site).
- `auto-fix-issue/scripts/github.sh:50,51,82` — three `"${SCRIPT_DIR}/issue_state.sh" set|set-json ...` calls (via the skill-local wrapper) → prepend `"$REPO_PATH"` (already `repo_path_enter`'d via its own dispatch `case`).
- `monitor-issues/scripts/monitor_issues.sh:119,165-166` — `"$ISSUE_STATE_SCRIPT" set ...`/similar via the skill-local wrapper (`ISSUE_STATE_SCRIPT` set at line 26) → prepend `"$REPO_PATH"`. This script currently never calls `repo_path_enter` anywhere — add that call too (near the top, after its own `REPO_PATH` arg is parsed), since it's exactly the kind of caller the parent issue flags as latently broken.
- `auto-monitor-pr/scripts/monitor_pr.sh:133-134` — via `ISSUE_STATE_SCRIPT` (set at line 64) → prepend `"$REPO_PATH"` (already `repo_path_enter`'d at line 96).

Re-run `grep -rn "issue_state\.sh"` across the repo before finishing this step to catch any call site not listed above (added since the parent issue's investigation).

### Step 5 — Update every other `list_agents.sh` caller (non-`.md`)

The four wrapper scripts (`discuss-issue/scripts/list_agents.sh`, `plan-issue/scripts/list_agents.sh`, `auto-plan-issue/scripts/list_agents.sh`) are `exec ... "$@"` pass-throughs — no edits needed to them. Their callers are all in `steps/*.md` prose (skill-writer's part, see [skill-writer.md](skill-writer.md)) — no non-`.md` caller of `list_agents.sh` exists today per the investigation. Re-run `grep -rn "list_agents\.sh"` before finishing this step to confirm nothing was missed.

### Step 6 — Manual verification

No CI job or automated test exercises these scripts. Verify by hand from a throwaway directory (cwd deliberately *not* the target repo) — e.g.:

```bash
cd /tmp
arcanum/_lib/issue_state.sh "$REPO_PATH" set 999 test_field hello
cat "$REPO_PATH/.claude/state/issue-999.json"   # expect the field present
rm -f "$REPO_PATH/.claude/state/issue-999.json" "$REPO_PATH/.claude/state/issue-999.lock"

arcanum/_lib/list_agents.sh "$REPO_PATH"        # expect the same agent list as running it from inside $REPO_PATH

arcanum/_lib/github_issue.sh fetch "$REPO_PATH" <a real open issue id>
ls "$REPO_PATH/docs/agents/issues/"             # expect the fetched file there, not under /tmp
```

## Files to Change

- `arcanum/_lib/issue_state.sh` — new leading `repo_path` arg, `repo_path_enter` call, updated usage text.
- `arcanum/_lib/list_agents.sh` — new leading `repo_path` arg, `repo_path_enter` call, updated header comment.
- `arcanum/_lib/github_issue.sh` — `repo_path_enter` in `cmd_fetch`/`cmd_create`, updated `issue_state.sh` call sites.
- `arcanum-split-issue/scripts/create_sub_issue.sh` — pass `repo_path` to `issue_state.sh`.
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — pass `repo_path` to `issue_state.sh`.
- `auto-fix-all/scripts/github.sh` — pass `repo_path` to `issue_state.sh` (×3 call sites).
- `auto-fix-issue/scripts/github.sh` — pass `repo_path` to `issue_state.sh` (×3 call sites).
- `monitor-issues/scripts/monitor_issues.sh` — add `repo_path_enter`, pass `repo_path` to `issue_state.sh` (×2-3 call sites).
- `auto-monitor-pr/scripts/monitor_pr.sh` — pass `repo_path` to `issue_state.sh`.

## Notes

- Double-check each caller's existing variable name (`$REPO_PATH` vs `$repo_path` vs something else) before editing — don't assume; `grep` the top of each file for its own arg-parsing to confirm.
- `arcanum/_lib/config_chain.sh`, `spawn_issue.sh`, and `safe_branch.sh` are explicitly **not** in scope — investigation confirmed they already follow the `repo_path_enter`-before-sourcing convention correctly (see the issue's Description).
- Coordinate with skill-writer on the exact final argument order before either side finishes, so the doc examples and the real scripts never drift.

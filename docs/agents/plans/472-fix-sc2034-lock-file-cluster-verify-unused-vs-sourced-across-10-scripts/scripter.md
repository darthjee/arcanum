# Scripter Plan: Fix SC2034 LOCK_FILE cluster: verify unused vs. sourced across 10 scripts

Main plan: [plan.md](plan.md)

## Context

All 10 files listed in the issue source `arcanum/_lib/lock.sh` (directly, or transitively via `queue_common.sh`), which defines `_acquire_lock`/`_release_lock`. Those functions read `$LOCK_FILE` as a global set by the caller before invoking them — see the usage comment at the top of `arcanum/_lib/lock.sh`. Verification below (local `shellcheck`, `_acquire_lock`/`_release_lock` call sites, and callers of each file) confirms **none of the 10 are dead code** — every one is genuinely read by `_acquire_lock`/`_release_lock`, just through a cross-file path ShellCheck's single-file analysis can't see. Locally, `shellcheck -x` run from each file's own directory *does* resolve the cross-file read and reports no SC2034 for these lines — but Codacy's analysis (no `.shellcheckrc` or Codacy shellcheck config exists in this repo to change that) flags them anyway, exactly as the issue describes. So the fix in every case is the suppression comment, not a deletion.

Two shapes recur:

- **Self-contained (9 files)**: the file itself sources `lock.sh` and later calls `_acquire_lock`/`_release_lock` in the same file. The consumer to name is `_acquire_lock`/`_release_lock` in `lock.sh`.
- **Cross-file (1 file, `queue_common.sh`)**: `queue_common.sh` sets `LOCK_FILE` and sources `lock.sh`, but never calls `_acquire_lock`/`_release_lock` itself — its callers `queue_pop_shell.sh` and `queue_push_shell.sh` do, after sourcing `queue_common.sh`. The consumer to name is those two callers.

## Implementation Steps

### Step 1 — Add `# shellcheck disable=SC2034` above each of the 10 `LOCK_FILE` assignments, naming the real consumer

Follow the repo's existing convention (see e.g. `arcanum/_lib/spawn_issue_shell.sh`) of a standalone `# shellcheck disable=...` comment line directly above the flagged line. Use a second comment line (or extend the same one) to name the consumer, so a future reader doesn't have to re-derive this investigation.

For each file, insert immediately above the `LOCK_FILE=...` line:

1. `auto-fix-all/scripts/queue_common.sh:13`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh) in
   # queue_pop_shell.sh and queue_push_shell.sh, which source this file
   ```
2. `monitor-issues/scripts/config.sh:12`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh,
   # sourced above), called later in this file
   ```
3. `monitor-issues/scripts/monitor_issues.sh:34`
   ```
   # shellcheck disable=SC2034 -- read by _release_lock (lock.sh, sourced above)
   # via the "trap '_release_lock' EXIT" cleanup below
   ```
4. `monitor-issues/scripts/rewrite_queue.sh:36`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh,
   # sourced above), called later in this file
   ```
5. `arcanum/migrations/_ledger.sh:61`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh),
   # sourced by this function's caller ledger.sh alongside _ledger.sh
   ```
6. `arcanum/migrations/run.sh:194`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh,
   # sourced above), called later in this function
   ```
7. `arcanum/migrations/update_per_file.sh:239`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh,
   # sourced above), called later in this function
   ```
8. `arcanum/_lib/repo_config.sh:160`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh,
   # sourced above), called later in this function
   ```
9. `arcanum/_lib/global_config.sh:112`
   ```
   # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh,
   # sourced above), called later in this function
   ```
10. `arcanum/_lib/permission_grant_shell.sh:62`
    ```
    # shellcheck disable=SC2034 -- read by _acquire_lock/_release_lock (lock.sh,
    # sourced above), called later in this function
    ```

Do not touch the second SC2034 finding in `arcanum/migrations/run.sh` (`MIGRATIONS_SCRIPT_DIR`, a separate line) — that one belongs to sub-issue #474, not this one.

Line numbers will shift by however many comment lines are inserted above them on each file's *subsequent* edits within the same file — insert bottom-up per file, or simply re-check the line after each edit, to avoid off-by-N mistakes (only `repo_config.sh` has a single target line among the 3 `LOCK_FILE` occurrences in that file — the other two at lines 97 and 114 are outside this issue's scope and must be left untouched).

### Step 2 — Verify

- Run `shellcheck <file>` on each of the 10 files and confirm the `LOCK_FILE` SC2034 warning is gone (a `-- SC2034:LOCK_FILE was suppressed --` style note or simply its absence from output) while any *other*, unrelated warnings in that file (e.g. `run.sh`'s separate `MIGRATIONS_SCRIPT_DIR` SC2034) are unchanged.
- Confirm no other shellcheck findings were newly introduced (diff the warning list before/after per file).
- Confirm behavior is unchanged: these are comment-only additions, so no test run should be required, but re-run each skill's existing spec/test suite if one directly exercises these scripts (e.g. `monitor-issues`, `auto-fix-all` bash specs) as a sanity check.

## Files to Change

- `auto-fix-all/scripts/queue_common.sh` — suppress SC2034 on line 13, naming `queue_pop_shell.sh`/`queue_push_shell.sh` as consumers.
- `monitor-issues/scripts/config.sh` — suppress SC2034 on line 12, naming `_acquire_lock`/`_release_lock`.
- `monitor-issues/scripts/monitor_issues.sh` — suppress SC2034 on line 34, naming `_release_lock` (EXIT trap).
- `monitor-issues/scripts/rewrite_queue.sh` — suppress SC2034 on line 36, naming `_acquire_lock`/`_release_lock`.
- `arcanum/migrations/_ledger.sh` — suppress SC2034 on line 61, naming `_acquire_lock`/`_release_lock` (sourced by caller `ledger.sh`).
- `arcanum/migrations/run.sh` — suppress SC2034 on line 194 only (not the unrelated `MIGRATIONS_SCRIPT_DIR` finding), naming `_acquire_lock`/`_release_lock`.
- `arcanum/migrations/update_per_file.sh` — suppress SC2034 on line 239, naming `_acquire_lock`/`_release_lock`.
- `arcanum/_lib/repo_config.sh` — suppress SC2034 on line 160 only (not the two other `LOCK_FILE` occurrences at lines 97/114, out of scope), naming `_acquire_lock`/`_release_lock`.
- `arcanum/_lib/global_config.sh` — suppress SC2034 on line 112, naming `_acquire_lock`/`_release_lock`.
- `arcanum/_lib/permission_grant_shell.sh` — suppress SC2034 on line 62, naming `_acquire_lock`/`_release_lock`.

## Notes

- No file's `LOCK_FILE` assignment should be deleted — investigation for this plan found all 10 genuinely consumed (verified via `_acquire_lock`/`_release_lock` call sites and, for `queue_common.sh`, its actual callers). This contradicts the issue's premise that some might turn out to be dead; call this out explicitly in the PR description so reviewers aren't surprised zero deletions happened.
- No CI job runs ShellCheck/Codacy locally in `.circleci/config.yml` (Codacy runs server-side on push) and no `.shellcheckrc`/Codacy config exists in this repo to change shellcheck's cross-file behavior — so local verification is `shellcheck <file>` per file, and final confirmation of zero SC2034 findings happens via Codacy after the PR is pushed.
- `arcanum/_lib/repo_config.sh` has two other `LOCK_FILE` assignments (lines 97, 114) not listed in this issue — leave them untouched; they belong to a different scope (or were already excluded deliberately from the 24-finding sweep in #464).

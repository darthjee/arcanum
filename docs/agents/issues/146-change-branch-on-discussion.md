# Issue: Change branch on discussion

## Description
Across `enhance-issue`, `discuss-issue`, and `arcanum-split-issue`, the working tree is not moved off whatever branch it happens to be on before the skill starts, and is not moved back afterward. These skills run in a workspace where multiple agents share the same `.git` (and therefore the same set of local branches), which creates contention around per-issue branches (`issue-<id>`).

## Problem
- If the repo is already checked out on an `issue-<id>` branch (left over from a previous run) when one of these three skills starts, that branch stays checked out for as long as the skill runs — even though none of this work (fetching/discussing/splitting a GitHub issue) needs to happen on any particular branch. This blocks any other agent that wants to check out that same branch (e.g. to run `auto-fix-all` on that issue).
- `discuss-issue`'s "yes, plan it" path deliberately checks out `issue-<id>` (via `checkout_from_main.sh`) to commit the plan — but once that flow finishes, the skill leaves the repo sitting on that branch instead of releasing it, again blocking other agents from picking it up.

## Expected Behavior
- Before any of the three skills' Step 1 does its GitHub fetch, the working tree is moved to a configured "safe" branch (default `origin/main`), after a `git fetch -p`.
- At the true end of each skill's flow, the working tree is moved back to that same safe branch — a no-op for skills that never left it, and a real release step for `discuss-issue`'s planning path, which does leave it.
- The safe branch is configurable per repo, not hardcoded, so repos with a different default branch/remote naming can override it.
- Switching never discards work: if the working tree has uncommitted changes to tracked files, the switch hard-errors instead of silently stashing or discarding anything.
- Checking out the safe branch (e.g. `origin/main`) results in a detached HEAD — these skills never commit while parked there, so no local tracking branch is created or needed.

## Solution
**Shared lib**: a new dedicated file `arcanum/_lib/safe_branch.sh` holds the checkout-to-safe-branch helper(s), kept separate from `git_branch.sh`'s existing fetch/merge-main concern.

**Config key/shape**: namespaced under `.claude/state/arcanum-config.json`:
```json
{ "git": { "safe_branch": "origin/main" } }
```
Read/written via the existing `repo_config_read`/`repo_config_write` helpers in `arcanum/_lib/repo_config.sh` (namespace `"git"`, key `"safe_branch"`).

**Checkout semantics**: the helper runs a full `git fetch -p` (prune, all remote refs — not a narrow fetch of just the safe-branch ref) followed by `git checkout <configured_ref>` (e.g. `origin/main`). This intentionally lands on a detached HEAD, not a local tracking branch — these skills never commit while parked on the safe branch, so there's no need for local-branch bookkeeping, and the full prune has the side benefit of clearing out stale remote-tracking refs for deleted `issue-<id>` branches.

**Integration points**:
- `enhance-issue`: checkout-to-safe-branch before `fetch.md`'s `resolve_and_fetch.sh` call, and again at the very end of `publish.md` (defensive — this skill never checks out `issue-<id>` itself today, so the closing call is a no-op safety net for future changes/pre-existing dirty state).
- `discuss-issue`: checkout-to-safe-branch before `extract_id_and_name.md`'s `resolve_and_fetch.sh` call, and again after `discuss_and_save.md`'s step 8 fully finishes — the only one of the three skills whose "yes, plan it" path lands on `issue-<id>` (via `checkout_from_main.sh`). The "no" path never touches `issue-<id>`, so the closing call there is also a no-op safety net.
- `arcanum-split-issue`: checkout-to-safe-branch before `fetch.md`'s `resolve_and_fetch.sh` call, and again at the end of `finish.sh`.

**Dirty working tree**: the helper hard-errors (clear message, non-zero exit) instead of stashing/discarding — never risks losing someone's in-progress uncommitted work. Scoped to actual uncommitted *changes* to tracked files (`git diff --quiet` / `git diff --cached --quiet`), not the mere presence of untracked files — untracked files do not block a branch checkout and carry over harmlessly, so they must not trip this check. The calling skill surfaces the error to the user rather than proceeding silently.

**Migration**:
- Manifest entry type `"script"` (not `"instructions"`) — a plain `NNN.sh` implementing the standard `config`/`run` contract, same as migration 001. No AI hand-off needed for a single config value.
- `run` resolves a default guess (first `git remote` name, falling back to `origin`; branch `main`, i.e. `<remote>/main`), then probes `/dev/tty` the same way `update_per_file.sh` already does (`exec 3</dev/tty`):
  - **TTY available** — prints the guessed default and prompts for one of: confirm the guess / type a preferred branch / skip.
    - Confirm → `repo_config_write` sets `git.safe_branch` to the guessed default.
    - Type → `repo_config_write` sets `git.safe_branch` to the typed value.
    - Skip → nothing is written; the key stays unset, and `safe_branch.sh`'s own hardcoded fallback (`origin/main`) applies at use-time. The migration still completes successfully (skipping here means "opt out of customizing," not "opt out of the migration").
  - **No TTY available** (e.g. automated/CI-style runs) — silently writes the guessed default, no prompt. No contract change to `update_per_file.sh`/`run.sh` is needed for this — the script infers non-interactivity itself from TTY absence, the same signal `update_per_file.sh` already relies on elsewhere, rather than requiring `--no-confirm` to be threaded through as an explicit arg.
- Idempotent: safe to re-run — re-prompts (or re-applies the default) each time, same as any other config-writing migration.

## Benefits
- Frees up per-issue branches for other agents sharing the same `.git` as soon as they're no longer actively needed, unblocking parallel `auto-fix-all`/`auto-fix-issue` runs in shared workspaces.
- Leaves the working tree in a predictable, known state (the safe branch) after any of these three skills finish, rather than wherever the last operation happened to leave it.
- Configurable default means this adapts to repos that do not use `main` as their default branch or `origin` as their remote name.

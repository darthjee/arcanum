# Plan: Thread explicit REPO_PATH through cross-skill scripts instead of relying on ambient bash cwd

Issue: [134-thread-explicit-repo-path-through-cross-skill-scripts-instead-of-relying-on-ambient-bash-cwd.md](../issues/134-thread-explicit-repo-path-through-cross-skill-scripts-instead-of-relying-on-ambient-bash-cwd.md)

## Overview

Every cross-skill script that mutates git state (add/commit/checkout/merge/push/fetch/rm/branch) currently trusts the Bash tool's ambient cwd instead of an explicit repo path, unlike the GitHub-API scripts (`github.sh`, `resolve_and_fetch.sh`) which already require `repo_path` as a leading argument. This plan adds a shared validate-and-`cd` helper in `arcanum/_lib/`, threads a required `REPO_PATH` leading positional argument through every in-scope script (new argument where none exists yet, or a `cd`-in where `repo_path` is already present for API calls but git ops still leak to cwd), fixes the bare `git`/relative-path calls embedded directly in `steps/*.md` prose, updates every caller, and documents the extended convention in `docs/agents/architecture.md`/`AGENTS.md`. Ships as a single PR, no transition period.

## Context

A `discuss-issue` run on #131 committed and pushed directly onto the wrong repo's `main` because the agent's Bash cwd had drifted into a secondary clone of arcanum via `cd .../scripts && ./script.sh`, and none of the git-mutating scripts had a way to detect or reject that. #131 already fixed the GitHub-repo-*resolution* half of this pattern (`github.sh`, `resolve_and_fetch.sh`) and gave `arcanum-migrate` its own `--repo <path>` flag (a distinct, narrower convention for that skill's directly-terminal-invocable master script — not reused here). This issue closes the remaining gap: the scripts and inline instructions that actually run `git`.

The scope was produced by an audit (`grep -rlE "git (add|commit|checkout|merge|push|fetch|rm|branch)" --include="*.sh" .` over the skills tree, plus a manual grep over `steps/*.md`/`SKILL.md` for inline `` `git `` usage), not a pre-existing fixed list — the issue's own list went stale once during triage.

## Implementation Steps

### Step 1 — Add a shared repo-path validation/cd helper

Create `arcanum/_lib/repo_path.sh` (sourced, not executed), with one function:

```bash
# repo_path_enter <repo_path>
#   Validates <repo_path> exists and is a git repo (or worktree), then cd's
#   into it. Fails loudly (message to stderr, exit 1) instead of silently
#   operating elsewhere.
repo_path_enter() {
  local repo_path="${1:-}"
  [[ -n "$repo_path" ]] || { echo "Error: repo_path is required" >&2; exit 1; }
  [[ -d "$repo_path" ]] || { echo "Error: not a directory: $repo_path" >&2; exit 1; }
  git -C "$repo_path" rev-parse --git-dir >/dev/null 2>&1 || {
    echo "Error: not a git repository: $repo_path" >&2; exit 1
  }
  cd "$repo_path"
}
```

Using `cd` once at the top of each script (rather than prefixing every individual `git` call with `-C "$REPO_PATH"`) means the already-sourced helpers in `arcanum/_lib/push.sh` (`push_current_branch`) and `arcanum/_lib/git_branch.sh` (`git_branch_fetch_main`, `git_branch_merge_main`) keep working unchanged — they inherit the corrected cwd. No signature changes needed in those two files.

### Step 2 — Add `REPO_PATH` to scripts that don't take it at all today

For each script below, add `REPO_PATH` as a **new, required, leading** positional argument (shifting existing positional args by one), source `repo_path.sh`, and call `repo_path_enter "$REPO_PATH"` immediately after argument parsing/validation, before any `git` call:

- `auto-fix-all/scripts/checkout_from_main.sh` — new usage: `checkout_from_main.sh <repo_path> <id>`
- `auto-fix-all/scripts/cleanup_artifacts.sh` — new usage: `cleanup_artifacts.sh <repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>`
- `auto-new-issue/scripts/commit_issue.sh` — new usage: `commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>`
- `auto-fix-issue/scripts/commit_change.sh` — new usage: `commit_change.sh <repo_path> <type> <scope> <id> <subject> <agent> <model_name> <model_email> [body] [comment_url]`
- `auto-fix-issue/scripts/create_branch.sh` — new usage: `create_branch.sh <repo_path> <plan_dir> <id>`
- `auto-plan-issue/scripts/commit_plan.sh` — new usage: `commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>`

`create_branch.sh` also reads `<plan_dir>/plan.md`, which is passed as a caller-relative path — once `repo_path_enter` runs, callers must pass `plan_dir` relative to `REPO_PATH` (unchanged behavior in practice, since callers already build these paths from `REPO_PATH`).

### Step 3 — Fix scripts that already take `repo_path` for API calls but leak git ops to ambient cwd

These already require `repo_path` as a positional argument (used today only to resolve the GitHub repo/domain) — no signature change, just add `repo_path_enter "$repo_path"` right after the existing usage/validation check, before the first `git` call:

- `auto-fix-all/scripts/wait_ci.sh` — `git branch --show-current` (line ~186)
- `auto-fix-all/scripts/github.sh` — `cmd_cleanup_branch`'s `git push --delete`/`checkout main`/`reset --hard`/`branch -D`, plus the `git branch --show-current` calls in `cmd_pr_number`/`cmd_pr_state`/`cmd_pr_merge` (these don't mutate git state directly, but must still resolve the branch name from the right checkout)
- `auto-fix-issue/scripts/github.sh` — the `git branch --show-current` calls in `_current_issue_id`/`cmd_pr_view`/`cmd_pr_ready` (called from every `cmd_*`, which already receives `repo_path`)
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — `git branch --show-current`

For the two `github.sh` dispatcher scripts, add the `repo_path_enter` call once, centrally, right after the `case` statement dispatches to a `cmd_*` function that receives `repo_path` as its first argument — not duplicated in every `cmd_*` body.

### Step 4 — Update every `steps/*.md`/`SKILL.md` caller

Update every call site of the scripts touched in Steps 2–3 to pass `"$REPO_PATH"` as the (new, where applicable) leading argument:

- `auto-fix-all/steps/handle_comment.md`
- `auto-fix-all/steps/process_one_issue.md`
- `auto-fix-all/SKILL.md` (the closed-PR reimplement path calling `cleanup-branch`)
- `auto-fix-issue/steps/dispatch_agents.md`
- `auto-fix-issue/steps/review_and_redispatch.md`
- `auto-fix-issue/steps/run.md`
- `auto-monitor-issue-pr/steps/run.md`
- `auto-new-issue/steps/commit_and_sync.md`
- `auto-plan-issue/steps/run.md`
- `discuss-issue/steps/discuss_and_save.md`

### Step 5 — Fix bare `git` commands embedded directly in `steps/*.md` prose

`discuss-issue/steps/discuss_and_save.md` step 8 issues `git add`/`git commit` (conflict-resolution path) and a bare `git push` (pushing the plan commit) directly, with no repo scoping. Rewrite these instructions to explicitly operate against `$REPO_PATH`, e.g. `git -C "$REPO_PATH" add <paths> && git -C "$REPO_PATH" commit --no-edit` and `git -C "$REPO_PATH" push`. (Using `-C` here rather than `cd`, since this is inline prose the architect executes directly, not a script that can `cd` once at the top.)

### Step 6 — Fix relative output-path handling in `render_issue.sh` callers

`discuss-issue/scripts/render_issue.sh` itself has no `cd`/ambient-cwd dependency (it just writes to `$OUTPUT_FILE`), but its documented usage in `discuss-issue/steps/issue_template.md` is called with `FILE` — a path already relative to `REPO_PATH` (e.g. `docs/agents/issues/134-....md`, as returned by `resolve_and_fetch.sh`). If the architect's cwd has drifted, that write silently lands in the wrong place. Fix at the call-site documentation level (no script change needed): update `issue_template.md` and `discuss_and_save.md` to require `<output_file>` be passed as `"$REPO_PATH/$FILE"` (absolute), not the bare relative `$FILE`.

### Step 7 — Update convention documentation

Extend `docs/agents/architecture.md`'s existing "Repo Path Threading" section (currently scoped to scripts that resolve the GitHub repo) to state explicitly that the same required-leading-positional-argument convention applies to any script performing local git mutations, and that `arcanum-migrate`'s optional `--repo <path>` flag (from #131) is a separate, narrower pattern for directly-terminal-invocable master scripts, not a general alternative. Update `AGENTS.md` if it references this convention directly (it currently just points at architecture.md's "Repo Path Threading"/"Per-Repo Migrations" sections, which may not need a wording change beyond what architecture.md already says).

### Step 8 — Delegate and verify

All script edits (Steps 1–3) are implemented by the `scripter` agent, per this repo's standing convention — not written inline in `SKILL.md`/`steps/*.md`. Step 4–7 (steps/*.md callers, prose fixes, docs) are architect-level changes. Manually verify per the issue's testing strategy: point the agent's Bash cwd at a secondary clone of this repo sharing the same `origin`, run an affected flow (e.g. `checkout_from_main.sh "$REPO_PATH" <id>`), and confirm it operates against `REPO_PATH`, not the clone at cwd.

## Files to Change

- `arcanum/_lib/repo_path.sh` — **new file**, `repo_path_enter` helper (Step 1)
- `auto-fix-all/scripts/checkout_from_main.sh` — add `REPO_PATH` leading arg (Step 2)
- `auto-fix-all/scripts/cleanup_artifacts.sh` — add `REPO_PATH` leading arg (Step 2)
- `auto-new-issue/scripts/commit_issue.sh` — add `REPO_PATH` leading arg (Step 2)
- `auto-fix-issue/scripts/commit_change.sh` — add `REPO_PATH` leading arg (Step 2)
- `auto-fix-issue/scripts/create_branch.sh` — add `REPO_PATH` leading arg (Step 2)
- `auto-plan-issue/scripts/commit_plan.sh` — add `REPO_PATH` leading arg (Step 2)
- `auto-fix-all/scripts/wait_ci.sh` — add `repo_path_enter` call (Step 3)
- `auto-fix-all/scripts/github.sh` — add `repo_path_enter` call (Step 3)
- `auto-fix-issue/scripts/github.sh` — add `repo_path_enter` call (Step 3)
- `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — add `repo_path_enter` call (Step 3)
- `auto-fix-all/steps/handle_comment.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `auto-fix-all/steps/process_one_issue.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `auto-fix-all/SKILL.md` — pass `"$REPO_PATH"` to `cleanup-branch` (Step 4)
- `auto-fix-issue/steps/dispatch_agents.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `auto-fix-issue/steps/review_and_redispatch.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `auto-fix-issue/steps/run.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `auto-monitor-issue-pr/steps/run.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `auto-new-issue/steps/commit_and_sync.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `auto-plan-issue/steps/run.md` — pass `"$REPO_PATH"` to updated call sites (Step 4)
- `discuss-issue/steps/discuss_and_save.md` — pass `"$REPO_PATH"` to updated call sites, and fix bare `git add`/`git commit`/`git push` in step 8 (Steps 4–5)
- `discuss-issue/steps/issue_template.md` — document `<output_file>` as absolute, built from `REPO_PATH` (Step 6)
- `docs/agents/architecture.md` — extend "Repo Path Threading" section (Step 7)
- `AGENTS.md` — update only if it needs to reflect the extended convention beyond its existing pointer to architecture.md (Step 7)

## Notes

- `enhance-issue`'s copy of `github.sh` (a thin wrapper, same as `discuss-issue`'s) is already covered — both delegate to `arcanum/_lib/github_issue.sh`, which does not perform local git mutations (only GitHub API calls via `origin.sh`), so it's out of scope for this issue.
- `arcanum/update/bootstrap.sh` is explicitly out of scope (arcanum install's own location, not a target project repo — see issue).
- `discuss-issue/scripts/resolve_id_and_file.sh` (and its `arcanum/_lib/resolve_id_and_file.sh` target) has a related but distinct ambient-cwd bug — it resolves the issues folder relative to cwd rather than `REPO_PATH`, with no git operations involved. Encountered firsthand while enhancing/discussing this very issue. Out of scope here (issue #134 is scoped to git-mutating scripts specifically); worth a follow-up issue.
- No migration entry under `arcanum/migrations/repos/<version>/` is needed — this changes only script/skill-internal behavior invoked by the agent, not a config file shape or artifact stored in consuming repos (consistent with #131's fix, which also added no migration).

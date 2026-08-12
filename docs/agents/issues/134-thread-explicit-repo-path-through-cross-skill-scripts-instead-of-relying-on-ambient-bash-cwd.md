# Thread explicit REPO_PATH through cross-skill scripts instead of relying on ambient bash cwd

## Context

Several cross-skill scripts under `<skill>/scripts/` (e.g. `checkout_from_main.sh`, `commit_issue.sh`, `commit_change.sh`, `create_branch.sh`, `commit_plan.sh`) perform git operations (`git add`, `git commit`, `git checkout`, `git merge`, `git push`, `git fetch`) directly against the Bash tool's ambient current working directory, instead of taking an explicit repo path argument. This is inconsistent with scripts that resolve the GitHub repo/domain (`github.sh`, `resolve_and_fetch.sh`), which already take `REPO_PATH` explicitly as their leading argument — a convention introduced specifically so callers never need to rely on `pwd`/ambient cwd.

This inconsistency became a concrete bug during a `discuss-issue` run on issue #131: `render_issue.sh` was invoked via `cd .../scripts && ./render_issue.sh`, leaving the agent's Bash tool cwd inside a secondary local clone of arcanum (the git-clone skill install under `~/.claude*/skills`, which shares the same `origin` as the primary repo). `checkout_from_main.sh 131` then silently created branch `issue-131` in that secondary clone instead of the primary repo, and the subsequent `commit_issue.sh` call committed and pushed the issue file directly onto `main` in the primary repo instead of onto the intended feature branch — because none of these scripts had any way to detect or reject operating against the wrong checkout.

Issue #131 already covers the same root-cause pattern (ambient cwd vs. explicit repo-path argument) for `arcanum-migrate`'s script chain; this issue addresses the same pattern for the `auto-new-issue` / `auto-fix-all` / `auto-fix-issue` / `auto-plan-issue` script chains.

## What needs to be done

- Add an explicit `REPO_PATH` (or `--repo <path>`, kept consistent with whatever convention issue #131 settles on) leading argument to every cross-skill script that performs git operations (`git add`, `commit`, `checkout`, `merge`, `push`, `fetch`) and currently assumes cwd is already the target repo, including at least:
  - `auto-fix-all/scripts/checkout_from_main.sh`
  - `auto-fix-all/scripts/cleanup_artifacts.sh`
  - `auto-fix-all/scripts/wait_ci.sh` (audit for git ops beyond any `REPO_PATH` it may already take)
  - `auto-new-issue/scripts/commit_issue.sh`
  - `auto-fix-issue/scripts/commit_change.sh`
  - `auto-fix-issue/scripts/create_branch.sh`
  - `auto-plan-issue/scripts/commit_plan.sh`
  - `auto-monitor-issue-pr/scripts/resolve_pr_number.sh`
  - Any shared `arcanum/_lib/` helpers these scripts source that issue raw `git` commands (`_lib/push.sh`, `_lib/git_branch.sh`), so the repo context is threaded down consistently instead of each script re-deriving it from cwd.
- Each script should scope its git invocations to the given `REPO_PATH` (e.g. `cd "$REPO_PATH"` up front, or `git -C "$REPO_PATH"`), and validate the path exists and is a git repo, failing loudly instead of silently operating elsewhere.
- Update every `steps/*.md` file that calls these scripts to pass `"$REPO_PATH"` as the leading argument, mirroring the existing convention already documented for `github.sh`/`resolve_and_fetch.sh` calls (see `auto-new-issue/steps/run.md` and `auto-fix-all/steps/process_one_issue.md`).
- Audit `render_issue.sh` and any other script whose output-path argument is relative: either require callers to always pass absolute paths, or resolve relative paths against `REPO_PATH` explicitly, and document which.
- Delegate the actual script implementation changes to the `scripter` agent, per this repo's standing convention — do not implement the logic directly in `SKILL.md`/step files.
- Update `docs/agents/architecture.md` (and `AGENTS.md` if relevant) to document "every script that touches the target repo's git state takes an explicit repo-path argument — never relies on ambient cwd" as a general convention, cross-referencing issue #131's `--repo` convention for consistency.

## Acceptance criteria

- [ ] `checkout_from_main.sh`, `commit_issue.sh`, `commit_change.sh`, `create_branch.sh`, `commit_plan.sh`, and any other cross-skill script performing git operations take an explicit repo path argument and operate against it regardless of the Bash tool's ambient cwd.
- [ ] All `steps/*.md` callers of these scripts pass `"$REPO_PATH"` explicitly, consistent with the existing `github.sh`/`resolve_and_fetch.sh` convention.
- [ ] Running the affected skills with the agent's Bash cwd pointed at an unrelated clone of the same repo (e.g. a secondary skills-install clone sharing `origin`) still operates correctly against the intended `REPO_PATH`, not the clone at cwd.
- [ ] `docs/agents/architecture.md` documents the "explicit repo-path argument, never ambient cwd" convention for scripts that mutate git state.
- [ ] Script implementation changes are delegated to and authored by the `scripter` agent.

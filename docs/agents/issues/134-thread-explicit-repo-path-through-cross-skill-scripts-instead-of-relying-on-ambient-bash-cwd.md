# Issue: Thread explicit REPO_PATH through cross-skill scripts instead of relying on ambient bash cwd

## Context

Several cross-skill scripts under `<skill>/scripts/` (e.g. `checkout_from_main.sh`, `commit_issue.sh`, `commit_change.sh`, `create_branch.sh`, `commit_plan.sh`) perform git operations (`git add`, `git commit`, `git checkout`, `git merge`, `git push`, `git fetch`) directly against the Bash tool's ambient current working directory, instead of taking an explicit repo path argument. This is inconsistent with scripts that resolve the GitHub repo/domain (`github.sh`, `resolve_and_fetch.sh`), which already take `REPO_PATH` explicitly as their leading argument — a convention introduced specifically so callers never need to rely on `pwd`/ambient cwd.

This inconsistency became a concrete bug during a `discuss-issue` run on issue #131: `render_issue.sh` was invoked via `cd .../scripts && ./render_issue.sh`, leaving the agent's Bash tool cwd inside a secondary local clone of arcanum (the git-clone skill install under `~/.claude*/skills`, which shares the same `origin` as the primary repo). `checkout_from_main.sh 131` then silently created branch `issue-131` in that secondary clone instead of the primary repo, and the subsequent `commit_issue.sh` call committed and pushed the issue file directly onto `main` in the primary repo instead of onto the intended feature branch — because none of these scripts had any way to detect or reject operating against the wrong checkout.

Issue #131 already covers the same root-cause pattern (ambient cwd vs. explicit repo-path argument) for `arcanum-migrate`'s script chain; this issue addresses the same pattern for the `auto-new-issue` / `auto-fix-all` / `auto-fix-issue` / `auto-plan-issue` script chains.

## What needs to be done

- Add an explicit `REPO_PATH` leading positional argument (required — matching the existing "Repo Path Threading" convention in `docs/agents/architecture.md`, already used by `github.sh`/`resolve_and_fetch.sh`/`resolve_pr_number.sh`/`wait_ci.sh` for GitHub-repo resolution; *not* the optional `--repo <path>` flag issue #131 introduced, which is specific to `arcanum-migrate`'s directly-terminal-invocable master script) to every cross-skill script that performs git operations (`git add`, `commit`, `checkout`, `merge`, `push`, `fetch`, `rm`, `branch`) and currently assumes cwd is already the target repo.
- **Scope discovery is an audit, not a fixed list** — the list below is a known floor, not a ceiling; it already went stale once during triage (two more offenders turned up by a single grep pass). Before implementing, run something equivalent to:
  ```
  grep -rlE "git (add|commit|checkout|merge|push|fetch|rm|branch)" --include="*.sh" .
  ```
  over the skills tree, then for each hit confirm whether its git invocations are already scoped to an explicit repo path (`-C "$REPO_PATH"` / a `cd "$REPO_PATH"` guarded by validation) — if not, it's in scope for this issue.
  - Known offenders as of this writing (non-exhaustive):
    - `auto-fix-all/scripts/checkout_from_main.sh`
    - `auto-fix-all/scripts/cleanup_artifacts.sh`
    - `auto-fix-all/scripts/wait_ci.sh` — already takes `REPO_PATH` for GitHub API resolution, but its `git branch --show-current` call still reads ambient cwd
    - `auto-fix-all/scripts/github.sh` — the `cleanup-branch` subcommand (`git push --delete`, `checkout main`, `branch -D`) reads ambient cwd despite the script already taking `repo_path` for API calls
    - `auto-new-issue/scripts/commit_issue.sh`
    - `auto-fix-issue/scripts/commit_change.sh`
    - `auto-fix-issue/scripts/create_branch.sh`
    - `auto-fix-issue/scripts/github.sh` — multiple `git branch --show-current` calls read ambient cwd despite the script already taking `repo_path` for API calls
    - `auto-plan-issue/scripts/commit_plan.sh`
    - `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` — same `REPO_PATH`-for-API-but-not-for-git-ops gap as `wait_ci.sh`
    - Any shared `arcanum/_lib/` helpers these scripts source that issue raw `git` commands (`_lib/push.sh`, `_lib/git_branch.sh`), so the repo context is threaded down consistently instead of each script re-deriving it from cwd.
  - **Explicitly out of scope:** `arcanum/update/bootstrap.sh`. It runs `git fetch`/`git checkout` too, but against the arcanum *install's own* location (self-derived via `BASH_SOURCE`), not a target project repo — a different "repo path" concept, already excluded from #131 for the same reason.
- The same vulnerability also shows up as **bare `git` commands issued directly in `steps/*.md` prose**, not just inside wrapped scripts — these need the same fix (route through a repo-scoped script, or explicitly `cd "$REPO_PATH"`/`git -C "$REPO_PATH"` at the call site). Known offender: `discuss-issue/steps/discuss_and_save.md` step 8 — `git add`/`git commit` (conflict-resolution path) and a bare `git push` (pushing the plan commit) both run against whatever the architect's ambient cwd happens to be at that point in the flow, with no `REPO_PATH` scoping. Since this is prose instructions rather than a script, the audit grep above won't catch it — search `steps/*.md` files for inline `` `git `` usage separately.
- Each in-scope script should scope its git invocations to the given `REPO_PATH` (e.g. `cd "$REPO_PATH"` up front, or `git -C "$REPO_PATH"`), and validate the path exists and is a git repo, failing loudly instead of silently operating elsewhere.
- Update every `steps/*.md` file that calls these scripts to pass `"$REPO_PATH"` as the leading argument, mirroring the existing convention already documented for `github.sh`/`resolve_and_fetch.sh` calls (see `auto-new-issue/steps/run.md` and `auto-fix-all/steps/process_one_issue.md`).
- Audit `render_issue.sh` and any other script whose output-path argument is relative: either require callers to always pass absolute paths, or resolve relative paths against `REPO_PATH` explicitly, and document which.
- Delegate the actual script implementation changes to the `scripter` agent, per this repo's standing convention — do not implement the logic directly in `SKILL.md`/step files.
- Update `docs/agents/architecture.md` (and `AGENTS.md` if relevant) to extend the existing "Repo Path Threading" section's required-leading-positional-argument convention to git-mutating scripts, not just GitHub-repo-resolving ones — noting that #131's optional `--repo <path>` flag is a distinct, narrower pattern reserved for directly-terminal-invocable master scripts like `arcanum-migrate`'s, not a general alternative.

## Backward compatibility

No transition period or fallback: `REPO_PATH` is added as a required leading positional argument with no default and no cwd fallback, matching every other script that already takes it (`github.sh`, `resolve_and_fetch.sh`, `wait_ci.sh`, `resolve_pr_number.sh` today). This is a breaking CLI change for each in-scope script, so it must land as a **single PR** that changes the scripts and every calling `steps/*.md` file together — never a partial rollout where some callers pass `REPO_PATH` and others still rely on ambient cwd, which would silently reintroduce the exact bug this issue fixes for whichever call sites lag behind.

## Testing strategy

Manual verification, matching how the rest of this skill-authoring repo is checked today (no existing automated harness covers the `auto-*` skill chains): for each in-scope script/skill, point the agent's Bash cwd at a secondary clone of this repo sharing the same `origin` (reproducing the exact #131 conditions), run the affected flow, and confirm it operates against the passed `REPO_PATH` rather than the clone at cwd. This is what acceptance criterion #3 already captures.

## Acceptance criteria

- [ ] `checkout_from_main.sh`, `commit_issue.sh`, `commit_change.sh`, `create_branch.sh`, `commit_plan.sh`, and any other cross-skill script performing git operations take an explicit repo path argument and operate against it regardless of the Bash tool's ambient cwd.
- [ ] All `steps/*.md` callers of these scripts pass `"$REPO_PATH"` explicitly, consistent with the existing `github.sh`/`resolve_and_fetch.sh` convention.
- [ ] Running the affected skills with the agent's Bash cwd pointed at an unrelated clone of the same repo (e.g. a secondary skills-install clone sharing `origin`) still operates correctly against the intended `REPO_PATH`, not the clone at cwd.
- [ ] `docs/agents/architecture.md` documents the "explicit repo-path argument, never ambient cwd" convention for scripts that mutate git state.
- [ ] Script implementation changes are delegated to and authored by the `scripter` agent.
- [ ] All in-scope scripts and their `steps/*.md` callers land in a single PR, with no script left accepting an ambient-cwd fallback at any point in the rollout.
- [ ] Bare `git` commands embedded directly in `steps/*.md` prose (e.g. `discuss-issue/steps/discuss_and_save.md` step 8's `git add`/`git commit`/`git push`) are scoped to `REPO_PATH` too, not just calls into wrapped scripts.

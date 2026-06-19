# Use single script command for Wait for CI

## Context

In `auto-fix-all/steps/monitor_pr.md`, the "approved" branch resolves the PR number via `scripts/github.sh pr-number` and then calls `scripts/wait_ci.sh <pr_number>` separately. This mirrors the same kind of multi-step resolution already consolidated into `monitor_pr.sh` for issue #5.

## What needs to be done

- Update `auto-fix-all/scripts/wait_ci.sh` to resolve the PR number for the current branch internally (same pattern as `github.sh pr-number`: `git branch --show-current` + `gh pr view -R <repo_ref> <branch> --json number -q '.number'`), removing the `<pr_number>` positional argument entirely — the only caller is `monitor_pr.md`'s "approved" branch, which always runs on the issue's branch with an existing PR, so no other call site needs the explicit-argument form.
- Update `auto-fix-all/steps/monitor_pr.md`'s "approved" branch to call `scripts/wait_ci.sh` directly (no arguments), dropping the separate `scripts/github.sh pr-number` call. Update both places that reference `wait_ci.sh` in that file (the initial call and the "re-check" loop-back reference).

## Acceptance criteria

- [ ] `scripts/wait_ci.sh` (no arguments) resolves the current branch's PR number internally and waits for CI exactly as the old `<pr_number>` form did (same `passed`/`failed` output contract).
- [ ] `auto-fix-all/steps/monitor_pr.md` no longer calls `scripts/github.sh pr-number` before `wait_ci.sh`.

---
See issue for details: https://github.com/darthjee/arcanum/issues/12

---

tags: :shipit:

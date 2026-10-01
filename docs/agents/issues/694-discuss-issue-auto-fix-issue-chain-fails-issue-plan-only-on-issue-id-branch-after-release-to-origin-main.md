# Issue: discuss-issue → auto-fix-issue chain fails: issue/plan only on issue-<id> branch after release to origin/main

## Description
When `/discuss-issue` chains into `/auto-fix-issue` (answering **Yes** to planning and then **Yes** to implementation), `/auto-fix-issue` fails right away at Step 1:

```text
== auto-fix-issue: FAILED ==
resolve_plan_paths.sh failed: no issue file found for #291 in docs/agents/issues.
```

Observed on darthjee/tingle#291.

The same failure affects every top-level (non-nested) entry into `/auto-fix-issue`, not only the `discuss-issue` chain:

- `plan-issue` → **Yes** to `/auto-fix-issue <id>` (`plan-issue/steps/write_and_confirm.md`, "Release the working tree" then "Next step: auto-fix-issue").
- A standalone `/auto-fix-issue <id>` run from the safe branch (`origin/main`), which is where every interactive skill leaves the working tree.

Only `auto-fix-all` works, because its `process_one_issue.md` step 1 runs `checkout_from_main.sh` before it nests into `auto-fix-issue/steps/run.md`.

## Problem
- `discuss-issue` (step 8, "plan it" path) and `plan-issue` ("Commit and publish the plan") commit the issue file and the plan **only on branch `issue-<id>`**.
- Both then run `checkout_safe_branch.sh`, which moves the working tree back to `origin/main` (detached). On `origin/main`, neither the issue file nor the plan exists.
- Both then offer to chain into `/auto-fix-issue <id>`. Its Step 1 runs `resolve_plan_paths.sh` against the current working tree **before** its Step 2 (`create_branch.sh`) checks out `issue-<id>`. So it finds no issue file and fails.
- There is also a chicken-and-egg problem: `create_branch.sh` reads the branch name from `## Branch` in `plan.md`, but `plan.md` only exists on that branch. No plan in `docs/agents/plans` uses `## Branch`, so the branch is always `issue-<id>` in practice.

## Expected Behavior
`/auto-fix-issue <id>` finds the issue and plan whether it is chained from `discuss-issue` or `plan-issue`, or run standalone from the safe branch. It then implements the issue without manual steps.

## Solution
Fix this in `auto-fix-issue`, not in each caller. That covers every entry point at once:

- **Bootstrap the branch first.** Before resolving the issue or plan, run `auto-fix-all/scripts/checkout_from_main.sh "$REPO_PATH" <id>`, the same call `auto-fix-all` already makes. It fetches `origin`, reuses `issue-<id>` locally or remotely (or creates it from `origin/main`), and merges `origin/main` into it. It is idempotent, so the nested `auto-fix-all` path is unaffected. Handle `STATUS=conflict` the same way `auto-fix-all` does: dispatch the responsible specialist(s), then `git -C "$REPO_PATH" add` and `commit`.
- **Then locate the issue and plan.** Run `resolve_plan_paths.sh` on the checked-out branch. The existing `PLAN_EXISTS=false` failure stays as it is.
- **Replace the old Step 2.** `checkout_from_main.sh` takes over from `create_branch.sh` + `merge_main.sh`. Drop both from the skill flow, along with the `## Branch` override in `plan.md`, which no plan uses. The branch is always `issue-<id>`.
- **Update resume state.** Re-map the Step 0 resume table (`plan_located` / `branch_created`) to the new step order, so a resumed run never resolves paths before the branch is checked out. Update any docs that describe the old Step 2, e.g. `docs/agents/architecture/` references to `create_branch.sh`.
- **Leave the callers as they are.** `discuss-issue` and `plan-issue` keep releasing the working tree to the safe branch before the chain, so no skill depends on another leaving the tree on a particular branch.

### Out of scope
- Deleting the `create_branch.sh` / `create_branch_shell.sh` scripts and their native counterpart. Decide this during planning: remove them if nothing else references them, otherwise leave them.

### Workaround (until fixed)
Run `git checkout issue-<id>` manually, then run `/auto-fix-issue <id>` again.

## Benefits
- The discuss-issue → plan → implement and plan-issue → implement chains work end to end.
- Standalone `/auto-fix-issue <id>` works from any branch, matching how `auto-fix-all` already bootstraps.
- There is one branch-bootstrap path (`checkout_from_main.sh`) instead of two that differ.

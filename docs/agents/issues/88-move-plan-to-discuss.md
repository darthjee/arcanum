# Issue: Move plan to discuss

## Description
`discuss-issue` currently rewrites and pushes an existing GitHub issue but never creates or commits anything to a git branch. Between finishing a discussion and executing the plan, the discussed context has to be reloaded from scratch by `auto-plan-issue` (via `auto-fix-issue`), and `auto-fix-all`'s branch bootstrap (`checkout_from_main.sh`) always deletes and recreates the issue branch — which would also discard any branch state prepared earlier by `discuss-issue`.

## Problem
- No continuity between the issue discussion and the planning stage — discussed context is lost/re-derived instead of carried forward on the branch.
- `auto-fix-all`'s `checkout_from_main.sh` always deletes `issue-<id>` and recreates it from `main`, which would be destructive to any branch already prepared by an earlier stage (e.g. by `discuss-issue`).
- Confirmations inside `discuss-issue` rely on free-form natural-language recognition ("yes", "sim", "correct", ...) rather than a deterministic, script-driven prompt.

## Expected Behavior
- A user running `/discuss-issue` can, right after the issue is confirmed and pushed to GitHub, choose to kick off planning immediately instead of running `/plan-issue` or `/auto-plan-issue` separately afterward. When they do, the branch ends up with both the issue file and the plan committed and pushed to GitHub — planning never finishes without the plan being on the remote branch.
- Both confirmations (comprehension, and whether to plan) are driven by a script that takes the user's free-form reply and deterministically resolves it to yes/no, instead of the agent judging it itself.
- `discuss-issue` stops once planning is committed and pushed; it does not continue into implementation (`auto-fix-issue`) in the same run.
- `auto-fix-all` and `auto-fix-issue` no longer discard a branch that already has planning/discussion work committed to it — they detect and reuse it, brought up to date with `main`, instead of deleting it. If bringing it up to date produces a merge conflict, a specialist agent resolves it automatically, the same way CI failures are handled today — no user interaction.
- Implementation always starts from a branch that has been merged up to date with `main` before any agent is dispatched.

## Solution
- **`discuss-issue`**: convert both confirmations into script-driven y/n checks — the agent still asks in natural language and reads the user's free-form reply, then passes that raw reply into a script that deterministically normalizes it to yes/no and exits accordingly (moving the yes/sim/correct-style matching out of the agent's judgment and into a script).
  - **Comprehension confirmation** (replaces today's "Did I comprehend the issue?" step): `n` → loop back into the discussion flow (no push, no planning). `y` → push the issue to GitHub, then ask the second confirmation.
  - **Planning confirmation** (new, asked only after a successful push): `y` → run a script that fetches `origin`, creates/reuses branch `issue-<id>` (merging `origin/main` into it if it already exists locally or remotely, otherwise branching fresh from `origin/main`), commits the issue file into it, and pushes the branch — then call `auto-plan-issue`'s existing steps directly (as the architect, no separate agent spawn). `auto-plan-issue` commits the plan locally but does not push it, so `discuss-issue` pushes the branch again right after, guaranteeing the plan commit also lands on GitHub before finishing. Stop once planning is committed and pushed; do not continue into implementation (`auto-fix-issue`) in the same run. `n` → finish as today (issue pushed to GitHub, no branch/plan created).
- **`auto-fix-all`'s branch bootstrap** (currently `checkout_from_main.sh`): stop deleting `issue-<id>` unconditionally. Fetch `origin`, then:
  - branch exists locally or remotely → check it out and merge `origin/main` into it (`--no-edit`).
  - branch does not exist → create it fresh from `origin/main`.
  - merge conflict → dispatch the responsible specialist agent(s) (or the architect, if none seem responsible) to resolve it and commit, the same way CI failures are already handled, then continue — no user interaction.
- **`auto-fix-all`**: keep triggering `auto-plan-issue` only when no plan yet exists under `docs/agents/plans/<issue-id>*/` (the existing `PLAN_EXISTS` check in `resolve_plan_paths.sh` already covers this).
- **`auto-fix-issue`**: at the very start, before dispatching any specialist agents, fetch and merge `origin/main` into the current issue branch via `--no-edit`, in a dedicated script. A merge conflict here is handled the same way — dispatch an agent to resolve it and commit before continuing.

## Benefits
- Planning carries over directly from the discussion instead of being reloaded/re-derived from scratch by a fresh agent/context.
- No more destructive recreation of a branch that may already hold committed planning/discussion work.
- Implementation branches are guaranteed to start from up-to-date `main`, reducing stale-branch conflicts later in CI/review.

# Issue: Return to the safe branch whenever a run does not continue to the next step

## Description

Part of #900.

Rule: a skill that ends **without** chaining into a step that needs `issue-<id>` (the user declined the next-step offer, `next_step.auto` is off, the chain was skipped, …) must leave its work pushed and the working tree on the safe branch (`arcanum/_lib/checkout_safe_branch.sh`).

## Problem

discuss-issue's `CLEAR=true` hand-off stays on `issue-<id>` on purpose (`discuss-issue/steps/discuss_and_save.md`), so the top-level `auto-plan-issue`'s `auto_next.sh` branch check passes. The top-level `auto-plan-issue` then gets `CHAIN=no` (`REASON=config`) and ends on `issue-<id>` (`auto-plan-issue/steps/run.md`, Auto-next). Its "plan already exists" exit has the same problem.

On top of that, top-level `auto-plan-issue` changes no labels and only pushes the plan when `auto_next.sh` chains — the "Known gap" in `docs/agents/architecture/skill-finish.md#clearing`. The issue stays `Refined` and the plan commit may sit unpushed on a branch that nobody releases.

## Expected Behavior

Top-level `auto-plan-issue` (both the Step 6 exit and the "plan already exists" exit):

- **Every exit with HEAD on `issue-<id>`**: push the plan and mark the issue `Ready` (`Refined` → `Ready`), whether or not it chains.
- **`CHAIN=yes`**: stay on `issue-<id>`.
- **`CHAIN=no`, `REASON=config`**: after push + mark-Ready, switch to the safe branch.
- **`CHAIN=no`, `REASON=push`** (plan push failed): stay on `issue-<id>` so the unpushed commit is not stranded; report the push error. No mark-Ready.
- **`CHAIN=no`, `REASON=branch`** (HEAD is not `issue-<id>`): the run does not own the branch — do not move it.
- **Dirty working tree**: `checkout_safe_branch.sh` refuses; report it, do not fail the run.
- **Nested runs** (`NESTED=true`): the caller owns the branch and labels; do nothing.

Audit and fix, in this issue: every skill exit that sits behind a next-step offer or an auto-next decision (`CHOICE=no`, `CHOICE=chat`, exit 1/4, `CHAIN=no` with any `REASON`) — including `enhance-issue`, `arcanum-split-issue`, `discuss-issue`'s push-only and hand-off paths, `plan-issue` — must end on the safe branch with its work pushed, unless it chains into a step that needs `issue-<id>`.

## Solution

- Extend `auto_next.sh` — both the shell twin (`auto_next_shell.sh`) and the native twin (`core/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext.js`) — so it does the whole sequence itself: push, mark `Ready`, and on `CHAIN=no` (`REASON=config`) release to the safe branch. Report the outcome on stdout (e.g. `READY=true|false`, `RELEASED=true|false`, with the reason on stderr when false). `run.md` keeps a single call site.
- Update `auto-plan-issue/steps/run.md` to the new contract, and let its closing report carry the `refined:ready` label change when it happened.
- Follow `plan-issue`'s model for the other skills: release the working tree *before* the next-step offer (`plan-issue/steps/write_and_confirm.md`), so a "No" already lands on the safe branch and a "Yes" works because the next skill checks the branch out again itself. Keep the logic in scripts, not markdown.
- Remove the "Known gap" note from `docs/agents/architecture/skill-finish.md#clearing` and document the rule there.
- Owners: scripter (shell twin), node (native twin), skill-writer (step markdown), architect (skill-finish.md).

## Benefits

- No run leaves `issue-<id>` checked out for nobody, so other agents sharing the same `.git` can pick the branch up.
- Plans are always pushed and issues always reach `Ready`, even when the chain is off or the context was cleared.

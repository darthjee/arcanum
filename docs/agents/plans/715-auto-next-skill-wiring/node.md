# Node Plan: Auto-next: skill wiring

Main plan: [plan.md](plan.md)

## Shared contracts

- `has-label`: the native `auto-fix-all-github-has-label` must match the shell's exit codes `0` / `1` / `2`. See [plan.md](plan.md#shared-contracts).
- `auto_next.sh` contract: test it as written in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Native `hasLabel` exit 2 + parity
In `core/lib/commands/auto-fix-all/AutoFixAllGithub.js` `hasLabel`, keep the usage `Error` and `DispatchFailure('', 1)` for "not found". Change the `catch` branch (label fetch failed) to `DispatchFailure('', 2)` and update the JSDoc. Update `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js` and the parity spec `core/spec/bin/autoFixAllGithubParity/has_label_spec.js`: shell and native must both exit `2` when `gh issue view` fails.

### Step 2 — Spec for `auto_next.sh`
Add `core/spec/bin/autoPlanIssueAutoNext_spec.js`, following `core/spec/bin/nextStepPromptShell_spec.js` (temp git repo, config tiers, stubbed `git push` remote). Cover:
- usage errors (exit 1);
- HEAD not `issue-<id>` → `CHAIN=no` / `REASON=branch` and no config read;
- key absent or `false` → `CHAIN=no` / `REASON=config`;
- key `true` with a working remote → `CHAIN=yes`, the plan commit pushed, the notice on stderr naming `/loop /auto-resolve-issue <id>`, and no stray stdout lines;
- key `true` with a failing push → `CHAIN=no` / `REASON=push`;
- `/dev/tty` is never probed.

## Files to Change
- `core/lib/commands/auto-fix-all/AutoFixAllGithub.js`: fetch failure → exit `2`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js`: exit `2` case.
- `core/spec/bin/autoFixAllGithubParity/has_label_spec.js`: parity for exit `2`.
- `core/spec/bin/autoPlanIssueAutoNext_spec.js`: new.

## CI Checks
- `core/`: `make core-check` (CI jobs: `yarn test`, `yarn lint`)

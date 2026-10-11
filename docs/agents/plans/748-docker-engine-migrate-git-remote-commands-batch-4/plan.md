# Plan: Docker engine: migrate git remote commands (batch 4)

Issue: [748-docker-engine-migrate-git-remote-commands-batch-4.md](../../issues/748-docker-engine-migrate-git-remote-commands-batch-4.md)

## Overview

Move the 10 batch-4 commands (git remote credential class) to `engine.mode=docker`, following the same three-phase pattern as batch 3 (#747): `scripter` declares the docker needs in each shim, `node` adds the docker routing callbacks and parity cases, then `scripter` flips the statuses, regenerates the status table and ticks the checklist rows. The `remote` need already exists in `arcanum/_lib/engine_dispatch_docker.sh` (added in #740, first used by `resolve-and-fetch` in #747), so no dispatch-level change is expected.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

The `--needs` value each shim's `engine_dispatch` call must declare, taken from the checklist row's `mounts`/`env` columns (`docs/agents/specs/docker/checklist.md`):

| Command | Shim | `--needs` |
| --- | --- | --- |
| `arcanum-split-issue-finish` | `arcanum-split-issue/scripts/finish.sh` | `global-config,gitconfig,gh,remote` |
| `auto-fix-all-checkout-from-main` | `auto-fix-all/scripts/checkout_from_main.sh` | `gitconfig,remote` |
| `auto-fix-all-cleanup-artifacts` | `auto-fix-all/scripts/cleanup_artifacts.sh` | `global-config,gitconfig,remote` |
| `auto-fix-all-github-cleanup-branch` | `auto-fix-all/scripts/github.sh` (`cleanup-branch`) | `global-config,gitconfig,remote` |
| `auto-fix-all-reply-comment` | `auto-fix-all/scripts/reply_comment.sh` | `global-config,gitconfig,gh,remote` |
| `auto-fix-issue-commit-change` | `auto-fix-issue/scripts/commit_change.sh` | `global-config,gitconfig,remote` |
| `auto-monitor-pr-monitor-pr` | `auto-monitor-pr/scripts/monitor_pr.sh` | `global-config,gitconfig,gh,remote` |
| `auto-new-issue-commit-issue` | `auto-new-issue/scripts/commit_issue.sh` | `global-config,gitconfig,remote` |
| `auto-plan-issue-commit-plan` | `auto-plan-issue/scripts/commit_plan.sh` | `global-config,gitconfig,remote` |
| `checkout-safe-branch` | `arcanum/_lib/checkout_safe_branch.sh` | `gitconfig,remote` |

- `--path-arg=<n>` is added for any argument that is a path outside the repo (e.g. a file argument), as in batch 2/3. Paths inside the repo (issue file, plan dir) need none, since the repo root is already mounted. `scripter` records the final `--path-arg` list per shim in its commit message; `node`'s routing cases assert exactly that list.
- If the scripter finds that a row's `mounts`/`env` columns are wrong (e.g. a command also runs `gh`), it fixes the checklist row in the same commit as the shim change, and states it in the commit message, so `node` asserts the corrected value.
- Status values in `arcanum/_lib/migration-status.json` move from `"native"` to `"docker"` only in the scripter's final phase. The node routing `docker` cases need those statuses flipped to pass, the same as in #747: node may write the cases first and run them against a locally flipped map, or the scripter flips the statuses before node finishes.

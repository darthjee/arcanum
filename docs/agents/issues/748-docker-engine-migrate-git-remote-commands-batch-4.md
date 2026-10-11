# Docker engine: migrate git remote commands (batch 4)

## Context

Part of epic #724 (implement `engine.mode=docker`), batch 4 of the migration planned in #730. This batch covers the **git remote (`remote`)** credential class: commands that talk to a git remote and therefore need SSH agent socket or https token forwarding into the container (some rows also need `gh`). Because SSH agent forwarding behaves differently on macOS Docker Desktop and on Linux, the parity cases must cover both, or the PR must state which platform was run.

Row details (`credentials`, `mounts`, `env`, `notes`) live in [`docs/agents/specs/docker/checklist.md`](../specs/docker/checklist.md).

Depends on #747 (batch 3).

## What needs to be done

Migrate the following 10 commands to the docker engine:

- `arcanum-split-issue-finish`
- `auto-fix-all-checkout-from-main`
- `auto-fix-all-cleanup-artifacts`
- `auto-fix-all-github-cleanup-branch`
- `auto-fix-all-reply-comment`
- `auto-fix-issue-commit-change`
- `auto-monitor-pr-monitor-pr`
- `auto-new-issue-commit-issue`
- `auto-plan-issue-commit-plan`
- `checkout-safe-branch`

Following [testing.md → Ticking a checklist row](../specs/docker/testing.md#ticking-a-checklist-row), for every command:

- **Shim (scripter):** make the shim's `--needs`/`--path-arg` declarations match the row's `mounts`/`env` columns.
- **Routing spec (scripter):** add a `docker` callback to the shim-level routing spec.
- **Parity (node):** add a parity case under `core/spec/docker/` (run with `make docker-parity`), or a `notes` entry in the checklist explaining why there is none.
- **Status (scripter/docs):** flip the command to `"docker"` in `arcanum/_lib/migration-status.json` and tick its checklist row with this issue's number, in the same PR.

### Out of scope

- Commands of the other batches (1, 2, 3, 5).
- `host-only` rows (`arcanum-update-run-update-*`, `auto-fix-issue-run-checks`): they stay `n/a`.
- Scripts not routed through `engine_dispatch.sh`: handled by #733.

## Acceptance criteria

- [ ] Each of the 10 shims declares `--needs`/`--path-arg` matching its checklist row's `mounts`/`env` columns.
- [ ] Each of the 10 commands has a `docker` callback in its shim-level routing spec.
- [ ] Each of the 10 commands has a parity case under `core/spec/docker/`, or a `notes` entry explaining why not.
- [ ] Each of the 10 commands is `"docker"` in `arcanum/_lib/migration-status.json`.
- [ ] Each of the 10 checklist rows is ticked with `#748`.
- [ ] The PR states which platform(s) (macOS Docker Desktop / Linux SSH agent) the parity cases were run on.

# Issue: Docker engine: migrate local commands without credentials (batch 1)

## Description

Part of epic #724 (implement `engine.mode=docker`), batch 1 of the migration planned in #730. Credential class: **local, no credentials**: every row has `none` credentials and no mounts beyond the implicit repo mount.

Row details (`credentials`, `mounts`, `env`, `notes`) are in [`docs/agents/specs/docker/checklist.md`](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/checklist.md).

Prerequisites are in place: the runtime image (#728), the docker branch of `engine_dispatch.sh` (#740), and the parity harness with the `arcanum-check-config` pilot (#741), all from #729.

### Commands (29 rows)

- `auto-fix-all-config-get`
- `auto-fix-all-config-is-enabled`
- `auto-fix-all-config-set`
- `auto-fix-all-config-toggle`
- `auto-fix-all-queue-empty`
- `auto-fix-all-queue-list`
- `auto-fix-all-queue-next`
- `auto-fix-all-queue-pop`
- `auto-fix-all-queue-wait-next`
- `auto-fix-issue-github-info`
- `auto-fix-issue-list-plan-agents`
- `auto-fix-issue-list-plan-steps`
- `discuss-issue-confirm`
- `dispatch-fixture-crash`
- `finish-report`
- `init-claude-set-ci-ignored-patterns`
- `init-claude-set-next-step-auto` (native-only)
- `init-claude-setup-docs-structure`
- `init-claude-setup-templates`
- `issue-state`
- `list-agents`
- `monitor-issues-config-get`
- `monitor-issues-config-is-enabled`
- `monitor-issues-config-set`
- `monitor-issues-config-toggle`
- `monitor-issues-rewrite-queue-pop`
- `monitor-issues-rewrite-queue-push`
- `resolve-id-and-file`
- `resolve-plan-paths`

## Expected Behavior

Per [testing.md → Ticking a checklist row](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/testing.md#ticking-a-checklist-row), for every command above:

- the shim's `--needs`/`--path-arg` declarations match the row's `mounts`/`env` columns;
- the shim-level routing spec has a `docker` callback;
- there is a parity case under `core/spec/docker/` (run with `make docker-parity`, platform reported in the PR), or a `notes` entry saying why there is none;
- in the same PR, the command flips to `"docker"` in `arcanum/_lib/migration-status.json` and its checklist row is ticked ✅ with this issue's number.

### Specific rows

- `dispatch-fixture-crash` has no shim, so it has no shim-level routing spec. It still gets a parity case under `core/spec/docker/` that checks the crash surfaces the same way under docker as natively, and its checklist `notes` say why there is no shim spec.
- `auto-fix-all-queue-wait-next` blocks until the queue has an entry. Its parity case seeds the queue first, so the call returns at once and its output can be compared with native.

### Delivery

All 29 rows ship in a single PR.

### Out of scope

- The commands of the other batches (batches 2–5).
- `host-only` rows (`arcanum-update-run-update-*`, `auto-fix-issue-run-checks`): they stay `n/a`.
- Scripts not routed through `engine_dispatch.sh`: handled by #733.

Owner: scripter / node.

# Issue: Migrate remaining entrypoints to docker (placeholder for batches)

## Description

Part of epic #724 (implement `engine.mode=docker`). Placeholder for migrating every remaining dispatched and native-only entrypoint to run under `engine.mode=docker`. The work is split into batch sub-issues of #724.

All prerequisites are done: the spec and checklist (#725–#727), the runtime image (#728), and the docker branch of `engine_dispatch.sh` with the `arcanum-check-config` pilot (#729 → #739, #740, #741). Dispatch already supports every mount/credential class the checklist needs (`--needs=global-config,gitconfig,gh,remote`, `--path-arg=<i>:<ro|rw>`). The parity harness (`make docker-parity`) and the benchmark already exist. `arcanum/_lib/migration-status.json` holds 79 `native`, 3 `host-only` and 1 `docker` command.

## Problem

79 rows in `docs/agents/specs/docker/checklist.md` are still ☐: 76 dispatched commands and 3 native-only ones. Migrating them in one PR would be unreviewable. The rows also carry very different risk. Pure local commands need nothing beyond the repo mount, while `gh` and `remote` commands depend on credential forwarding (gh token, SSH agent socket on macOS vs. Linux) that no migrated command uses yet.

## Expected Behavior

This issue's deliverable is the set of batch sub-issues of #724, each ready for `/discuss-issue` → plan → fix. Each batch:

- adds `--needs`/`--path-arg` declarations to its shims, matching the row's `mounts`/`env` columns;
- adds a `docker` callback to each shim-level routing spec, and a parity case under `core/spec/docker/` (or a note in `notes` explaining why there is none), per [testing.md → Ticking a checklist row](../specs/docker/testing.md#ticking-a-checklist-row);
- in the same PR, flips its commands to `"docker"` in `migration-status.json` and ticks its rows ✅ (with the issue number) in `checklist.md`.

Proposed batches, grouped by credential class. Each batch tests one forwarding mechanism, and the riskiest ones land last:

1. **Local, no credentials** (29 rows): `none` credentials and no extra mounts. Examples: `finish-report`, `issue-state`, `list-agents`, the `config-*` commands, the non-tagging `queue-*` commands, `discuss-issue-confirm`, `init-claude-setup-*`, `init-claude-set-next-step-auto`, `dispatch-fixture-crash`.
2. **Local with path arguments or global config** (7 rows): `args:ro`/`args:rw` or `global-config:ro`, without credentials. Examples: `discuss-issue-render-issue`, `permission-grant-add`, `init-claude-write-label-config-*`, `arcanum-split-issue-create-sub-issue-file`, `init-claude-stamp-arcanum-version`.
3. **GitHub API (`gh`)** (31 rows): `global-config:ro, gitconfig:ro`, plus `GH_TOKEN`. Examples: `github-issue-*`, `resolve-and-fetch`, `spawn-issue`, `auto-fix-all-github-*`, `auto-fix-issue-github-pr-*`, `monitor-issues-*`, `wait-ci*`.
4. **Git remote (`remote`)** (10 rows): SSH agent or https forwarding. Examples: `checkout-safe-branch`, `auto-fix-all-checkout-from-main`, `commit-*`, `cleanup-*`, `reply-comment`, `arcanum-split-issue-finish`, `auto-monitor-pr-monitor-pr`.
5. **TTY-owning native-only** (2 rows): `arcanum-create-issue-start` and `arcanum-create-issue-publish`. Under docker they always take exit 4 `FALLBACK=chat`.

Each batch issue fixes its exact row membership when it is written, using the checklist's `credentials`/`mounts` columns.

## Out of scope

- `host-only` rows (`arcanum-update-run-update-*`, `auto-fix-issue-run-checks`): they stay `n/a`.
- Scripts not routed through `engine_dispatch.sh`: handled by #733.
- Publishing the image from CI (#737) and the docs promotion and cleanup (#731, #732).

## Solution

Create one sub-issue of #724 per batch above (`/arcanum-split-issue 724` → Continue). A batch that reuses an earlier batch's forwarding path depends on it (batch 4 after batch 3, for instance). Close this placeholder once the batch issues exist.

Owner: architect defines the batches; scripter / node implement them.

## Benefits

- Reviewable PRs, each exercising a single credential/mount mechanism.
- Credential-forwarding problems (SSH agent, gh token) surface in a small batch instead of inside a large migration.
- The checklist stays the single tracking tool for the epic.

# Plan: Docker engine: migrate local commands without credentials (batch 1)

Issue: [745-docker-engine-migrate-local-commands-without-credentials-batch-1.md](../../issues/745-docker-engine-migrate-local-commands-without-credentials-batch-1.md)

## Overview

Flip the 29 batch-1 commands from `"native"` to `"docker"` in `arcanum/_lib/migration-status.json` and tick their checklist rows. Each command gets the evidence that [testing.md → Ticking a checklist row](../../specs/docker/testing.md#ticking-a-checklist-row) requires: a `docker` callback in a shim-level routing spec and a parity case under `core/spec/docker/`. Every row has `none` credentials, no mounts and no env, so no shim gains `--needs`/`--path-arg` declarations. The declarations already match. Everything ships in one PR, following the pattern of the `arcanum-check-config` pilot (#741, commit `3f31ff2`).

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **Status map:** each of the 29 keys below is `"docker"` in `arcanum/_lib/migration-status.json`. No other key changes. `host-only` rows stay as they are.
- **Shim dispatch calls are unchanged:** no `--needs`, no `--path-arg`, and the existing env-var allowlists stay as they are (`HOME` is not forwarded into the container anyway, per dispatch.md). The node agent's parity `dispatchArgs` must copy each shim's real `engine_dispatch` arguments verbatim.
- **Expected `docker run` shape for every batch-1 command:** the fixed run flags (`fixedRunFlags(repoPath)`), exactly one mount (`<repoPath>:<repoPath>`, plus the git common dir only for a worktree), no extra `-e` names beyond the fixed ones, and the argv after the image being `<command> <args...>`.
- **Commands (29):** `auto-fix-all-config-{get,is-enabled,set,toggle}`, `auto-fix-all-queue-{empty,list,next,pop,wait-next}`, `auto-fix-issue-github-info`, `auto-fix-issue-list-plan-{agents,steps}`, `discuss-issue-confirm`, `dispatch-fixture-crash`, `finish-report`, `init-claude-set-ci-ignored-patterns`, `init-claude-set-next-step-auto` (native-only), `init-claude-setup-{docs-structure,templates}`, `issue-state`, `list-agents`, `monitor-issues-config-{get,is-enabled,set,toggle}`, `monitor-issues-rewrite-queue-{pop,push}`, `resolve-id-and-file`, `resolve-plan-paths`.
- **Checklist notes:** `dispatch-fixture-crash`: "Test fixture, no shim: no shim-level routing spec; covered by the dispatch-level specs and a parity case." `auto-fix-all-queue-wait-next`: the parity case seeds the queue so the call returns immediately.

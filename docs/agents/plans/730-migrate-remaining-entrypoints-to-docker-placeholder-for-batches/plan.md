# Plan: Migrate remaining entrypoints to docker (placeholder for batches)

Issue: [730-migrate-remaining-entrypoints-to-docker-placeholder-for-batches.md](../../issues/730-migrate-remaining-entrypoints-to-docker-placeholder-for-batches.md)

## Overview

Turn this placeholder into five batch sub-issues of epic #724, grouped by credential class, and record them in the spec's sub-issue map. No script, shim, spec or `migration-status.json` changes happen here: each batch issue does its own migration later.

## Context

All prerequisites are done (#725–#729, #739–#741). `engine_dispatch.sh` supports every mount/credential class (`--needs=global-config,gitconfig,gh,remote`, `--path-arg`), `make docker-parity` exists, and only `arcanum-check-config` is docker-ready. 79 checklist rows are still ☐. The user chose: grouping by credential class, a single `gh` batch (no further split), and closing #730 once the batch issues exist (the PR's `Fix #730` closes it).

## Implementation Steps

### Step 1 — Create the five batch sub-issues of #724

For each batch below, write its body to a temp file and create it with `arcanum/_lib/spawn_issue.sh "$REPO_PATH" 724 "<title>" <body_file> --as-subissue`, recording each printed `ID=`. Create them in order so that each body's "Depends on" line can name the earlier batch's real number. Before creating, check `gh api repos/darthjee/arcanum/issues/724/sub_issues` for an existing issue with the same title, so a re-run does not create duplicates.

Every body has `## Description` (part of epic #724, credential class, link to `docs/agents/specs/docker/checklist.md`), `## Commands` (the exact list below), `## Expected Behavior` and `## Out of scope` (the other batches, `host-only` rows, #733). Expected Behavior is the same for every batch, per `docs/agents/specs/docker/testing.md#ticking-a-checklist-row`:

- each shim's `--needs`/`--path-arg` match the row's `mounts`/`env` columns;
- each shim-level routing spec has a `docker` callback;
- each command has a parity case under `core/spec/docker/` (run with `make docker-parity`, platform reported in the PR), or a `notes` entry saying why not;
- in the same PR, the commands flip to `"docker"` in `arcanum/_lib/migration-status.json`, and their checklist rows are ticked ✅ with the batch issue number.

Batches (titles prefixed `Docker engine: migrate`, owner scripter / node):

1. **`... local commands without credentials (batch 1)`**: 29 rows, no credentials and no extra mounts. Depends on #729.
   `auto-fix-all-config-get`, `auto-fix-all-config-is-enabled`, `auto-fix-all-config-set`, `auto-fix-all-config-toggle`, `auto-fix-all-queue-empty`, `auto-fix-all-queue-list`, `auto-fix-all-queue-next`, `auto-fix-all-queue-pop`, `auto-fix-all-queue-wait-next`, `auto-fix-issue-github-info`, `auto-fix-issue-list-plan-agents`, `auto-fix-issue-list-plan-steps`, `discuss-issue-confirm`, `dispatch-fixture-crash`, `finish-report`, `init-claude-set-ci-ignored-patterns`, `init-claude-set-next-step-auto` (native-only), `init-claude-setup-docs-structure`, `init-claude-setup-templates`, `issue-state`, `list-agents`, `monitor-issues-config-get`, `monitor-issues-config-is-enabled`, `monitor-issues-config-set`, `monitor-issues-config-toggle`, `monitor-issues-rewrite-queue-pop`, `monitor-issues-rewrite-queue-push`, `resolve-id-and-file`, `resolve-plan-paths`.
2. **`... local commands with path arguments or global config (batch 2)`**: 7 rows, `args:ro`/`args:rw` or `global-config:ro`, no credentials. Depends on batch 1.
   `arcanum-split-issue-create-sub-issue-file`, `discuss-issue-render-issue`, `init-claude-stamp-arcanum-version`, `init-claude-write-label-config-add`, `init-claude-write-label-config-remove`, `init-claude-write-label-config-replace`, `permission-grant-add`.
3. **`... GitHub API commands (batch 3)`**: 31 rows, `gh` credentials (`global-config:ro, gitconfig:ro`, `GH_TOKEN`; `args:ro` where the row says so). Depends on batch 2.
   `arcanum-split-issue-create-sub-issue`, `arcanum-split-issue-push-sub-issues`, `auto-fix-all-github-add-tag`, `auto-fix-all-github-has-label`, `auto-fix-all-github-pr-merge`, `auto-fix-all-github-pr-number`, `auto-fix-all-github-pr-state`, `auto-fix-all-github-remove-tag`, `auto-fix-all-queue-push`, `auto-fix-all-queue-save`, `auto-fix-all-wait-ci`, `auto-fix-all-wait-ci-and-merge`, `auto-fix-issue-github-pr-create`, `auto-fix-issue-github-pr-ready`, `auto-fix-issue-github-pr-view`, `auto-monitor-issue-pr-resolve-pr-number`, `github-issue-create`, `github-issue-fetch`, `github-issue-info`, `github-issue-mark-created`, `github-issue-mark-enhancing`, `github-issue-mark-planning`, `github-issue-mark-ready`, `github-issue-mark-refined`, `github-issue-mark-split`, `github-issue-update`, `init-claude-sync-labels`, `monitor-issues-github-remove-tag`, `monitor-issues-monitor-issues`, `resolve-and-fetch`, `spawn-issue`.
4. **`... git remote commands (batch 4)`**: 10 rows, `remote` (SSH agent socket or https token forwarding; some also `gh`). Depends on batch 3. Its parity cases must cover macOS Docker Desktop and Linux SSH agent forwarding, or say which platform was run.
   `arcanum-split-issue-finish`, `auto-fix-all-checkout-from-main`, `auto-fix-all-cleanup-artifacts`, `auto-fix-all-github-cleanup-branch`, `auto-fix-all-reply-comment`, `auto-fix-issue-commit-change`, `auto-monitor-pr-monitor-pr`, `auto-new-issue-commit-issue`, `auto-plan-issue-commit-plan`, `checkout-safe-branch`.
5. **`... TTY-owning native-only commands (batch 5)`**: 2 rows, `gh` credentials, and under docker they always take exit 4 `FALLBACK=chat` (see `docs/agents/specs/docker/dispatch.md#tty`). Depends on batch 3.
   `arcanum-create-issue-start`, `arcanum-create-issue-publish`.

### Step 2 — Record the batches in the spec's sub-issue map

In `docs/agents/specs/docker.md` → `## Sub-issue map`:

- set the #730 row's status to `Done (batches: #<b1>, #<b2>, #<b3>, #<b4>, #<b5>)` and its owner to `architect`;
- add one row per batch after #730 (title, owner `scripter / node`, depends-on as above, status `Open`);
- update the dependency-order sentence: `… → #729 → #730 → #<b1> → #<b2> → #<b3> → #<b4>, #<b5> → #731 → #732`.

Do not touch `checklist.md`: each batch ticks its own rows.

## Files to Change

- `docs/agents/specs/docker.md` — sub-issue map rows and dependency order for the five batches.
- GitHub: five new sub-issues of #724 (via `arcanum/_lib/spawn_issue.sh --as-subissue`).

## Notes

- Row counts come from `checklist.md` as of this plan (29 + 7 + 31 + 10 + 2 = 79). If a row was added or removed since then, recompute each batch's list from the `credentials`/`mounts`/`notes` columns before creating the issues: TTY note → batch 5, `git-push` → batch 4, `gh` → batch 3, `args`/`global-config` → batch 2, else batch 1.
- `host-only` rows (`arcanum-update-run-update-apply`, `arcanum-update-run-update-check`, `auto-fix-issue-run-checks`) and the "not routed through dispatch" section (#733) are excluded.
- No CI check covers this change beyond the docs lint the repo already runs on markdown.

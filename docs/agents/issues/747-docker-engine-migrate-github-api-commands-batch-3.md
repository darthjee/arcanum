# Issue: Docker engine: migrate GitHub API commands (batch 3)

## Description

Part of epic #724 (implement `engine.mode=docker`), batch 3 of the migration planned in #730. Credential class: **GitHub API (`gh`)**. Mounts: `global-config:ro, gitconfig:ro`, plus `args:ro` where the row says so. Env: `GH_TOKEN`. This is the first batch to use gh token forwarding. The forwarding itself already exists in `arcanum/_lib/engine_dispatch_docker.sh` (host-side token resolution, `-e GH_TOKEN`, and `GH_HOST`/`GH_ENTERPRISE_TOKEN` on GitHub Enterprise, per [environment.md → gh credentials](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/environment.md#gh-credentials)). This batch wires the commands to it.

Row details (`credentials`, `mounts`, `env`, `notes`) are in [`docs/agents/specs/docker/checklist.md`](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/checklist.md).

Depends on #746 (batch 2, merged).

### Commands (31 rows)

**Parity case: read-only** (reads GitHub, never writes):

- `github-issue-fetch`
- `github-issue-info`
- `resolve-and-fetch`
- `auto-fix-all-github-has-label`
- `auto-fix-all-github-pr-number`
- `auto-fix-all-github-pr-state`
- `auto-fix-issue-github-pr-view`
- `auto-monitor-issue-pr-resolve-pr-number`
- `auto-fix-all-queue-push`
- `auto-fix-all-queue-save`

**Parity case: safe mutations** (label add/remove on the sandbox fixture issue, restored afterwards):

- `auto-fix-all-github-add-tag`
- `auto-fix-all-github-remove-tag`
- `monitor-issues-github-remove-tag`
- `github-issue-mark-created`
- `github-issue-mark-enhancing`
- `github-issue-mark-planning`
- `github-issue-mark-ready`
- `github-issue-mark-refined`
- `github-issue-mark-split`

**No parity case: `notes` entry instead** (irreversible, creates GitHub objects, or blocks or loops):

- `github-issue-create`, `spawn-issue`, `arcanum-split-issue-create-sub-issue`, `arcanum-split-issue-push-sub-issues`: create issues.
- `github-issue-update`: overwrites an issue body.
- `auto-fix-issue-github-pr-create`, `auto-fix-issue-github-pr-ready`, `auto-fix-all-github-pr-merge`: create or change PR state.
- `init-claude-sync-labels`: creates or edits repo labels.
- `auto-fix-all-wait-ci`, `auto-fix-all-wait-ci-and-merge`: block until CI finishes (the second one also merges).
- `monitor-issues-monitor-issues`: long-running polling loop.

The routing spec's `docker` callback still covers these commands' `--needs`/`--path-arg` wiring.

## Expected Behavior

Per [testing.md → Ticking a checklist row](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/testing.md#ticking-a-checklist-row), for every command above:

- the shim's `--needs`/`--path-arg` declarations match the row's `mounts`/`env` columns;
- the shim-level routing spec has a `docker` callback;
- there is a parity case under `core/spec/docker/` per the grouping above, or a `notes` entry in the checklist row saying why there is none;
- in the same PR, the command flips to `"docker"` in `arcanum/_lib/migration-status.json` and its checklist row is ticked ✅ with this issue's number.

### gh parity cases

- They are opt-in, per [testing.md](https://github.com/darthjee/arcanum/blob/main/docs/agents/specs/docker/testing.md): they run only with `ARCANUM_DOCKER_PARITY_GH=1` and are marked pending otherwise.
- Nothing about the target is hardcoded. The sandbox repo and its fixtures come from env, for example `ARCANUM_DOCKER_PARITY_GH_REPO=<owner/repo>`, a fixture issue number, and a fixture PR or branch for the PR-lookup commands. When the gh flag is set but a required fixture var is missing, the cases are skipped or pending with a clear message, never failed.
- Safe-mutation cases restore the fixture issue's labels to their starting state, whatever the outcome.
- Document the new env vars where testing.md describes the opt-in flags.

### Merge gate

Before merge, the implementer runs the opt-in gh suite at least once (`ARCANUM_DOCKER_PARITY_GH=1 make docker-parity` with the sandbox env set) and reports the platform and result in the PR. Green routing specs with gh cases still pending are not enough.

## Out of scope

- The commands of the other batches (batch 1, batch 2, batch 4, batch 5), including the `gh, git-push (ssh)` / `remote` rows such as `arcanum-split-issue-finish`, `auto-fix-all-reply-comment` and `auto-monitor-pr-monitor-pr`.
- `native-only` TTY-owning gh rows (`arcanum-create-issue-publish`, `arcanum-create-issue-start`).
- `host-only` rows (`arcanum-update-run-update-*`, `auto-fix-issue-run-checks`): they stay `n/a`.
- Scripts not routed through `engine_dispatch.sh`: handled by #733.
- Changes to the token-forwarding mechanism itself, unless parity exposes a bug in it.

Owner: scripter / node.

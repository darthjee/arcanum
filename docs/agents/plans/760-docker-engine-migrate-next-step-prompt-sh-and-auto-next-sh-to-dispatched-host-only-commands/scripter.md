# Scripter Plan: Docker engine: migrate next_step_prompt.sh and auto_next.sh to dispatched host-only commands

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce the shell twins `arcanum/_lib/next_step_prompt_shell.sh` and `auto-plan-issue/scripts/auto_next_shell.sh`, each holding the current body unchanged. `auto_next_shell.sh` keeps calling the `next_step_prompt.sh` **shim**.
- Produce the shims, dispatching to `next-step-prompt` / `auto-plan-issue-auto-next`. The env forwarded:
  - `next-step-prompt`: `CLAUDE_CONFIG_DIR HOME ARCANUM_TTY_DEVICE`.
  - `auto-plan-issue-auto-next`: the same three plus `GIT_CONFIG_GLOBAL SSH_AUTH_SOCK GIT_SSH_COMMAND`.
- No `--needs` or `--path-arg` flags, because both are `host-only`.
- `migration-status.json`: both `"host-only"`.
- The `next_step_prompt.sh` shim extracts `--repo <value>` for `engine_dispatch`'s repo path and forwards `"$@"` unchanged, without `--prepend-repo-path`. With no `--repo`, or a value that isn't a directory, it `exec`s the shell twin, so usage errors are identical in every mode.
- `auto_next.sh` shim: repo path is `$1`. Agree with the node agent whether the native side gets it via `--prepend-repo-path` or as the first forwarded arg; the `'repo'` context strips the leading arg either way.

## Implementation Steps

### Step 1 — Shell twins, shims and status flip

1. `git mv arcanum/_lib/next_step_prompt.sh arcanum/_lib/next_step_prompt_shell.sh` and `git mv auto-plan-issue/scripts/auto_next.sh auto-plan-issue/scripts/auto_next_shell.sh`. Update their headers: drop "Plain bash, NOT engine-dispatched" and say they are the shell twin of the `next-step-prompt` / `auto-plan-issue-auto-next` commands.
2. Write new `arcanum/_lib/next_step_prompt.sh` and `auto-plan-issue/scripts/auto_next.sh` shims in the style of `arcanum/_lib/finish_report.sh` / `auto-fix-issue/scripts/run_checks.sh`. Each header documents `host-only`: under docker the command runs native on the host so it keeps the real `/dev/tty` (next-step-prompt) or the host's git credentials (auto-next). It also points to the twin's header for the full contract. Keep the files executable.
3. Add `"next-step-prompt": "host-only"` and `"auto-plan-issue-auto-next": "host-only"` to `arcanum/_lib/migration-status.json`.
4. Check that nothing else hard-codes the old behavior, e.g. a `release`/zip manifest or a lint list naming `next_step_prompt.sh` as non-dispatched, and that `shellcheck` passes on all four files.

### Step 2 — Checklist, docs and generated status

1. `docs/agents/specs/docker/checklist.md`: remove both rows from "Not routed through dispatch". Add a `next-step-prompt` row to `## arcanum/_lib` and an `auto-plan-issue-auto-next` row to `## auto-plan-issue`, as `dispatched`, status `n/a`, mounts `host-only`, issue #760, with the reason in `notes` (TTY-owning, must prompt on the host's real `/dev/tty` / pushes with the host's git credentials). Follow the `auto-fix-issue-run-checks` row's shape. Update the section intro and the `kind` column description, since `entrypoint` is now unused: drop it or mark it historical.
2. `docs/agents/specs/docker/dispatch.md`: rewrite the TTY paragraph ("Non-dispatched TTY scripts, today only `next_step_prompt.sh`...") and the non-dispatched kinds table's `entrypoint` row to past tense / current state. Both commands are now dispatched `host-only` (row 2 of the resolution order).
3. Update mentions that call these scripts non-dispatched in `docs/agents/architecture/skill-finish.md`, `docs/agents/specs/docker.md`, `docs/agents/architecture/shared-state-and-configuration.md`, `docs/agents/architecture/per-repo-migrations.md`, `docs/agents/architecture/arcanum-create-issue.md` and `docs/agents/issue-enhancement.md`. Grep for `next_step_prompt` / `auto_next` and fix only the statements that became false.
4. Run `scripts/generate_entrypoint_migration_status.sh` to refresh `docs/agents/architecture/entrypoint-migration-status.md`.

## Files to Change
- `arcanum/_lib/next_step_prompt_shell.sh` — renamed from `next_step_prompt.sh`, header updated.
- `arcanum/_lib/next_step_prompt.sh` — new thin shim.
- `auto-plan-issue/scripts/auto_next_shell.sh` — renamed from `auto_next.sh`, header updated.
- `auto-plan-issue/scripts/auto_next.sh` — new thin shim.
- `arcanum/_lib/migration-status.json` — two `host-only` entries.
- `docs/agents/specs/docker/checklist.md` — rows moved, intro and `kind` text updated.
- `docs/agents/specs/docker/dispatch.md` — TTY paragraph and kinds table updated.
- `docs/agents/architecture/skill-finish.md` and the other docs listed in step 2.3 — fix stale "not dispatched" statements.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated.

## CI Checks
- Shell: `shellcheck` on the four scripts. Also run the repo's `test_engine_dispatch.sh` if the shims change anything it covers.
- Docs: `scripts/generate_entrypoint_migration_status.sh` must leave no diff after regeneration.

## Notes
- Skills call both scripts by path, so no `SKILL.md` or step file changes are needed. Callers keep the same paths and arguments.
- The `SSH_AUTH_SOCK` forwarding is new for a native path. Note in the `auto-plan-issue-auto-next` row that it is forwarded so the host-only push can use the SSH agent.

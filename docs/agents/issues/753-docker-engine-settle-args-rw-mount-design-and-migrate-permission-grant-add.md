# Issue: Docker engine: settle args:rw mount design and migrate permission-grant-add

## Description

Part of epic #724 (implement `engine.mode=docker`). Split out of batch 2 (#746): `permission-grant-add` (`arcanum/_lib/permission_grant.sh` `add`, checklist row `args:rw`) was held back until its mount design is settled.

## Problem

- **Spec claim vs. actual callers.** `docs/agents/specs/docker/mounts.md` says a command writing the global Claude settings file (`permission-grant-add` against `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`) "gets only that file, through `args:rw`". In reality the global write (`arcanum/migrations/repos/0.16.0/003.sh`, and every other migration) `source`s `permission_grant.sh` and calls `permission_grant_add` in-process — it never goes through `engine_dispatch`. The only dispatched callers (`init-claude/setup_permissions.md`, `init-claude/setup_specialist_dispatch_permissions.md`) pass a repo-relative `.claude/settings.json`, which the always-mounted repo already covers.
- **If an out-of-repo target were dispatched**, the `args:rw` rule (`dispatch.md` → Argument path declaration) mounts the whole parent directory read-write — for the global settings file, all of `CLAUDE_CONFIG_DIR` (credentials, transcripts). A single-file bind mount is not an alternative: `PermissionGrant` writes `<file>.tmp` + rename and takes `<file>.lock` beside the file, which needs the directory.
- **Missing-parent parity (generic `args:rw` bug).** `dispatch.md` says an `args:rw` target with a missing parent is "not mounted, same failure as natively" — but natively `PermissionGrant` (like other `args:rw` writers) runs `mkdir -p` on the parent and succeeds, so under docker the write is silently lost inside the container.
- **Relative-path base.** Dispatch resolves a relative path argument against the shim's `$PWD`; `PermissionGrant` resolves it against `<anchor>`. They agree only when the caller's cwd is the repo root.

## Expected Behavior

- `mounts.md`/`dispatch.md` describe the actual callers and the accepted out-of-repo design.
- An `args:rw` target whose parent is missing behaves the same under docker as natively, for every `args:rw` row.
- `permission-grant-add` runs under `engine.mode=docker` with parity to native, and its checklist row is ticked.

## Solution

**Out-of-repo design — keep the generic `args:rw` rule, documented.**
- Declare `--path-arg=2:rw` on the dispatched CLI path (args after `--` are `<anchor> <file> <pattern>`).
- Fix `mounts.md` (the "gets only that file" sentence): the global `settings.json` write is done in-process by migrations and is never dispatched; the dispatched callers target the repo's own `.claude/settings.json`. Record that dispatching against an out-of-repo file mounts its parent directory `rw` — for the global settings file that is all of `CLAUDE_CONFIG_DIR` — as an accepted, documented cost, not a current use.

**Missing parent — fix generically in dispatch.**
- Change the `args:rw` row of `dispatch.md` → Argument path declaration: when the parent of an out-of-repo `rw` target is missing, dispatch creates it on the host (`mkdir -p`) before mounting it, so the write lands where native would put it.
- Implement it in `arcanum/_lib/engine_dispatch_docker.sh` (+ its tests), and re-check the already-ticked `args:rw` rows (`discuss-issue-render-issue`, `init-claude-write-label-config-*`) still hold parity.

**Relative paths — document the assumption.**
- No code change. Note in the checklist row (and the spec where relevant) that a relative `<file>` assumes the caller's cwd is the anchor/repo root, which is how `init-claude` invokes it, since dispatch resolves against `$PWD` while `PermissionGrant` resolves against `<anchor>`.

**Migrate the row** per testing.md → Ticking a checklist row: `--path-arg` declaration, `docker` routing callback, a parity case under `core/spec/docker/` covering a repo-local target, an out-of-repo target, and an out-of-repo target with a missing parent; the `migration-status.json` flip; the checklist tick.

Owner: node / scripter (dispatch spec: architect; `engine_dispatch_docker.sh` mount change: scripter).

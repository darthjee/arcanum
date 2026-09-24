# Issue: Warn users that shell engine.mode will be removed; add shell-removal spec

## Description

Arcanum's entrypoints are migrating from shell to native Node.js (see `docs/agents/architecture/script-engine.md`). In a future release the `shell` value of `engine.mode` will be removed. Only `native` and `docker` will remain. Users should be told now so they can opt in early. There should also be a written spec to guide the later removal work.

This issue does **not** remove shell mode. It (1) adds a per-machine migration that warns the user and offers to set `engine.mode`, and (2) adds a spec under `docs/agents/specs/` describing the future removal.

## Expected Behavior

### 1. Deprecation migration (`arcanum/migrations/repos/next/`)

- Scaffold with `arcanum/migrations/generate_next.sh --type instructions` → `NNN.md` + `NNN.instructions.md`, with manifest entry `applies_to: "global"` and `skippable: true`.
- The `NNN.md` summary, shown at the `[R]un/[S]kip/[C]hat` prompt, says: the shell engine is deprecated and will be removed in a future release. Users should switch to `native` (requires Node) or, once it is implemented, `docker`. If they take no action, arcanum will later pick an engine for them automatically (see the spec).
- `NNN.instructions.md` tells the AI to:
  1. Report the current resolved `engine.mode` (local/repo/global). If it is already `native` or `docker`, tell the user nothing is needed and finish.
  2. Check whether `node` is on PATH (and `docker`, for information only).
  3. Offer three choices: **native** (recommended when Node is available), **docker** (note that today it still falls back to shell, per `engine_dispatch.sh`), or **decide later**.
  4. On native or docker, write `engine.mode` to the **global** config (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`) using the existing helper (`arcanum/_lib/global_config.sh`: `global_config_write <repo_path> engine mode '"native"'`), never with a direct ad-hoc write. On "later", change nothing and restate the future automatic behavior.
- Scope is global, so the migration is shown once per machine/account, not once per repo. This is intentional: after `[R]un` → "decide later" or `[S]kip`, the global pointer advances and the warning is not shown again. No runtime deprecation warning is added to `engine_dispatch.sh`; automatic detection at removal time (see the spec) covers users who never chose.

### 2. Spec doc: `docs/agents/specs/shell-engine-removal.md`

A new folder, `docs/agents/specs/`, for forward-looking designs that guide future work. The spec covers:

- **Goal:** remove `engine.mode=shell` and the `*_shell.sh` implementations once every entrypoint is migrated (tracked in `docs/agents/architecture/entrypoint-migration-status.md`).
- **Prerequisites:** every entrypoint is migrated (`migration-status.json` all `true`), `engine.mode=docker` is actually implemented in `engine_dispatch.sh`, and this deprecation migration has shipped in at least one prior release.
- **Auto-detection rule**, run when shell is removed:
  - `engine.mode` resolves to `native` or `docker` → keep it.
  - `engine.mode` is absent at every tier, or set to `shell` → if `node` is available, write `native`; otherwise, if `docker` is available, write `docker`; otherwise fail with a hard error telling the user to install Node (preferred) or Docker.
  - The detected value is written to the **global** config tier.
- **Open points for the removal issue:** where detection runs (a migration vs. `engine_dispatch.sh` on first call), the new default when the key is absent (including whether to flip it from `shell` to `native` in an intermediate release before removal — left open, not decided here), and cleanup of the `*_shell.sh` files, parity specs, and the shell branch in `engine_dispatch.sh`.

### 3. Docs wiring

- Add a "Specs (`docs/agents/specs/`)" entry to the Documentation table in `AGENTS.md` and to `docs/agents/folder-structure.md`.
- Link the new spec from `docs/agents/architecture/script-engine.md` (Scope boundaries / See also). Update the line saying no per-repo migration is needed for `engine.mode`.

## Solution

- **architect:** write `docs/agents/specs/shell-engine-removal.md` and do the docs wiring (AGENTS.md, folder-structure.md, script-engine.md).
- **scripter:** scaffold the `next/` instructions migration via `generate_next.sh` and write `NNN.md` / `NNN.instructions.md`, following `docs/agents/architecture/per-repo-migrations.md`.
- Verify: run `/arcanum-migrate` in a test repo. The entry should appear once, and after `[R]un` → native, the global config should contain `{"engine":{"mode":"native"}}`. A second run should not show the entry again, because the global pointer has advanced.


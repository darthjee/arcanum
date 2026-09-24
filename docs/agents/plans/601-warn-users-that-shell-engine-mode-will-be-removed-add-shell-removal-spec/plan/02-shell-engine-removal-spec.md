# Write the shell-engine-removal spec

Create `docs/agents/specs/shell-engine-removal.md`. It is a forward-looking design that guides the later removal issue; nothing in it is implemented by #601. Sections:

- **Status:** proposed. Deprecation announced by the `next/001` migration (#601).
- **Goal:** remove `engine.mode=shell`, every `*_shell.sh` implementation, and the shell branch of `arcanum/_lib/engine_dispatch.sh`, once every entrypoint is migrated. Link `docs/agents/architecture/entrypoint-migration-status.md`.
- **Prerequisites:**
  - every entry in `arcanum/_lib/migration-status.json` is `true`;
  - `engine.mode=docker` is actually implemented in `engine_dispatch.sh` (no shell fallback);
  - the deprecation migration has shipped in at least one prior release.
- **Auto-detection rule** (runs at removal):
  - `engine.mode` resolves to `native` or `docker` → keep it;
  - the key is absent at every tier, or set to `shell` → write `native` if `node` is available, otherwise `docker` if `docker` is available, otherwise fail with a hard error telling the user to install Node (preferred) or Docker;
  - the detected value is written to the global tier via `global_config_write`. Note the tier-precedence caveat: an explicit `shell` in a repo or local tier must also be handled, since a global write can't override it.
- **Open points for the removal issue:**
  - where detection runs (a migration vs. `engine_dispatch.sh` on first call);
  - the new default when the key is absent, including whether to flip it from `shell` to `native` in an intermediate release before removal (left open);
  - cleanup of the `*_shell.sh` files, the shell-vs-native parity specs under `core/spec/`, and the shell branch in `engine_dispatch.sh`;
  - updating `docs/agents/architecture/script-engine.md` and `docs/agents/architecture/shared-state-and-configuration.md`.
- **See also:** `docs/agents/architecture/script-engine.md`, `docs/agents/architecture/per-repo-migrations.md`, `docs/guides/arcanum-global-config.md`.

## Files to Change

- `docs/agents/specs/shell-engine-removal.md`: new file.

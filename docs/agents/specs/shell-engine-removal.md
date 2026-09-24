# Spec: Shell Engine Removal

## Status

Proposed. Nothing in this spec is implemented yet. The deprecation was announced by the global `instructions` migration `arcanum/migrations/repos/next/001` (#601), which warns users once per machine/account and offers to set `engine.mode` in their global config.

## Goal

Remove `engine.mode=shell`, every `*_shell.sh` implementation, and the shell branch of `arcanum/_lib/engine_dispatch.sh` once every entrypoint has a native counterpart. After removal, only `native` and `docker` remain as `engine.mode` values. Migration progress is tracked in [Entrypoint Migration Status](../architecture/entrypoint-migration-status.md).

## Prerequisites

The removal issue must not start until all of these hold:

- Every entry in `arcanum/_lib/migration-status.json` is `true`, meaning every entrypoint is migrated.
- `engine.mode=docker` is actually implemented in `engine_dispatch.sh`. Today it prints a warning and falls back to shell.
- The deprecation migration (`next/001`, #601) has shipped in at least one prior release, so users have had a chance to choose.

## Auto-detection rule

Some users will never have chosen an engine. When shell is removed, arcanum resolves an engine for them:

- `engine.mode` resolves (local → repo → global) to `native` or `docker` → keep it.
- `engine.mode` is absent at every tier, or resolves to `shell` → pick one:
  1. `node` is available → `native`;
  2. otherwise, `docker` is available → `docker`;
  3. otherwise → fail with a hard error telling the user to install Node.js (preferred) or Docker.
- The detected value is written to the **global** tier (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`) via `global_config_write` in `arcanum/_lib/global_config.sh`, never by editing the JSON directly.

**Tier-precedence caveat:** a global write cannot override an explicit `engine.mode=shell` in the repo tier (`.claude/configuration/arcanum-repo-config.json`) or local tier (`.claude/state/arcanum-config.json`). The removal must handle that case too, for example by rewriting those tiers or by treating a leftover `shell` value as "absent" at dispatch time.

## Open points for the removal issue

- **Where detection runs:** a migration (once per machine, like the deprecation warning) or `engine_dispatch.sh` on first call (catches every user, including those who skip migrations).
- **The new default when the key is absent,** including whether to flip it from `shell` to `native` in an intermediate release before removal. This is left open on purpose and is not decided here.
- **Cleanup:** delete the `*_shell.sh` files, the shell-vs-native parity specs under `core/spec/`, and the shell branch in `engine_dispatch.sh`.
- **Docs:** update [Script Engine](../architecture/script-engine.md) and [Shared State & Configuration Files](../architecture/shared-state-and-configuration.md) to drop `shell` as a valid `engine.mode` value.

## See also

- [Script Engine](../architecture/script-engine.md): the shell/native/docker dispatch design.
- [Per-Repo Migrations](../architecture/per-repo-migrations.md): how `global`-scoped `instructions` migrations work.
- [Global Config guide](../../guides/arcanum-global-config.md): the global config file and its resolution.

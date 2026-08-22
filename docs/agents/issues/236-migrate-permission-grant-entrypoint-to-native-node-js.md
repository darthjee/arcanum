# Issue: Migrate permission-grant entrypoint to native Node.js

## Description
Part of the migration batch tracked in #232 (following #192, #193, #227), per the migration design in docs/agents/architecture/script-engine.md. Migrates `arcanum/_lib/permission_grant.sh` to native Node.js.

`arcanum/_lib/permission_grant.sh` is a shared helper that appends a Bash-permission allowlist pattern into a Claude Code native settings file's `.permissions.allow` array (`.claude/settings.local.json`, `.claude/settings.json`, or `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json` — not one of arcanum's own namespaced config files). It is dual-mode: meant to be sourced for its `permission_grant_add` function, with a secondary CLI dispatcher (`permission_grant.sh add <file> <pattern>`) for direct invocation (used by `init-claude/setup_permissions.md`).

## Expected Behavior
`permission_grant_add <file> <pattern>`:
- Creates `<file>`'s parent directory if missing; creates `<file>` from `{}` if it doesn't exist or isn't valid JSON.
- Appends `<pattern>` to `.permissions.allow`, deduping (`+ [$pattern] | unique`), leaving every other top-level key (`.permissions.deny`, hooks, etc.) untouched.
- Lock-protected (`<file>.lock`, via `lock.sh`), atomic write (`.tmp` + `mv`).
- Degrades silently on a parent-directory create failure: warning to stderr, no-op, still exits 0 (same posture as `global_config_write` in `global_config.sh`).
- CLI dispatcher: `permission_grant.sh add <file> <pattern>`; any other/missing subcommand prints `Usage: $0 add <file> <pattern>` to stderr, exit 1.

## Solution
- Native implementation at `core/lib/PermissionGrant.js`, routed via `core/bin/arcanum permission-grant add <file> <pattern>`.
- Reuse `core/lib/Lock.js` directly for lock/mutate/release — do not reimplement locking. `Lock.js` already mirrors `lock.sh`'s protocol (unique instance id, sleep, re-read to confirm, retry on loss, warn after 10 attempts).
- JSON manipulation via plain `JSON.parse`/`JSON.stringify`, replicating jq's merge semantics: `.permissions.allow = ((.permissions.allow // []) + [$p] | unique)`.
- Byte-identical output/exit-code to `permission_grant.sh` (same silent-success behavior, same degrade-on-failure warning text, same exit codes).
- Parity test at `core/spec/lib/PermissionGrant_spec.js` — runs shell vs native with identical inputs, asserts identical resulting JSON file content + exit code.
- Unit tests: file doesn't exist yet, file exists with unrelated content, pattern already present (dedup), parent directory creation failure, concurrent-write lock contention (reuse `Lock.js`'s existing test patterns).
- Flip `permission-grant` from `false` to `true` in `arcanum/_lib/migration-status.json`.
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
- Zero runtime npm dependencies — only built-in Node APIs.

## Benefits
- Continues the entrypoint migration effort (#232), moving another shell entrypoint to native Node.js.
- Reuses `Lock.js` directly, avoiding a second implementation of the same lock protocol.
- Parity-tested against the shell original, keeping behavior byte-identical during the transition.

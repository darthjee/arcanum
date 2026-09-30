# Scripter Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Main plan: [plan.md](plan.md)

## Shared contracts

You **produce** C2 (`--native-only` in `engine_dispatch.sh`) and C3 (`arcanum-check-config/scripts/check_config.sh`), both specified in [plan.md](plan.md#shared-contracts). You can rely on `node`'s C1: `core/bin/arcanum arcanum-check-config <repo_path> <key>` reads `HOME`/`CLAUDE_CONFIG_DIR` from its env, prints JSON on stdout and exits `0` on success, and prints `arcanum: <message>` on stderr with exit `1` for a bad key.

## Implementation Steps

### Step 1 — `--native-only` mode in `engine_dispatch.sh`
In `arcanum/_lib/engine_dispatch.sh`, recognize `--native-only` in the flag/env-var segment, next to `--prepend-repo-path`. When set:
- `engine.mode=docker` → print the C2 error on stderr and `return 1`;
- any other mode (unset/`shell`/`native`) → skip the shell and migration-status branches and run the same native invocation the existing native branch builds.

Factor the native-invocation build (env allowlist + `env -i` + optional `--prepend-repo-path`) into one private helper used by both the regular and native-only paths, so it isn't duplicated. Keep bash 3.2 compatibility (guarded empty-array expansions) and keep the non-`--native-only` path's behavior byte-for-byte identical. Document the flag in the function header comment, including that `<shell_script>` is `""` in this mode and that `migration-status.json` is not consulted.

Extend `arcanum/_lib/test_engine_dispatch.sh`:
- `--native-only` with `engine.mode` unset, `shell` and `native`: all reach the native bin (anchor on an already-routed command, e.g. `auto-fix-all-config-get`, as the existing cases do);
- `--native-only` with `docker`: exits `1` with the C2 message on stderr, empty stdout;
- `--native-only` ignores `migration-status.json`: `dispatch-fixture-crash` (or any routed command) still runs natively even when the map would say otherwise / a command is absent from the map;
- the existing (non-native-only) cases still pass unchanged.

### Step 2 — Skill shim and migration-status doc note
Create `arcanum-check-config/scripts/check_config.sh` (executable, `set -euo pipefail`) per C3. Header comment in the style of the other shims (e.g. `auto-plan-issue/scripts/commit_plan.sh`), explaining: it is native-only (no `*_shell.sh` twin); `HOME` and `CLAUDE_CONFIG_DIR` are forwarded because the global tier is resolved from them; `<repo_path>` is forwarded as the first native argument, consumed by the `context: 'repo'` dispatcher, so `--prepend-repo-path` is not used.

Also add one sentence to the static intro text that `scripts/generate_entrypoint_migration_status.sh` writes into `docs/agents/architecture/entrypoint-migration-status.md`: native-only commands (dispatched with `engine_dispatch --native-only`) have no shell implementation, are not tracked in `migration-status.json`, and so never appear in this table. Then run the generator to refresh the doc.

## Files to Change
- `arcanum/_lib/engine_dispatch.sh` — add `--native-only` and a shared native-invocation helper.
- `arcanum/_lib/test_engine_dispatch.sh` — native-only cases.
- `arcanum-check-config/scripts/check_config.sh` — new shim.
- `scripts/generate_entrypoint_migration_status.sh` — intro sentence about native-only commands.
- `docs/agents/architecture/entrypoint-migration-status.md` — regenerated output only (never hand-edited).

## CI Checks
- `bash arcanum/_lib/test_engine_dispatch.sh` — standalone, not wired into CI; run it locally.
- `core`: `yarn test` from `core/` (CI job: `test`) covers the shim end to end via `node`'s routing spec once both sides land.
- If available: `shellcheck arcanum/_lib/engine_dispatch.sh arcanum-check-config/scripts/check_config.sh`.

## Notes
- Do not add a `check_config_shell.sh` and do not add `arcanum-check-config` to `migration-status.json`.
- The shim's success path needs `node`'s C1 registered in `core/lib/core/commands.js`; until then only its usage-error path can be exercised locally.

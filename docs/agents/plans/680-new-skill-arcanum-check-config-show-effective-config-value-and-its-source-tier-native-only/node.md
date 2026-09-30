# Node Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Main plan: [plan.md](plan.md)

## Shared contracts

You **produce** C1 (see [plan.md](plan.md#c1--native-command-arcanum-check-config)) exactly as specified: registry entry (first in `COMMANDS`, `context: 'repo'`, `validateRepoPath: false`), argument shape, JSON output shape and key order, error messages and exit codes.

You can rely on:
- C2: `engine_dispatch ... --native-only` runs `core/bin/arcanum` for `engine.mode` unset/`shell`/`native`, and exits `1` with `Error: engine.mode=docker is not implemented yet for native-only command '<command>'.` on stderr for `docker`.
- C3: `arcanum-check-config/scripts/check_config.sh <repo_path> <key>` calls `core/bin/arcanum arcanum-check-config <repo_path> <key>` with only `PATH`, `ARCANUM_REPO_PATH`, `HOME` and `CLAUDE_CONFIG_DIR` (when set) in the environment, and handles the missing-argument usage error itself.

## Steps

- [01 — Per-tier read in ConfigChain](node/01-configchain-read-tiers.md)
- [02 — ArcanumCheckConfig command and registration](node/02-arcanum-check-config-command.md)
- [03 — Routing spec through the real shim](node/03-shim-routing-spec.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`) and `yarn lint` (CI job: `checks`), both run from `core/`.

## Notes
- Do not add `arcanum-check-config` to `arcanum/_lib/migration-status.json`: native-only commands stay out of it (C2).
- There is no shell twin and no shell-vs-native parity spec, by design. Step 03's routing spec replaces it.

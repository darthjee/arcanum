# node Plan: Migrate auto-fix-all-config entrypoint (get, is-enabled, set, toggle) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See `plan.md`'s "Shared contracts" for the full detail. This agent must:
- Produce `core/lib/AutoFixAllConfig.js` with methods `get`, `isEnabled`, `set`, `toggle`, implementing the file/namespace resolution and per-subcommand output/exit-code contract documented there exactly (including the `DispatchFailure`/no-stdout shape for `isEnabled`'s false case, and `Lock`-protected writes for `set`/`toggle`).
- Register the four commands in `core/bin/arcanum`'s `COMMANDS` map under the exact names `auto-fix-all-config-get`, `auto-fix-all-config-is-enabled`, `auto-fix-all-config-set`, `auto-fix-all-config-toggle` — `scripter`'s shim dispatches using these same names, and `migration-status.json` gates native availability per this same name.
- Each `AutoFixAllConfig` method takes `repoPath` as an explicit leading argument (`get(repoPath, key)`, `isEnabled(repoPath, key)`, `set(repoPath, key, value)`, `toggle(repoPath, key)`) — this is what lets `engine_dispatch`'s single shared `args` list work for both the shell and native branch; see `plan.md`'s "Why `config.sh` splits into 4 dedicated `*_shell.sh` files".
- Can rely on `scripter` producing 4 dedicated shell scripts (`auto-fix-all/scripts/config_get_shell.sh`, `config_is_enabled_shell.sh`, `config_set_shell.sh`, `config_toggle_shell.sh`, each `<repo_path> <key> [<value>]`) as the shell-side comparison target for this agent's parity spec — not a single renamed `config_shell.sh`.

## Steps

- [01 — Create AutoFixAllConfig.js](node/01-create-auto-fix-all-config-module.md)
- [02 — Register the four commands in core/bin/arcanum](node/02-register-commands.md)
- [03 — Native unit spec](node/03-native-unit-spec.md)
- [04 — Shell-vs-native parity spec](node/04-parity-spec.md)

## CI Checks

- `core`: `yarn test` (CI job: `core-test`)
- `core`: `yarn lint` (CI job: `core-lint`)

## Notes

- `core/lib/RepoConfig.js` already exists but only covers unrelated single-tier reads (`git.safe_branch`, `plan-issues.*`) — it is not a dependency here and should not be reused or extended for this issue's namespace read/write logic.
- No runtime npm dependencies; use only built-in `node:fs/promises`, `node:path`.

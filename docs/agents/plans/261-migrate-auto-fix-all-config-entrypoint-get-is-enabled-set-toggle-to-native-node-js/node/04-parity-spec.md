# Shell-vs-native parity spec

Create `core/spec/bin/autoFixAllConfigParity_spec.js`, following `autoFixAllCheckoutFromMainParity_spec.js`'s shape: `execFile` both sides against identically-seeded temp fixture directories (`createTempDir`/`removeTempDir`), asserting identical `stdout` and exit `code` for both (stderr is not asserted for byte-for-byte equality — see `plan.md`'s Shared contracts on the `set` error case's `arcanum: ` prefix).

Shell side: `scripter`'s 4 dedicated scripts (`plan.md`'s "Why `config.sh` splits into 4 dedicated `*_shell.sh` files"), each invoked as `<script> <repo_path> <key> [<value>]` — `auto-fix-all/scripts/config_get_shell.sh`, `config_is_enabled_shell.sh`, `config_set_shell.sh`, `config_toggle_shell.sh`.

Native side: `core/bin/arcanum auto-fix-all-config-get <repo_path> <key>` (and the `-is-enabled`/`-set`/`-toggle` counterparts), same argument shape.

Cases to cover, run against both implementations:

- `get` — key present in new file; key present only in legacy file; key absent (default `"false"`); a `clear_context`-style key with no legacy fallback.
- `is-enabled` — resolved `"true"` (exit 0, empty stdout); resolved `"false"`/absent (exit 1, empty stdout).
- `set` — valid write (exit 0, empty stdout, and independently re-run `get` afterward on each side to confirm the persisted value matches); missing args (exit 1); invalid value (exit 1) — for these two error cases, assert `stdout` and `code` parity only, not `stderr`.
- `toggle` — from `"true"` to `"false\n"`; from absent/`"false"` to `"true\n"`.

Seed each side's fixture directory identically before each case (same `.claude/configuration/arcanum-repo-config.json` / `.claude/configuration/auto-fix-all.json` / `.claude/state/arcanum-config.json` contents) — pass each fixture directory itself as `<repo_path>` (both sides take it as an explicit argument now, so no `cwd` trick is needed the way the checkout-from-main parity spec needed one for its git fixture repos).

## Files to Change

- `core/spec/bin/autoFixAllConfigParity_spec.js` — new parity spec covering all 4 subcommands per the cases above.

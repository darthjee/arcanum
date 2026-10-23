# Argument layer and targeting
Build the parsing that every subcommand shares, before any filesystem access, so usage errors (exit `2`) always win.

- Per-subcommand option sets merged into `parseArgs`: tier flags `--global`/`--local`, plus `--all-tiers` (only `get`), `--string` (only `set`), `--force` and `--lock-timeout <seconds>` (only `set`/`unset`). Tier flags are mutually exclusive, and `--all-tiers` cannot be combined with a tier flag. `--lock-timeout` must be a non-negative number. Strict arity: `set` takes 2 positionals, `get`/`unset` take 1, `list`/`info` take 0. `--` ends option parsing.
- The `--repo` overload (spec "Syntax rules"): pre-scan argv before `parseArgs`. `--repo=<path>` is always the targeting form. `--repo <token>` is the targeting form when the token contains `/` or is `.`/`..`. Any other use, including a trailing `--repo`, is the repo tier flag. Both forms can appear together (`--repo=<path> --repo`).
- Global targeting flags (spec "Global flags" and the index's Targeting section): `--claude-config-dir <path>` (expands a leading `~`) overrides `CLAUDE_CONFIG_DIR` (used verbatim, with a stderr warning when it starts with `~`). `--repo <path>` is normalized through `RepoPath` and then `git rev-parse --show-toplevel`. The cwd is the default. A non-existent `--repo` or `--claude-config-dir` path is a usage error. A missing repo or Claude config dir, where the command needs it, is exit `4`.
- Key syntax: reject empty segments (`a..b`, a leading `.` or a trailing `.`) with exit `2`.
- Value parsing (spec "Value parsing" table): JSON for `true`/`false`/numbers/`null`/arrays/objects, a string otherwise, and always a string with `--string`.
- `config.js` dispatches to one module per subcommand, each exporting its `options` and `run`. Commands become async, and `main.js` already awaits `command.run`.

## Files to Change
- `cli/lib/main.js` — accept the global `--repo`/`--claude-config-dir` targeting flags and the `--repo` pre-scan, and pass the targeting context to commands.
- `cli/lib/commands/config.js` — dispatch to the subcommand modules and merge their options.
- `cli/lib/commands/config/{get,set,unset,list,info}.js` — new modules (option sets plus `run`, filled in by later steps).
- `cli/lib/args.js` (new) — the `--repo` pre-scan, tier-flag exclusivity, arity, key syntax and `--lock-timeout` checks.
- `cli/lib/target.js` (new) — resolves the Claude config dir (with its source) and the repo root.
- `cli/lib/values.js` (new) — the value-parsing table.
- `cli/spec/lib/args_spec.js`, `cli/spec/lib/target_spec.js`, `cli/spec/lib/values_spec.js` (new) — one spec per syntax rule, per targeting source and per value-parsing row, with and without `--string`.

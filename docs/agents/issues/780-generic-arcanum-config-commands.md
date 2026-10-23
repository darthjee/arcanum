# Issue: Generic arcanum config commands

## Description

Part of epic #767 (Arcanum user-facing CLI for configuration). Builds on the `cli/` scaffold (#779), the key registry (#777), the lock fix (#807) and epic #816, which moved the shared config surface into the root `shared/` lib. All of these are merged. #825 added the writer pieces this issue needs: `RepoConfigWriter#unset`, an optional `timeoutMs` on every writer method, and top-level writes (`write` without a `namespace`).

Implement the generic `arcanum config` subcommands: `get`, `set`, `unset`, `list` and `info`. Today `cli/lib/commands/config.js` only prints help; each subcommand prints "not implemented yet" and exits `1`.

`docs/agents/specs/arcanum-cli/command-surface.md` is the contract, together with the index's Targeting, `arcanum config info` and Version skew sections (`docs/agents/specs/arcanum-cli.md`), the Key Registry spec, and the [Shared Lib](../architecture/shared-lib.md) architecture doc for the import boundary. This issue does not repeat the spec; it sets the scope and what counts as done.

This is a `cli/`-only change: it consumes `shared/lib/config/` (`ConfigChain`, `RepoConfigWriter`, `KeyRegistry`, `ConfigError`) and `shared/lib/file/` (`Lock`, `LockTimeoutError`, `RepoPath`) as they are. If a gap in `shared/` turns up, it is raised as a separate `shared` issue, not patched from `cli/`.

## Solution

### Commands

- `arcanum config get <key> [--global|--repo|--local] [--all-tiers]`: the resolved value and its source tier, a single tier's raw value, or the per-tier view.
- `arcanum config set <key> <value> (--global|--repo|--local) [--string] [--force] [--lock-timeout <seconds>]` and `unset <key> (tier) [--force] [--lock-timeout <seconds>]`: a tier is required. JSON value parsing per the spec's value-parsing table, with `--string`. Dotted-path `setpath` keeps siblings; `unset` of a missing key is a no-op; empty parents are not pruned.
- `arcanum config list [--global|--repo|--local]`: flattened dotted keys, with registry descriptions for known keys.
- `arcanum config info`: the resolved `CLAUDE_CONFIG_DIR` and its source, the repo root, each tier file with its version pointer and skew status, and the CLI and Node versions.

### Cross-cutting behaviour

- Registry validation on `set`/`unset`: type, enum, tier and read-only. Unknown keys are refused unless `--force` is passed. `--force` bypasses only unknown keys and version skew.
- Targeting: the `CLAUDE_CONFIG_DIR` env var, `--claude-config-dir` (overrides the env, leading `~` expanded), `--repo <path>` normalized through `RepoPath`/`git rev-parse --show-toplevel`, and the cwd as default. This includes the syntactic `--repo` overload rule (path versus tier flag).
- Syntax rules: flags before or after the subcommand, mutually exclusive tier flags, `--all-tiers` only on `get`, `--string` only on `set`, `--` ending option parsing, strict arity and unknown flags.
- Exit codes `0`–`7` with the precedence `2`, `4`, `7`, `3`, `5`, `6`. Shared `ConfigError`/`LockTimeoutError` codes are mapped per the spec.
- Malformed tier files: reads warn and treat the tier as empty; writes refuse with exit `7` and leave the file's bytes unchanged. A UTF-8 BOM is tolerated on read.
- Writes go through `RepoConfigWriter` (`write`, `unset`, top-level `write` for one-segment or `--force`d unknown keys) and its shared `Lock`, with a bounded wait passed as `timeoutMs` (`--lock-timeout`, default `10`s, `0` means try once). On timeout, exit `6`. On Ctrl-C, release the lock and exit `130`.
- Version skew, using the embedded `MIGRATION_VERSIONS`: a write to a tier that is ahead of the CLI exits `5` unless `--force`; reads of a tier that is ahead warn; a tier that is behind warns only when its scope has pending migrations.
- Output: results only on stdout, every warning and error on stderr. `--json` emits the spec's stable shapes for every command, plus the error object. Human output and error wording follow the spec (`arcanum: ` prefix, optional `hint: ` line, no stack traces unless `ARCANUM_DEBUG=1`).
- Zero runtime npm dependencies: `node:util` `parseArgs` plus the in-house subcommand layer.

### Tests

Follow the spec's Testing section: temp-dir fake `CLAUDE_CONFIG_DIR`s and repos, one spec per exit code, one per malformed-file kind (reads and writes, bytes unchanged), one per value-parsing row with and without `--string`, JSON shape specs for every command, lock specs, and syntax specs.

### Owner

`client`, in one issue and one PR. The plan stages the work: argument parsing, targeting and the error/exit-code layer first, then the reads (`get`, `list`, `info`), then the writes (`set`, `unset`).

## Benefits

- Users and scripts can inspect and edit every arcanum config tier without hand-editing JSON or opening a Claude session.
- The shortcuts (#781) and the setup wizard (#782) are built on this layer.

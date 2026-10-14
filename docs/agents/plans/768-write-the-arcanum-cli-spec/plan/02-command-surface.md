# Write command-surface.md

Create `docs/agents/specs/arcanum-cli/command-surface.md` (part shape: Purpose / Decisions / Alternatives considered / Open points), restating #767's "Command surface" section for the generic layer and meta commands.

Decisions to capture:

- Everything config-related lives under `arcanum config ...`; top level only has `--help` / `--version`.
- `arcanum config get <key> [--global|--repo|--local] [--all-tiers]` — no tier: resolved value + source tier (local → repo → global), like `/arcanum-check-config`; `--all-tiers` shows every tier incl. shadowed.
- `arcanum config set <key> <value> (--global|--repo|--local)` and `unset` — **tier required** (no implicit default; omitting it is a usage error).
- `arcanum config list [--tier]` — flattened dotted keys; `arcanum config info` — resolved `CLAUDE_CONFIG_DIR` + source, repo root, repo's recorded arcanum version, CLI version.
- Value parsing: `true`/`false`/numbers/`null`/JSON arrays/objects parsed as JSON, else string; `--string` forces string (relevant because `next_step.auto.*` only accepts the JSON boolean `true`).
- Dotted keys use the same nested `setpath` semantics (siblings kept) as `global_config_write` / `RepoConfigWriter`.
- Validation against the key registry (link `key-registry.md`); unknown keys refused unless `--force`.
- Global flags: `--repo <path>`, `--claude-config-dir <dir>`, `--json`. Human-readable output by default.
- Implementation constraint: zero runtime npm dependencies — argument parsing on `node:util` `parseArgs` plus a thin in-house subcommand/help layer.

Alternatives considered: a CLI framework (`commander`/`yargs`) — rejected for supply-chain surface on a tool writing into `~/.claude`, and consistency with `core/`'s zero-runtime-deps rule; `commander` noted as the low-risk upgrade path. Defaulting `set` to `--local` like git — rejected (accidental writes to committed/shared files).

Open points: exact exit codes; `--json` output shapes; error message wording; behaviour outside a git repo or with malformed files; lock contention behaviour.

## Files to Change
- `docs/agents/specs/arcanum-cli/command-surface.md` — new part.

# Arcanum CLI: Command Surface

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define the generic `arcanum config` layer, which works like `git config`, plus the meta commands and global flags. The curated shortcuts built on top of it are in [Shortcuts and Setup](shortcuts-and-setup.md).

## Decisions

### Namespace

- Everything configuration-related lives under **`arcanum config ...`**.
- The top level has only meta commands (`--help`, `--version`), so `arcanum <command>` stays free for later, non-config features.

### Generic commands

```text
arcanum config get <key> [--global|--repo|--local] [--all-tiers]
arcanum config set <key> <value> (--global|--repo|--local)
arcanum config unset <key> (--global|--repo|--local)
arcanum config list [--global|--repo|--local]
arcanum config info
```

- **`get`** without a tier prints the resolved value and its source tier, resolving local → repo → global like `/arcanum-check-config`. With a tier flag, it reads only that tier. `--all-tiers` shows every tier's value, including shadowed ones.
- **`set` / `unset`** require a tier. There is no implicit default, so nothing is ever written by accident to the committed repo file or the shared global file. Omitting the tier is a usage error.
- **`list`** prints flattened dotted keys, for every tier or only the given one. Known keys show their registry description.
- **`info`** prints the resolved `CLAUDE_CONFIG_DIR` and its source (flag, env or default), the repo root, the repo's recorded arcanum version, and the CLI version.

### Keys

- Keys are dotted paths, e.g. `next_step.auto.enhance-issue`.
- Writes use the same nested `setpath` semantics as `global_config_write` and `RepoConfigWriter`: missing intermediate objects are created and sibling keys are kept.
- `set` and `unset` validate the key against the [Key Registry](key-registry.md): key, type, enum, tier and read-only-ness. Unknown keys are refused unless `--force` is passed.

### Value parsing

- `true`, `false`, numbers, `null`, JSON arrays and JSON objects are parsed as JSON. Anything else is a string.
- `--string` forces the value to be stored as a string. This matters because, for example, `next_step.auto.*` accepts only the JSON boolean `true`, not the string `"true"`.

### Meta commands

- `arcanum --help` and `arcanum <cmd> --help` print usage. Key docs in help come from the registry.
- `arcanum --version` prints the CLI version.

### Global flags

| Flag | Effect |
| --- | --- |
| `--repo <path>` | Targets the repo at `<path>` instead of the current directory. |
| `--claude-config-dir <dir>` | Targets that global config dir. Overrides `CLAUDE_CONFIG_DIR`. A leading `~` is expanded. |
| `--json` | Machine-readable output. |

See [Targeting](../arcanum-cli.md#targeting) for how the account and repo are resolved.

### Output

Output is human-readable by default. `--json` switches to machine-readable output for scripting.

### Implementation constraint

The CLI has **zero runtime npm dependencies**. Argument parsing uses the built-in `node:util` `parseArgs`, plus a thin in-house subcommand and help layer. The rationale:

- The tool writes into `~/.claude`, so no third-party code should run on users' machines (supply-chain risk).
- Installs stay tiny.
- It matches `core/`'s zero-runtime-dependency rule.

## Alternatives considered

- **A CLI framework (`commander`, `yargs`).** Rejected: it adds supply-chain surface to a tool that writes into `~/.claude`, and breaks consistency with `core/`'s zero-runtime-dependency rule. `commander` is the low-risk upgrade path if the surface grows a lot.
- **Defaulting `set` to `--local`, like git.** Rejected: with three tiers, one committed and one shared across repos, an implicit tier makes accidental writes to shared files too easy.

## Open points

- Exact exit codes (success, usage error, validation error, I/O error, lock failure).
- The `--json` output shape of each command.
- Error message wording.
- Behaviour outside a git repo, and with a missing or malformed tier file (reads today degrade silently to "no value"; writes may need to refuse).
- Behaviour on lock contention: wait, time out, or fail.

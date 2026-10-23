# Arcanum CLI

The user-facing `arcanum` command (`cli/`, published as the optional npm package `arcanum-cli`) manages Arcanum's configuration from outside Claude Code, through `arcanum config ...`. It reads and writes the three tier files described in [Shared State & Configuration Files](shared-state-and-configuration.md) — global (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`), repo (`.claude/configuration/arcanum-repo-config.json`) and local (`.claude/state/arcanum-config.json`), resolved local → repo → global — with the same dotted-path rules, the same writer and the same lock as the skills, through the [shared lib](shared-lib.md). This doc covers both the contract the CLI implements (targeting, commands, value parsing, output, exit codes, shortcuts, the setup wizard) and how it is built.

`cli/` is owned by the `client` agent (see [Agent Roster and Delegation](agent-roster-and-delegation.md)). End-user docs: [the guide](../../guides/arcanum-cli.md) and [`cli/README.md`](../../../cli/README.md).

## Goal and distribution

- **Configuration only.** Every command lives under `arcanum config ...`, so the top-level `arcanum <command>` namespace stays free for later features. The CLI does not install, update or remove Arcanum itself.
- **Optional, installed separately.** `npm i -g arcanum-cli` installs the `arcanum` command. No per-repo migration installs it or nudges the user towards it; the README and the guide explain how to install it.
- **One install per machine.** A single global install serves every Arcanum install and every Claude account on the machine (see [Targeting](#targeting)), so users with several `CLAUDE_CONFIG_DIR`s never end up with competing clients.
- **Host Node.js, no Docker fallback.** Node is already a prerequisite of Arcanum's native engine. The floor is in [Runtime path](#runtime-path).
- **Lockstep with Arcanum.** `arcanum-cli` is published on every Arcanum release with the same version. How it is built, packaged and published is in [Install & Release → npm package](install-and-release.md#npm-package-arcanum-cli).

## Relationship to `core/bin/arcanum`

Separate entrypoint, shared logic:

- `core/bin/arcanum` is the internal native dispatcher that `arcanum/_lib/engine_dispatch.sh` calls (see [Script Engine](script-engine.md)). It is never on the user's `PATH`, so it does not collide with the user-facing `arcanum`.
- `cli/bin/arcanum` is the user-facing entrypoint, with its own command registry, its own `--help`, repo resolution that defaults to the current directory, and human-readable output.
- `cli/` imports nothing from `core/`. What both sides need lives in `shared/lib/` and is bundled into the CLI at build time; `cli/eslint.config.mjs` forbids imports from `core/` and from `shared/spec/` (see [Shared Lib → Import boundary](shared-lib.md#import-boundary)).

## Runtime path

1. `cli/bin/arcanum` (unbundled, ES2020, so it still parses on an old Node) compares `process.versions.node` with the floor, `22.13.0`. Below it, it prints `Node.js >= 22.13.0 required, found X` and exits `1`; otherwise it dynamically imports `../dist/arcanum.mjs`, resolved next to itself. The floor is in lockstep with `core/`: a spec checks that `cli/package.json`'s `engines.node` equals `core/package.json`'s (`>=22.13.0`) and that the literal in `cli/bin/arcanum` equals both, and the `esbuild` `target` (`node22.13`) derives from the same value. npm only warns on `engines`, hence the runtime check.
2. The bundle's entry is `cli/lib/main.js`, which `cli/scripts/build.mjs` bundles with `esbuild` together with the `shared/lib/` files it imports. The build injects `__ARCANUM_CLI_VERSION__`, `__ARCANUM_NODE_FLOOR__` and `__ARCANUM_MIGRATION_VERSIONS__` through `define`. A source run, as in the specs, sees `0.0.0-dev`, a `>=22.13.0` fallback (kept equal to `engines.node` by a spec) and empty migration lists.
3. `main.run(argv, { io, env, cwd, version, migrationVersions, deps })` never throws: every error goes through `output.reportError`, which uses `exitCodes.exitCodeForError` and returns the exit code. Everything a command touches (streams, env, cwd, versions, `execFileAsync`, `Lock`, signal hooks, Node version) can be injected, so specs never touch the real `~/.claude`, the real cwd or the real process. An error escaping the bundle (it shouldn't) is printed by `cli/bin/arcanum` as `arcanum: <message>` with exit `1`.

## Module layout

| Module | Role |
| --- | --- |
| `lib/main.js` | Global flags (`--help`, `--version`, `--json`, `--claude-config-dir`), the `--repo` pre-scan, command lookup, `parseArgs` (strict) and the command context. |
| `lib/args.js` | The argument layer: `--repo` overload pre-scan, first-positional lookup that skips option values, tier-flag exclusivity, per-subcommand flag sets, strict arity, key syntax, `--lock-timeout`, required tier. |
| `lib/target.js` | Targeting: the Claude config dir (flag → `CLAUDE_CONFIG_DIR` → `$HOME/.claude`, with its source and state) and the repo root (`RepoPath#validate`/`#toplevel`, "no repo", git missing from PATH, configured or not). |
| `lib/values.js` | `set`'s value-parsing table. |
| `lib/exitCodes.js` | Exit constants, the `CliError` family (`UsageError` `2`, `ValidationError` `3`, `TargetUnavailableError` `4`, `VersionSkewError` `5`, `LockTimeoutRefusal` `6`, `FileError` `7`, each with an optional `hint`) and `exitCodeForError`, the single mapping point (shared `ConfigError`/`LockTimeoutError` codes included). |
| `lib/output.js` | Result writer (human text or exactly one JSON line), stderr warnings, error reporting (the `arcanum:` prefix, the `hint:` line, JSON error object, `ARCANUM_DEBUG=1` stacks). |
| `lib/tierFiles.js` | Tier file paths and the never-throwing tier parse (`ok`, `missing`, `empty`, or a malformed state: `invalid_json`, `not_object`, `unreadable`, `not_utf8`; UTF-8 BOM stripped). `readTierTolerant` warns and reads as empty; `readTierForWrite` refuses with exit `7`. |
| `lib/skew.js` | Version pointers (`.version` for repo, `.migrations.version` for local and global, `0.0.0` when missing), skew status against the CLI version and the embedded per-scope migration list, read warnings and the write refusal. |
| `lib/writeTier.js` | The write path: target check, registry validation messages, `prepareWrite` (the ordered checks), `writeKey` (the `RepoConfigWriter` call with the quiet, bounded lock and SIGINT handling). |
| `lib/commands/config.js` | The `config` namespace: help, then the checks every subcommand shares, then dispatch. |
| `lib/commands/config/{get,set,unset,list,info}.js` | One module per subcommand, each exporting `options`, `positionals`, `acceptsTier` and `run`. |
| `lib/commands/config/shortcuts/index.js` | The shortcut namespaces (`engine`, `git`, `auto-fix-all`, `monitor-issues`, `next-step`, `agents`): namespace → runner, or → shortcut name → runner. `config.js` dispatches to it before the generic subcommands. |
| `lib/commands/config/shortcuts/common.js` | What every shortcut shares: the strict flag set (`--force`/`--string` refused, `--all-tiers` reads only, `--lock-timeout` writes only), `delegate` to the generic `get`/`set`/`unset`, `writeValue` and the shadowed-tier note. |
| `lib/commands/config/shortcuts/{singleValue,nextStep,agentsEmail,ignoreChecks}.js` | The single-value table and runner, `next-step auto`, `agents email`, `auto-fix-all ignore-checks`. |
| `lib/commands/config/shortcuts/defaultTier.js` | The default write tier of each key a shortcut covers (`defaultTier(key)`), shared by the shortcuts' tables and the setup wizard. |
| `lib/booleanToken.js` | The shortcuts' `on`/`off`/`true`/`false` tokens, with the exit-`3` hint. |
| `lib/commands/config/setup.js` | `config setup`: the `--json`/TTY/section usage checks, the item list built from the registry's `setup` fields, the no-repo skipping, the session and the per-item loop. |
| `lib/commands/config/setup/{setting,identity,ci,summary}.js` | The wizard's scalar per-setting dialogue, the per-agent email overrides, the `ci` add/remove loop, and the stderr summary. |
| `lib/prompter.js` | The wizard's line prompter over `node:readline` (questions to stderr, queued answers), rejecting with `Interrupted` on EOF or Ctrl-C; it owns `SIGINT` only while a question is open. |
| `lib/commands/config/shared.js` | Read-side helpers: `readTiers` (targets, account/repo read rules, tolerant reads, skew warnings), file display, registry defaults. |
| `lib/help.js` | Top-level, `config`, per-subcommand and per-shortcut usage. Key docs come from the registry. |

## Targeting

Every invocation resolves two targets once, in `cli/lib/target.js`: the account (the Claude config directory, for the global tier) and the repo (for the repo and local tiers).

### Account

| Source | Rule |
| --- | --- |
| `--claude-config-dir <dir>` (`flag`) | Wins. A leading `~` or `~/` is expanded by the CLI itself, since the shell does not expand it in every position (`--claude-config-dir=~/...`). `~user` is a usage error, as is `~` with `$HOME` unset or an empty value. A relative path resolves against the cwd. A path that is missing or not a directory is a usage error (`2`). |
| `CLAUDE_CONFIG_DIR` (`env`) | Used verbatim, with no `~` expansion, matching `ConfigChain`, the shell helpers and Claude Code, so the CLI never writes somewhere the skills don't read. A value starting with `~` raises a warning that it was not expanded. An empty value counts as unset. |
| `$HOME/.claude` (`default`) | When neither is set. |
| none (`unresolved`) | No flag, no `CLAUDE_CONFIG_DIR`, no `$HOME`. |

How each account state behaves:

| State | Reads of the global tier | Writes to the global tier |
| --- | --- | --- |
| Unresolved | Empty tier, stderr warning. | Refused, exit `4`, with a hint to set `CLAUDE_CONFIG_DIR` or pass `--claude-config-dir`. |
| Directory missing (from `env` or `default`) | Empty tier, warning naming the path. | Refused, exit `4`. The CLI never creates the directory, so a typo cannot create a phantom account. |
| Path is not a directory | Exit `4`. | Exit `4`. |
| Directory exists, no `arcanum-config.json` | Empty tier. | Normal; the file is created on first write. |

Whether an Arcanum install lives in that directory is not checked.

### Repo

- The repo is the cwd, or the `--repo <path>` targeting flag (see [Global flags](#global-flags) for how `--repo` doubles as a tier flag). Either is normalized with `RepoPath#toplevel` (`git -C <path> rev-parse --show-toplevel`), so a subdirectory targets the repo root, and inside a worktree the root is that worktree's own directory, since each worktree has its own `.claude/state/`.
- A `--repo` path that does not exist or is not a directory is a usage error (`2`) with `RepoPath`'s `not a directory: <path>` message.
- A path that is not in a git repo, a bare repo, or a cwd with no `git` on `PATH` (with a warning) resolves to "no repo". That is a result, not an error; whether it matters depends on the command.

| State | Detection | Reads | Writes to repo / local |
| --- | --- | --- | --- |
| No repo | `rev-parse --show-toplevel` fails | Without a tier flag, only the global tier is read, with a stderr warning. An explicit `--repo`/`--local` is exit `4`. | Exit `4`. |
| Not arcanum-configured | `.claude/configuration/arcanum-repo-config.json` is missing | Missing tiers read as empty. | Refused, exit `4`, with the hint `run /init-claude in that repo`. |
| Configured | That file exists | Normal. | Normal; the local file is created on first write. |

Writing into an unconfigured repo is refused because creating the file by hand would half-initialize the repo outside `/init-claude`: with no version pointer it reads as `0.0.0`, so every migration would look pending. `--force` never bypasses a target refusal.

## `config info`

`arcanum config info` (`cli/lib/commands/config/info.js`) describes the CLI's environment: where it would read and write, and whether writing there is safe. It never shows config values, never creates files, never takes locks, and always exits `0` except on usage errors: no repo, an unresolved account and missing or malformed files are reported, not errors. It deliberately leaves out the Arcanum install's location and version (see [Version skew](#version-skew)).

```text
arcanum-cli 2.4.0 (node 22.14.0, requires >=22.13.0)

Account
  claude config dir  /Users/x/.claude-favini   (from: env CLAUDE_CONFIG_DIR)
  global config      /Users/x/.claude-favini/arcanum-config.json   [exists]
  global version     2.3.0   behind — 1 pending migration, run /arcanum-migrate

Repo
  root               /Users/x/projects/foo   (from: cwd)
  repo config        .claude/configuration/arcanum-repo-config.json   [exists]
  repo version       2.4.0   up to date
  local config       .claude/state/arcanum-config.json   [missing]
  local version      0.0.0 (no pointer)   behind — 3 pending migrations, run /arcanum-migrate
```

- The account source reads `(from: --claude-config-dir)`, `(from: env CLAUDE_CONFIG_DIR)` or `(from: default $HOME/.claude)`; an unresolved account prints a single `(unresolved: CLAUDE_CONFIG_DIR and HOME are unset)` row. The repo source reads `(from: --repo)` or `(from: cwd)`; with no repo, a single `root  (no repo at <path>)` row.
- Each file is `[exists]`, `[missing]` or `[malformed]`. A version line is `up to date`, `behind — N pending migration(s), run /arcanum-migrate`, `ahead — writes refused without --force`, or `unknown (malformed file)`. A missing pointer shows as `0.0.0 (no pointer)`.

With `--json`, one object:

```json
{
  "cli": { "version": "2.4.0", "node": "22.14.0", "node_floor": ">=22.13.0" },
  "account": {
    "claude_config_dir": "/Users/x/.claude-favini", "source": "env",
    "file": "/Users/x/.claude-favini/arcanum-config.json", "exists": true,
    "version": "2.3.0", "skew": { "status": "behind", "pending": 1 }
  },
  "repo": {
    "root": "/Users/x/projects/foo", "source": "cwd",
    "repo_config": { "file": "/Users/x/projects/foo/.claude/configuration/arcanum-repo-config.json", "exists": true, "version": "2.4.0", "skew": { "status": "up_to_date", "pending": 0 } },
    "local_config": { "file": "/Users/x/projects/foo/.claude/state/arcanum-config.json", "exists": false, "version": "0.0.0", "skew": { "status": "behind", "pending": 3 } }
  }
}
```

- `account.source` is `flag`, `env`, `default` or `unresolved`. An unresolved account is `{ "claude_config_dir": null, "source": "unresolved", "file": null, "exists": false, "version": null, "skew": null }`.
- `repo` is `null` when there is no repo; `repo.source` is `flag` or `cwd`.
- `skew.status` is `up_to_date`, `behind` or `ahead`; `pending` counts that scope's pending migrations (`0` unless `behind`).
- A malformed file block is `{ "file": …, "exists": true, "malformed": true, "version": null, "skew": null }`. File paths are absolute in JSON, repo-relative in the human output.

## Version skew

One CLI may face repos and accounts on different Arcanum versions. `cli/lib/skew.js` compares each tier's version pointer with the CLI's own version, which, since the CLI ships in lockstep with Arcanum, is the newest config shape it can know.

| Tier | Pointer |
| --- | --- |
| Global | `.migrations.version` in `arcanum-config.json` |
| Repo | `.version` in `.claude/configuration/arcanum-repo-config.json` (see [the repo version guide](../../guides/arcanum-repo-version.md)) |
| Local | `.migrations.version` in `.claude/state/arcanum-config.json` |

A pointer holds an Arcanum version, not a migration number. A missing (or non-string) pointer counts as `0.0.0`, as in `arcanum/migrations/run.sh`. Versions compare numerically (`0.9.3` < `0.13.0`). Migrations are scoped per tier (`applies_to: repo|local|global`), so the three files can sit at different versions.

To know which migrations are pending, the build embeds, per scope, the list of released Arcanum versions that shipped a migration for it, read from `arcanum/migrations/repos/<X.Y.Z>/migrations.json` (`next/` excluded, versions above the CLI's dropped; see [Install & Release → npm package](install-and-release.md#npm-package-arcanum-cli)).

| Status | Condition | Reads | Writes |
| --- | --- | --- | --- |
| `ahead` | pointer > CLI version | Allowed, with a warning ending `keys may have moved, run npm i -g arcanum-cli@latest`. | Refused with exit `5` and the hint `npm i -g arcanum-cli@latest, or pass --force`. `--force` bypasses it, reported as `"forced": true`. |
| `behind` | pointer < CLI version, and the tier's scope has migrations after the pointer, up to the CLI version | Allowed, with a warning `<tier> config is at <v> with N pending migration(s); run /arcanum-migrate`. | Allowed. |
| `up_to_date` | equal, or behind with nothing pending (a patch bump with no shape change) | Silent. | Silent. |

- A write checks only the target tier's pointer: `set --global` ignores the repo pointer.
- A malformed file has no skew status; it is handled as a file error instead (see [Missing and malformed tier files](#missing-and-malformed-tier-files)).
- Skew is measured against the tier pointers, never against the Arcanum install's own version, which the CLI cannot reliably locate.

## Exit codes

`cli/lib/exitCodes.js` is the single mapping point. The `code` field of a JSON error is the identifier in the second column.

| Exit | JSON `code` | Error class | When |
| --- | --- | --- | --- |
| `0` | — | — | Success, including `unset` of an absent key and `info` in any environment. |
| `1` | `error` | `CliError` | `get` of an unset key (a normal result, not an error object, like `git config`). Generic error: an unexpected failure, a shared `ConfigError` with no dedicated mapping (`UNREGISTERED_KEY` included), or a Node.js below the floor (printed by `cli/bin/arcanum`, before any JSON mode exists). |
| `2` | `usage` | `UsageError` | Unknown command, subcommand or flag; bad arity; conflicting or missing tier flags; bad key syntax; bad `--lock-timeout`; a bad `--repo` or `--claude-config-dir` path. `parseArgs` errors (`ERR_PARSE_ARGS_*`) map here too. |
| `3` | `validation` | `ValidationError` | Key registry refusal: unknown key, wrong type, enum, format, tier not allowed, read-only key. |
| `4` | `target_unavailable` | `TargetUnavailableError` | Nowhere to read or write the requested tier: no repo, an unconfigured repo, or an unresolved, missing or non-directory Claude config dir. One code for every tier. Never bypassed by `--force`. |
| `5` | `version_skew` | `VersionSkewError` | A write to a tier whose pointer is ahead of the CLI, without `--force`. |
| `6` | `lock_timeout` | `LockTimeoutRefusal` | The write lock was not acquired within `--lock-timeout`. A shared `LOCK_TIMEOUT` maps here too. |
| `7` | `file` | `FileError` | A malformed tier file the CLI refuses to write over, or an I/O error. The shared `NOT_AN_OBJECT` and `INVALID_JSON` codes and any Node errno error (`EACCES`, `ENOSPC`, `EISDIR`, …) map here too. |
| `130` | — | — | Interrupted by Ctrl-C (`SIGINT`) during a write or the setup wizard. |

Each `CliError` carries an optional `hint`, printed as a `hint:` line (see [Output](#output)).

## Commands

The top level holds only the meta flags and the `config` namespace, so `arcanum <command>` stays free for later, non-config features. `config` also hosts the [shortcuts](#shortcuts) and the [setup wizard](#setup-wizard).

### Generic commands

```text
arcanum config get <key> [--global|--repo|--local] [--all-tiers]
arcanum config set <key> <value> (--global|--repo|--local) [--string] [--force] [--lock-timeout <seconds>]
arcanum config unset <key> (--global|--repo|--local) [--force] [--lock-timeout <seconds>]
arcanum config list [--global|--repo|--local]
arcanum config info
```

Each also accepts the [global flags](#global-flags) and `--help`.

- **`get`** without a tier prints the resolved value and its source tier, resolving local → repo → global (the first present, non-`null` value wins, as in `ConfigChain`). With a tier flag it reads only that tier and prints the raw value. `--all-tiers` shows every tier's value, shadowed ones included. An unset key exits `1`, like `git config`.
- **`set` / `unset`** require a tier flag. There is no default tier, so nothing is ever written by accident to the committed repo file or the shared global file.
- **`list`** prints every key set in every tier (or only the given one), flattened to dotted keys, one line per key per tier, with the registry description of known keys.
- **`info`** describes the environment; see [`config info`](#config-info).

### Global flags

| Flag | Effect |
| --- | --- |
| `--repo <path>` | Targets the repo at `<path>` instead of the cwd (see [Targeting → Repo](#repo)). Only the targeting form; a bare `--repo` is the repo tier flag (see [Syntax rules](#syntax-rules)). |
| `--claude-config-dir <dir>` | Targets that Claude config dir, overriding `CLAUDE_CONFIG_DIR`; a leading `~` is expanded (see [Targeting → Account](#account)). |
| `--json` | Machine-readable output (see [JSON output](#json-output)). |
| `-h`, `--help` | Usage on stdout, exit `0`. |

`--lock-timeout <seconds>` is a flag of the write commands (`set`, `unset`, `setup` and the shortcuts' writes), described in [Lock contention](#lock-contention).

### Meta commands

- `arcanum --help`, `arcanum config --help`, `arcanum config <subcommand> --help` and `arcanum config <shortcut> --help` print usage on stdout and exit `0`. The `config` usage lists the subcommands, the shortcuts, the targeting flags and every registered key with its description, all from `cli/lib/help.js` and the key registry.
- `arcanum --version` prints `arcanum-cli <version>` on stdout and exits `0`; with `--json`, `{"version":"<version>"}`. `--version` is checked first, so it wins wherever it appears.
- `arcanum` with no arguments, or `arcanum config` with no subcommand, prints the matching usage on stderr and exits `2`. An unknown command or `config` subcommand is a usage error (`unknown command 'x'`, `unknown config subcommand 'x'`).

## Argument parsing

### Syntax rules

- **Flag placement.** Global and command flags may appear before or after the subcommand and its positionals: `arcanum --json config get k` and `arcanum config get k --json` are equivalent.
- **Tier flags are mutually exclusive.** Any two of `--global`, `--repo`, `--local` is a usage error (`--global cannot be combined with --repo`). `info` takes no tier flag (`--repo is not accepted by info`).
- **`--repo` is overloaded on purpose.** Without a value it is the repo tier flag; with a path it is the targeting flag. The rule is syntactic, never based on what exists on disk: `--repo=<path>` is always the targeting form; `--repo <token>` is the targeting form when `<token>` contains a `/` or is `.` or `..` (keys never do); any other `--repo`, a trailing one included, is the tier flag. To target a repo and select the repo tier, pass both: `--repo=<path> --repo`. A targeting path given twice, or an empty `--repo=`, is a usage error.
- **Command-specific flags.** `--all-tiers` is accepted only by `get` (and not with a tier flag), `--string` only by `set`, `--force` only by `set` and `unset`, `--lock-timeout` only by `set`, `unset` and `setup`, and `--unset` only by the shortcuts. The error names the flag and who takes it: `--string is only accepted by set, not get`.
- **`--`** ends option parsing; use it for values that start with `-`: `arcanum config set k --global -- -1`. A flag value starting with `-` needs the `=` form (`--lock-timeout=-1`), otherwise `parseArgs` refuses it as ambiguous.
- **Arity** is exact: `set` takes `<key> <value>`, `get` and `unset` take `<key>`, `list` and `info` none. A missing positional is `set needs <value>`; an extra one is `get: unexpected argument 'x'`.
- **Unknown flags** are usage errors (`parseArgs` strict mode).

### How it is parsed

- `parseArgs` only knows boolean `--repo` (the tier flag). Before it runs, `extractRepoTarget` removes the targeting forms, stopping at `--`.
- The command name is the first positional, skipping the values of every string option of every command, so `--claude-config-dir /d config ...` and `--repo ./x config ...` work.
- The `config` namespace merges the tier flags and the union of all subcommand and shortcut flags into `parseArgs`. Which subcommand accepts which flag is checked afterwards (`checkFlags`), so the error can name the flag and the subcommands that take it. Tier exclusivity, arity and key syntax follow, in `config.js`, before any subcommand runs.

## Keys and `--force`

### Keys

- Keys are dotted paths, e.g. `next_step.auto.enhance-issue`. An empty segment (`a..b`, a leading or trailing `.`, an empty key) is a usage error: `invalid key 'a..b': a key segment may not be empty`.
- Writes use nested `setpath` semantics: missing intermediate objects are created (a `null` intermediate is replaced by an object), siblings are kept, and a JSON object value replaces the whole subtree at its key rather than merging.
- `set` and `unset` validate the key against the [key registry](shared-state-and-configuration.md#the-key-registry): known key, type, enum, format, tier and read-only-ness, all exit `3`. Wildcard entries (`git.agents.<agent>`, `next_step.auto.<skill>`) match any segment there. A registry tier restriction can make a key single-tier: `auto-fix-all.ignored_check_patterns` is repo-only, so writing it with `--global` or `--local` is `auto-fix-all.ignored_check_patterns is repo-only`.
- Reads (`get`, `list`) accept any key, known or not, including top-level keys such as `version`.
- `unset` of a key that is not in the target tier is a no-op that exits `0` and reports `"changed": false`, like `rm -f`. `unset` of the last key of an object leaves the empty parent in place (no pruning), as the shell helpers do.

### `--force` scope

`--force` is accepted only by `set` and `unset`. It is the escape hatch for keys newer than the installed CLI and for experimental keys; it never weakens checks on keys the CLI knows and never touches environment problems.

| Refusal | Exit | Bypassed by `--force` |
| --- | --- | --- |
| Unknown key | `3` | Yes; the value checks are skipped too. |
| Version skew: target tier ahead of the CLI | `5` | Yes |
| Wrong type, enum or format for a known key | `3` | No |
| Wrong tier for a known key | `3` | No |
| Read-only key (`version`, `migrations.version`) | `3` | No: those pointers belong to the migrations and `/init-claude`. |
| Number that would lose precision | `3` | No |
| Usage error | `2` | No |
| Target unavailable | `4` | No |
| Lock timeout | `6` | No |
| Malformed tier file, non-object on the key's path, I/O error | `7` | No |

When `--force` actually bypassed a refusal, the JSON output reports `"forced": true`.

## Value parsing

`cli/lib/values.js` parses `set`'s value as typed. `true`, `false`, `null`, numbers (`-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?`) and anything that looks like JSON (starts with `[`, `{` or `"`, with no trimming) are parsed as JSON; everything else is a string. `--string` stores the value as a string, whatever it looks like. That matters because, for example, `next_step.auto.*` accepts only the JSON boolean `true`.

| Input | Without `--string` | With `--string` |
| --- | --- | --- |
| `''` (empty) | the empty string `""` | `""` |
| `true` / `false` | boolean | `"true"` / `"false"` |
| `42`, `-1.5`, `1e3` | number | string |
| `01`, `.5`, `+1` | string (not a JSON number) | string |
| `9007199254740993`, `1e999` | refused, exit `3`: `<key>: <raw> cannot be stored as a number without losing precision`, `hint: pass --string to store it as text` (even with `--force`) | string |
| `null` | JSON `null`: exit `3` for a known key (`hint: use 'config unset' to remove it`); stored as a value for an unknown key with `--force`. It is not `unset`: the key stays present. | `"null"` |
| `[1,2]`, `{"a":1}` | array / object | string |
| `"quoted"` | the string `quoted` | the string `"quoted"`, quotes kept |
| `[1,` or `{a:1}` (looks like JSON, is not) | the string as typed, unless the key's registry type is array: then exit `3`, `<key> must be a JSON array: <parse error>` | string |
| ` 42 ` | the string ` 42 `; values are never trimmed | string |

After parsing, a known key's value is checked against the registry (type, enum, format, `min`/`max`, non-empty). A type mismatch with `--string` given gets `hint: drop --string`. An unknown key with `--force` skips the value checks.

## Missing and malformed tier files

`cli/lib/tierFiles.js` reads a tier file without ever throwing and classifies it:

| State | Reads (`get`, `list`) | Writes (`set`, `unset`) to that tier |
| --- | --- | --- |
| `missing` | Empty tier, silent. | Normal; the file is created on first write (subject to [Targeting](#targeting)). |
| `empty` (zero bytes or whitespace only) | Empty tier, silent. | Normal; written as if it were `{}`. |
| `invalid_json` | Stderr warning naming the file (`<file> is not valid JSON (line N); ignoring it`); the tier reads as empty, so the other tiers still resolve. | Refused, exit `7`: `<file> is not valid JSON (line N); refusing to overwrite it`, `hint: fix or remove the file`. The file is left untouched. |
| `not_object` (`null`, an array, a scalar) | Same, `<file> is not a JSON object (got …)`. | Refused, exit `7`. |
| `unreadable` (permissions, a directory) | Same, `<file> is unreadable (<errno code>)`. | Refused, exit `7`. |
| `not_utf8` | Same, `<file> is not UTF-8`. A UTF-8 BOM is stripped and not written back; it does not count as malformed. | Refused, exit `7`. |
| Not writable | Normal. | Exit `7`, `cannot write <file>: <OS error>`. |

- **Why writes refuse.** The shared `RepoConfigWriter` reads a malformed file as `{}`, so writing through it would silently replace a corrupted user file. The CLI never destroys data it cannot parse, so `readTierForWrite` reads and checks the target file itself before calling the writer. The check and the write are not atomic, but the window is the one a hand edit already has, and the writer still takes the lock. `--force` does not bypass this; the fix is to repair or remove the file.
- **`get` with a tier flag** on a malformed file warns and behaves as an unset key (exit `1`).
- **Non-object on the key's path.** A file that is an object can still hold a non-object where the key needs one (`.git` is a string, then `set git.safe_branch …`). The shared writer refuses it with `ConfigError('NOT_AN_OBJECT')` before writing, and the CLI reports `cannot write <key> to <file>: .git is not a JSON object; refusing to overwrite it` with exit `7`. How shared errors map to exit codes is in [Exit codes](#exit-codes) and [Shared Lib](shared-lib.md).

## Refusal order

When several refusals apply, the first in this order wins: usage `2`, target `4`, file `7`, registry `3`, skew `5`, lock `6`. Usage is checked before touching the filesystem, the target before its file, the file before the key, and the lock last. Each command runs its checks in that order instead of collecting errors and sorting them:

1. Usage (`2`): `parseArgs`, flag sets, tier exclusivity, arity, key syntax (in `config.js`), then the required tier and `--lock-timeout` (in `set`/`unset`). Bad `--repo`/`--claude-config-dir` paths also raise `2`, during targeting, before any tier file is read.
2. Target (`4`): `checkWriteTarget` for writes; for reads, an explicit `--repo`/`--local` with no repo, or a Claude config dir that is not a directory.
3. File (`7`): `readTierForWrite` on the target file. A non-object on the key's path is caught later, by the shared writer (`ConfigError('NOT_AN_OBJECT')`), before anything is written.
4. Registry (`3`): `validateSet`/`validateUnset` (`KeyRegistry#lookup`/`#check`, plus the precision and broken-JSON-array rules).
5. Skew (`5`): `checkWriteSkew` on the target tier's pointer only.
6. Lock (`6`): the shared `Lock`'s bounded acquire.

## Reads

- Reads take no lock. A read racing a write sees either the old or the new file, since writes replace the file whole.
- `get` and `list` read the tier files themselves with `readTierTolerant`, in local → repo → global order, and apply the same present-and-non-`null` rule as `ConfigChain`. They don't call `ConfigChain#readWithSource` directly, because it reads malformed files silently (the CLI must warn), needs a repo path (the CLI must work outside a repo), and only resolves namespaced keys (the CLI also reads top-level keys such as `version`). Two specs keep them aligned: `tierFiles_spec` checks the paths against `ConfigChain`'s, and `get_spec` checks resolution against `readWithSource`.
- With no tier and no repo, only the global tier is read, with a warning (`no repo at <path>; reading the global tier only`). An unresolved or missing Claude config dir reads as an empty global tier, with a warning.
- A tier whose pointer is ahead of the CLI warns. A tier behind it warns only when its scope has migrations between the pointer and the CLI version (see [Version skew](#version-skew)).
- `list` flattens each tier: non-empty objects are walked, anything else (scalars, arrays, `null`, empty objects) is a leaf, so an object emptied by `unset` shows up as `<parent> = {}`.
- `info` uses the strict `readTier` and reports the malformed, missing and skew states instead of warning. It never fails on environment state.

## Writes

- `RepoConfigWriter#write`/`#unset` do the actual write: nested `setpath`, kept siblings, no pruning, jq-identical serialization, atomic `<file>.tmp` + rename, under `<file>.lock`. A known key of two or more segments is passed as `namespace` + the rest. A one-segment key, or a `--force`d unknown key, uses the top-level form. The tier files have no legacy file. The writer and the lock protocol are described in [Shared Lib](shared-lib.md) and [Lock System](lock-system.md).
- `unset` of a key that is not in the file skips the writer: nothing is locked or written, `"changed": false`.

### Lock contention

- Writes go through the shared `Lock` on `<file>.lock`, the same protocol as `arcanum/_lib/lock.sh`, so the CLI and running skills exclude each other (atomic create-if-absent acquire, owner-checked release, stale-lock detection).
- Unlike the skills, the CLI bounds the wait: `10` seconds by default, `--lock-timeout <seconds>` to change it (decimals allowed), `0` to try once. A negative or non-numeric value is a usage error (`--lock-timeout must be a non-negative number of seconds, got '<v>'`). `timeoutMs` is the value × 1000.
- On timeout the CLI exits `6` with `timed out after <N>s waiting for <file>.lock` and `hint: if no arcanum process is running, remove that file`. A timeout means the lock file existed for the whole wait, so nothing was written and there is nothing to clean up.
- The CLI wraps the shared `Lock` before handing it to the writer, so `acquire` always runs with `warn: false` (the timeout message replaces `Lock`'s "seems stuck" warning) and the CLI knows whether the lock is held.
- A SIGINT handler is installed for the duration of the write. Ctrl-C while waiting exits `130` with nothing written and no lock left behind; Ctrl-C while holding the lock releases it first (the release is owner-checked, so only a lock file still holding the CLI's id is removed), then exits `130`.

## Output

- Human-readable by default, `--json` for scripting (`cli/lib/output.js`).
- **stdout** carries only the command's result. **stderr** carries every warning (`arcanum: warning: …`), note (`arcanum: note: …`) and error, in both modes. So `--json` stdout is always either empty or exactly one JSON object followed by a newline. Warnings stay plain text in `--json` mode.

### Human output

```text
$ arcanum config get engine.mode
native   (repo: .claude/configuration/arcanum-repo-config.json)

$ arcanum config get git.safe_branch
(unset; default: origin/main)

$ arcanum config get engine.mode --all-tiers
local    -        (unset)
repo     native   <- resolved
global   -        (unset)

$ arcanum config set next_step.auto.enhance-issue true --global
set next_step.auto.enhance-issue = true   (global: /Users/x/.claude/arcanum-config.json, was: unset)

$ arcanum config unset git.safe_branch --local
unset git.safe_branch   (local: .claude/state/arcanum-config.json, was: origin/main)

$ arcanum config unset git.safe_branch --local
git.safe_branch was not set   (local: .claude/state/arcanum-config.json)

$ arcanum config list
repo    engine.mode = "native"   Script engine used to run migrated skill entrypoints
global  next_step.auto.enhance-issue = true   Run this skill's suggested next step automatically
```

- Repo and local files show repo-relative, the global file absolute.
- `get` and `set` print strings without quotes and anything else as compact JSON; `list` prints every value as JSON (strings quoted). `list` with a tier flag drops the tier column.
- An unset key prints `(unset)`, or `(unset; default: <value>)` when the registry has a default, and exits `1`. In `--all-tiers`, a tier with no target (no repo, unresolved account) shows `(no target)`.
- `get` with a tier flag prints the raw value only, so `$(arcanum config get k --repo)` is usable in scripts. When the key is unset there, stdout stays empty, a stderr warning says `<key> is unset in the <tier> tier` (with the default when there is one), and the exit is `1`.
- `config setup` writes its prompts to stderr too, so stdout stays results-only.

### JSON output

Each command prints one stable object. Fields may be added; existing ones are not renamed or removed without a major version.

`get` (with or without a tier flag):

```json
{"key":"engine.mode","set":true,"value":"native","source":"repo","default":"shell"}
```

- Unset: `{"key":"engine.mode","set":false,"value":null,"source":null,"default":"shell"}`, exit `1`. It is not an error object.
- `default` is the registry default, or `null` when the key has none or is unknown. It is present whether the key is set or not.
- `source` is `local`, `repo`, `global` or `null`; with a tier flag it is that tier.

`get --all-tiers`:

```json
{"key":"engine.mode",
 "resolved":{"set":true,"value":"native","source":"repo","default":"shell"},
 "tiers":{
   "local":{"set":false,"value":null,"file":"/x/foo/.claude/state/arcanum-config.json"},
   "repo":{"set":true,"value":"native","file":"/x/foo/.claude/configuration/arcanum-repo-config.json"},
   "global":{"set":false,"value":null,"file":"/Users/x/.claude/arcanum-config.json"}}}
```

- A tier with no target has `"file": null`. Exit `1` when `resolved.set` is false.

`set` / `unset`:

```json
{"key":"next_step.auto.enhance-issue","tier":"global","file":"/Users/x/.claude/arcanum-config.json",
 "changed":true,"previous":{"set":false,"value":null},"value":true,"forced":false}
```

- `changed` is false for a `set` that stores the value already there, and for an `unset` of an absent key. For `unset`, `value` is `null`.
- `previous` is the key's state in that tier before the write (a `null` counts as unset).
- `forced` is true only when `--force` actually bypassed a refusal.

`list`:

```json
{"entries":[{"key":"engine.mode","tier":"repo","value":"native","known":true,"description":"Script engine used to run migrated skill entrypoints"}]}
```

- One entry per key per tier, so a shadowed key appears once per tier that sets it. `description` is `null` for unknown keys. Registry defaults of unset keys are not listed; `get` reports them in `default`.

`info`: see [`config info`](#config-info). `--version`: `{"version":"2.4.0"}`.

Errors, on stderr in `--json` mode:

```json
{"error":{"code":"target_unavailable","exit":4,"message":"arcanum: no repo at /x/bar; --repo and --local need a git repo","hint":null}}
```

- `code` is the identifier from [Exit codes](#exit-codes) (`error`, `usage`, `validation`, `target_unavailable`, `version_skew`, `lock_timeout`, `file`); `message` keeps the `arcanum: ` prefix; `hint` is a string or `null`.
- `--json` is detected on the raw argv (before `--`) for errors raised before `parseArgs` runs, so even a usage error comes out as JSON.

### Error messages

- One line on stderr, `arcanum: <message>`: lowercase after the prefix, no trailing period, naming the key, tier and file that apply. A leading `Error: ` some shared messages carry is stripped.
- An optional second line, `hint: <hint>`. A usage error with no hint of its own gets `Run 'arcanum --help' for usage.` instead.
- No stack traces, unless `ARCANUM_DEBUG=1` is set (in both modes).
- A value is echoed back only when its JSON is at most 40 characters; longer ones show as `a N-character value`.

| Exit | Message |
| --- | --- |
| `1` | `Node.js >= 22.13.0 required, found 20.11.0` (from `cli/bin/arcanum`, no prefix) |
| `2` | `arcanum: set needs a tier: --global, --repo or --local` |
| `2` | `arcanum: --all-tiers cannot be combined with --repo` |
| `2` | `arcanum: not a directory: /x/nope` (a bad `--repo` path) |
| `3` | `arcanum: unknown key 'next_step.auto.enhanse-issue'` + `hint: check the spelling, or pass --force for a key newer than this CLI` |
| `3` | `arcanum: next_step.auto.enhance-issue must be a boolean, got string "true"` + `hint: drop --string` |
| `3` | `arcanum: engine.mode must be one of shell, native, docker, got "bogus"` |
| `3` | `arcanum: version is read-only; it is managed by migrations` |
| `3` | `arcanum: auto-fix-all.ignored_check_patterns is repo-only` |
| `3` | `arcanum: auto-fix-all.ignored_check_patterns[2] is not a valid regex: <error>` |
| `3` | `arcanum: git.safe_branch must be a string, got null` + `hint: use 'config unset' to remove it` |
| `4` | `arcanum: /x/foo is not arcanum-configured (no .claude/configuration/arcanum-repo-config.json)` + `hint: run /init-claude in that repo` |
| `4` | `arcanum: claude config dir /Users/x/.claude-favni does not exist` |
| `5` | `arcanum: repo config is at 2.5.0, newer than this CLI (2.4.0)` + `hint: npm i -g arcanum-cli@latest, or pass --force` |
| `6` | `arcanum: timed out after 10s waiting for /x/foo/.claude/state/arcanum-config.json.lock` + `hint: if no arcanum process is running, remove that file` |
| `7` | `arcanum: /Users/x/.claude/arcanum-config.json is not valid JSON (line 3); refusing to overwrite it` + `hint: fix or remove the file` |

## Edge cases

- **Same file for two tiers.** Not possible: the tiers live at fixed, distinct paths.
- **Concurrent CLI writes.** Serialized by the lock; the second waits or exits `6`.
- **A global file created by the CLI** has no `.migrations.version` pointer, so it reads as `0.0.0` and later reads warn about pending global migrations until `/arcanum-migrate` stamps it.
- **Very large values.** No size limit beyond the filesystem.
- **Zero runtime dependencies.** Argument parsing is `node:util`'s `parseArgs` plus the in-house layer above, so no third-party code runs on a tool that writes into `~/.claude`.

## Shortcuts

Curated front-ends over common keys, all under `arcanum config` (`cli/lib/commands/config/shortcuts/`):

```text
arcanum config agents email                       # default + every agent's effective email
arcanum config agents email <agent>               # per-tier breakdown for one agent
arcanum config agents email set <pattern>         # git.email, e.g. you+{agent}@example.com
arcanum config agents email set <agent> <email>   # git.agents.<agent>
arcanum config agents email unset [<agent>]       # git.email, or git.agents.<agent>
arcanum config engine [shell|native|docker | --unset]                 # engine.mode
arcanum config next-step auto [<skill> [on|off | --unset]]            # next_step.auto.<skill>
arcanum config git safe-branch [<ref> | --unset]                      # git.safe_branch
arcanum config git merge-body [full|empty|coauthors | --unset]        # git.merge_body_mode
arcanum config auto-fix-all clear-context [on|off | --unset]          # auto-fix-all.clear_context
arcanum config auto-fix-all finish-on-empty-queue [on|off | --unset]  # auto-fix-all.finish_on_empty_queue
arcanum config auto-fix-all ignore-checks [list] | add <pattern>... | remove <pattern>...
arcanum config monitor-issues clear-context [on|off | --unset]        # monitor-issues.clear_context
```

| Shortcut | Key(s) | Value kind | Default write tier |
| --- | --- | --- | --- |
| `agents email` | `git.email`, `git.agents.<agent>` | string, as typed | global |
| `engine` | `engine.mode` | enum | local |
| `next-step auto <skill>` | `next_step.auto.<skill>` | boolean token | local |
| `git safe-branch` | `git.safe_branch` | string, as typed | local (the only tier) |
| `git merge-body` | `git.merge_body_mode` | enum | local |
| `auto-fix-all clear-context` | `auto-fix-all.clear_context` | boolean token | local (the only tier) |
| `auto-fix-all finish-on-empty-queue` | `auto-fix-all.finish_on_empty_queue` | boolean token | local (the only tier) |
| `auto-fix-all ignore-checks` | `auto-fix-all.ignored_check_patterns` | array of regexes | repo (the only tier) |
| `monitor-issues clear-context` | `monitor-issues.clear_context` | boolean token | local (the only tier) |

`defaultTier.js` holds these defaults in one place for the shortcuts and the [setup wizard](#setup-wizard): a key's only tier, else its shortcut's default, else `local` when allowed, else its first tier. Tuning knobs (`plan-issues.*`, `git.omit_model_coauthor`, …) get no shortcut; they stay reachable through `config set`.

### Design rules

- **Thin front-ends.** Each shortcut covers registry keys and adds nothing the generic `get`/`set`/`unset` lack, except the `agents email` resolution view and `ignore-checks`' array add/remove. Namespaces mirror the config namespaces; `agents email` stays under `agents` to leave room for more per-agent settings.
- **Single-value shortcuts** take the value positionally: no value reads, a value writes, and `--unset` removes (like `git config --unset`), so the positional slot is only ever a value and a ref named `unset` cannot collide. `--unset` with a value is a usage error. Verb shortcuts exist only where needed: `agents email [set|unset]` (two keys, `set <pattern>` and `set <agent> <email>` told apart by arity) and `ignore-checks [list|add|remove]`.
- **Writes** go to the default tier; `--global`, `--repo` or `--local` overrides it within the tiers the registry allows (`git safe-branch --repo x` is `git.safe_branch is local-only`, exit `3`).
- **Reads ignore the default tier.** Without a tier flag a read resolves like `config get`; with one it reads only that tier; `--all-tiers` works on reads.
- **Boolean tokens** are `on`/`off`/`true`/`false`, lowercase only, always stored as JSON booleans. Anything else is exit `3`, `<key> must be on or off, got "ON"`, `hint: accepted: on, off, true, false (lowercase)`. `off` stores `false` rather than removing the key, so it can shadow a lower tier's `on`; removing is `--unset`.
- **Flags.** Shortcuts accept the tier flags, the global flags, `--all-tiers` on reads only and `--lock-timeout` on writes only. They refuse `--force` and `--string` (`--force is not accepted by shortcuts (engine)`, `hint: use arcanum config set/unset <key> --force instead`): they only target known keys with known types.
- **`next-step auto <skill>`** accepts any well-formed skill name, per the registry's wildcard rule.

### Shortcut output

Single-value shortcuts have no output contract of their own: a shortcut prints exactly what its generic equivalent prints, in human and `--json` modes, with the same exit codes. Booleans print as `true`/`false`.

| Shortcut | Same as |
| --- | --- |
| `engine` | `config get engine.mode` |
| `engine native` | `config set engine.mode native --local` |
| `engine --unset` | `config unset engine.mode --local` |
| `next-step auto enhance-issue on` | `config set next_step.auto.enhance-issue true --local` |

- An unset read exits `1` and shows `(unset; default: <value>)` / the `"default"` field, as `get` does.
- A write to a tier that a higher-precedence tier still overrides adds a stderr note: `arcanum: note: local still overrides next_step.auto.enhance-issue (value: true)`.
- **`next-step auto` with no skill** lists every resolved `next_step.auto.*` key that is set, sorted by skill, as `<skill>  <value>  (<tier>)`; with a tier flag, only that tier's. It always exits `0`, prints nothing when empty, and refuses `--unset` and `--all-tiers`. JSON: `{"entries":[{"key":"next_step.auto.enhance-issue","value":false,"source":"local"}]}`.

How delegation is built:

- **Delegation.** A single-value shortcut (`singleValue.js`, and `next-step auto <skill>`) maps to a key, a default write tier and a value kind, then calls the generic subcommand's `run` with `args` and `tier` filled in. Validation, refusal order, output and JSON are therefore the generic ones, byte for byte. The `--unset` flag is a shortcut-only option, which `config.js` refuses on the generic subcommands.
- **Value parsing.** `set` accepts an optional `parseValue` in its context. Shortcuts pass one for booleans (`booleanToken.js`) and for refs and emails (stored as typed); enums keep the generic parser so enum refusals match `config set`'s. A parser that throws has its error deferred to the registry step of `prepareWrite`, so a missing target (`4`) or a malformed file (`7`) still wins over a bad token (`3`).
- **Shadowed-tier note.** `writeValue` shares one memoized `resolveTargets` with the delegated `set`, then reads the higher-precedence tiers (strict `readTier`, silent on malformed files) and prints the note through `output.note`.
- **`next-step auto`** without a skill reads the tiers with `readTiers` and resolves every `next_step.auto.*` child (first non-`null` value wins).

### `agents email`

**Resolution** matches `arcanum/_lib/agent_email.sh`, so the CLI shows what commits will actually use: tiers local → repo → global; within a tier `git.agents.<agent>` before `git.email`; a tier is fully resolved before the next, so a higher-tier `git.email` beats a lower-tier `git.agents.<agent>`; `null` counts as absent; `{agent}` is replaced by the agent name; an explicit `""` at the winning tier and key stops the chain and means the model's email. With no value anywhere, the commit also uses the model's email, which the CLI cannot know, so it shows `(model default)`.

**Agents listed:** every agent with a non-`null` `git.agents.<agent>` in any tier, plus every `.claude/agents/*.md` basename in the target repo (other files are ignored). Configured agents not in the repo are marked `(not in this repo)`; outside a repo only configured agents are listed. Rows are sorted by name. An agent name must match `[A-Za-z0-9_-]+`.

**Listing** (`agents email`, always exit `0`):

```text
default  you+{agent}@example.com   (global: git.email)

agent      effective email            from
architect  you+architect@example.com  global git.email
node       node-bot@example.com       repo   git.agents.node
reviewer   rev@example.com            global git.agents.reviewer   (not in this repo)
```

```json
{"default":{"set":true,"value":"you+{agent}@example.com","source":"global"},
 "agents":[{"agent":"node","email":"node-bot@example.com","source":"repo","key":"git.agents.node","in_repo":true}]}
```

- With no `git.email`, the first line is `default  (unset)`. When the model default applies, `email`, `source` and `key` are `null` and the row shows `(model default)`; when it applies because of an explicit `""`, `source` and `key` name where the empty value sits and the row shows `(empty at repo: git.agents.node)`. Outside a repo, `in_repo` is `null`.

**Detail** (`agents email <agent>`): both keys in every tier, the resolved one marked `<- resolved` (or `<- resolved (empty: model default)`), set but losing ones `(shadowed)`, and a tier with no target `(no target)`. It exits `1` when the model default would apply, like `get`.

```text
local   git.agents.node  -
        git.email        -
repo    git.agents.node  node-bot@example.com      <- resolved
        git.email        -
global  git.agents.node  -
        git.email        you+{agent}@example.com   (shadowed)
```

JSON: `{"agent":"node","resolved":{"email":…,"source":…,"key":…},"tiers":{"local":{"agents":{"set":…,"value":…},"email":{…},"file":…},…}}`, with `"file": null` for a tier with no target and every `resolved` field `null` when nothing resolves.

The listing and the detail always show every tier, so they refuse tier flags, `--all-tiers` and `--unset`.

**Writes.** `set` and `unset` default to the global tier; a tier flag overrides it. Their output is `config set`/`config unset`'s, with the shadowed-tier note on `set`. Because `set` and `unset` are verbs in that position, an agent literally named `set` or `unset` can only be read and written through the generic `config get/set git.agents.<agent>`.

How it is built: resolution goes through `AgentEmail#resolve` (`ConfigChain#readWithSource`), never through its own loop. `ConfigChain` gets `CLAUDE_CONFIG_DIR` from the resolved account. Outside a repo, a small `ConfigChain` subclass drops the repo and local files, so nothing is read from a non-repo cwd. The per-tier detail and the agent discovery read the tiers with `readTiers` (`allTiers: true`, so `file: null` marks a tier with no target).

### `ignore-checks`

At runtime `auto-fix-all.ignored_check_patterns` is read only from the repo tier (`RepoConfig.getIgnoredCheckPatterns`), and its entries are case-insensitive regexes (`PrChecker`), not globs. The shortcut follows both:

- **Repo tier only.** `--local` and `--global` are exit `3` (`auto-fix-all.ignored_check_patterns is repo-only`), as for the generic `config set`/`unset` of this key. `--repo` is accepted.
- **Syntax.** `ignore-checks` or `ignore-checks list` lists; `add <pattern>...` and `remove <pattern>...` edit. `add`/`remove` with no pattern is a usage error; use `--` before patterns starting with `-`. `--unset` is refused (use `config unset auto-fix-all.ignored_check_patterns --repo`), and so is `--force`, so a repo ahead of the CLI can only be edited through the generic `config set --force`.
- **Semantics.** Patterns match by exact string. `add` appends in the order given and skips patterns already present; `remove` skips missing ones. A call that changes nothing exits `0` with `"changed": false`. An absent key counts as `[]`, and removing the last pattern leaves `[]`; `remove` on an absent key writes nothing.
- **Validation.** Each pattern given to `add` must compile with `new RegExp(p, 'i')`; one invalid pattern is exit `3` (`auto-fix-all.ignored_check_patterns[1] is not a valid regex: Unterminated group`) and nothing is written, not even the valid ones. `remove` does not validate, so a stale invalid pattern can still be removed.
- **Not an array.** A stored value that is not an array makes `list`, `add` and `remove` exit `3` with `hint: fix it with: arcanum config set auto-fix-all.ignored_check_patterns '[...]' --repo`.
- **Output.** `list` prints one pattern per line (nothing for none); JSON `{"key":…,"tier":"repo","file":…,"patterns":[…]}`. `add`/`remove` print one line per distinct pattern given: `added '^codacy' to auto-fix-all.ignored_check_patterns (repo: <file>)`, `removed '…' from …`, `'…' already present` or `'…' not present`. Their JSON is the `config set` shape, with the whole arrays as `value` and `previous.value`, plus `"added"` and `"removed"` listing the patterns actually changed.
- `/init-claude` (`InitClaudeSetCiIgnoredPatterns`) replaces the whole list; the shortcut edits it incrementally. Both write the same file under the same lock.

How it is built: `add`/`remove` go through `prepareWrite` (target, file, registry — tier and, for `add`, `format: regex` over the given patterns — then skew) and then `writeKey`'s `update` op, which calls `RepoConfigWriter#update`: the `mutate` callback re-reads the array inside the lock, refuses a non-array, appends or removes, and returns the new array, so concurrent `add`s never lose updates. A remove on an absent key throws an internal no-change marker, so the file isn't created.

## Setup wizard

`arcanum config setup [<section>...] [--lock-timeout <seconds>]` walks a new user through the core onboarding settings. Operational toggles stay shortcut-only.

### Coverage and order

Sections always run in this order (`SETUP_SECTIONS` in `KeyRegistry.js`), whatever order they are given in; duplicates are ignored and an unknown section is a usage error with `hint: sections: identity, engine, git, flow, ci`. No argument runs them all.

| Section | Keys |
| --- | --- |
| `identity` | `git.email`, then, behind `customise per-agent emails? [y/N]`, one `git.agents.<agent>` per agent in the repo's `.claude/agents/`, each showing what it currently resolves to |
| `engine` | `engine.mode` |
| `git` | `git.safe_branch`, then `git.merge_body_mode` |
| `flow` | `next_step.auto.<skill>` for `enhance-issue`, `discuss-issue` and `auto-plan-issue` |
| `ci` | `auto-fix-all.ignored_check_patterns` |

The list is registry-driven: the wizard asks exactly the entries of `shared/lib/config/keys.json` that carry a `setup` field (`{section, order, prompt, instances?}`, see [the key registry](shared-state-and-configuration.md#the-key-registry)), ordered by section, then `order`. A wildcard entry's `setup.instances` lists the concrete keys to ask; `git.agents.<agent>` instead takes its instances from the repo's agents. Adding a key to the wizard is a registry edit. The wizard shows each key's `description`; `setup.prompt` is not displayed today.

### Targets

- Without a configured repo, the per-agent overrides, the `ci` section and every item whose default tier is not `global` are dropped, with one `arcanum: note:` per affected section (`skipping the ci section: no repo at <path>`). In practice only `git.email` is left. An unconfigured repo adds the note `run /init-claude in <root>`.
- If nothing is left, the wizard exits `4`: `nothing to set up: every requested setting needs a configured repo (…)`.

### Terminal

- The wizard needs stdin and stderr to be TTYs; otherwise it exits `2` with `config setup needs an interactive terminal` and `hint: use arcanum config set / the shortcuts instead`. `--json` is a usage error (`--json is not accepted by setup: it is interactive`), checked first. Tier flags are not accepted.
- Every prompt, note and the summary go to stderr, so stdout stays results-only (and stays empty).

### Per-setting flow

```text
engine.mode — Script engine used to run migrated skill entrypoints
  current: native (repo)
  new value [shell/native/docker, Enter keeps, - unsets]: shell
  tier [local/repo/global] (local):
  set engine.mode = "shell" at local (/x/foo/.claude/state/arcanum-config.json)? [Y/n]
```

1. Show the key, its description and its current resolved value and source (or `(unset; default: …)`).
2. Ask the value: Enter keeps it (nothing else is asked or written), `-` unsets it. Enums show their choices inline; booleans accept `y`/`n` plus the shortcut tokens; strings are stored as typed; anything else parses like `config set`. A value failing validation prints the error and asks again, instead of exiting `3`.
3. Ask the tier among the ones the registry allows, defaulting to `defaultTier(key)`. Single-tier keys skip the question. An invalid tier asks again.
4. If a higher-precedence tier holds a value, print `arcanum: note: <tier> still overrides this (value: …)`. Then show the exact write and ask `[Y/n]` (`y`, `yes`, `n`, `no`, Enter for yes). Declining records the setting as kept.
5. Write at once, through the generic `set`/`unset` body.

The `ci` section shows the current list and loops over `[a]dd / [r]emove / [d]one` (Enter is done). Each pattern is validated as a case-insensitive regex, checked for presence, confirmed and written like `ignore-checks add`/`remove`, then the new list is shown.

### Errors, interrupts and summary

- A write error (lock timeout, skew, malformed file, I/O) is printed, the setting is recorded as failed, and the wizard goes on. The exit code is the first failure's, or `0`.
- Ctrl-C or EOF (Ctrl-D, stdin closed) stops the wizard with exit `130`. Settings already written stay written: each write is atomic, and a Ctrl-C during a write releases the lock first.
- A summary goes to stderr on every exit path once the questions have started: written (key, tier, old -> new), kept, failed (with the reason), and, when interrupted, not reached.

```text
summary
  written      engine.mode            local   native -> shell
  kept         git.safe_branch        local   origin/main
  failed       git.merge_body_mode    local   timed out after 10s waiting for …
  not reached  next_step.auto.*, auto-fix-all.ignored_check_patterns
```

### How it is built

- **Items.** `setupItems` takes every registry entry with `setup`, sorted by `SETUP_SECTIONS` index then `setup.order`, and expands `setup.instances` into concrete keys. `git.agents.<agent>` stays one `agents` item, expanded from `repoAgents(root)` once the user opts in. Each item's default tier comes from `defaultTier(key)`.
- **Targeting.** Targets are resolved once (`memoizeTargets`); `availableItems` drops the repo-dependent items and prints the notes.
- **Writes.** `set.js` and `unset.js` expose their bodies as `applySet`/`applyUnset`, and `ignoreChecks.js` exposes `updatePatterns`; the wizard calls them with the chosen tier and a fixed `parseValue`, so the target, file, registry, skew and lock checks are the generic code. Each write takes and releases its own lock; no lock is held while prompting.
- **Errors.** A `ValidationError` while typing a value re-asks. A write failure is printed with `reportError`, recorded as failed, and the wizard goes on.
- **Interrupts.** The prompter (`cli/lib/prompter.js`) rejects with `Interrupted` on EOF or SIGINT, owning `SIGINT` only while a question is open; the wizard prints the summary and returns `130`. During a write, `writeKey`'s own SIGINT handler runs with signal hooks whose `exit` prints the summary first.
- **Summary.** Printed once (`summary.js`). Items with no recorded result are "not reached"; a wildcard entry none of whose instances was reached collapses to `next_step.auto.*` / `git.agents.*`. Read warnings are printed once per run, not once per setting.

## Specs

- `cli/spec/support/fixtures.js` builds temp git repos and tier files; `cli/spec/support/cli.js` runs `main.run` in-process against them, with an injected env and cwd.
- Every exit code and precedence pair, each malformed-file kind (with byte-unchanged checks on refused writes), each value-parsing row with and without `--string`, the JSON shapes, the lock cases (held by a live fake owner, `--lock-timeout 0`, acquired after release, no "seems stuck" warning) and SIGINT each have a spec.
- `setup_spec` drives the wizard with a scripted prompter (`cli/spec/support/prompter.js`, with `EOF`/`SIGINT` answers) and `deps.isInteractive`; `fakeIo` can also fake a TTY stdin. One bundle smoke spec checks the real no-TTY refusal.
- The shortcut specs (`cli/spec/lib/commands/config/shortcuts/`) use `cli/spec/support/shortcuts.js`, which re-seeds the tiers before each run, so a shortcut and its generic equivalent run against the same files and their stdout, stderr and exit code are compared directly. `agentsEmail_spec` runs the `AgentEmail` shell/native parity table (`cli/spec/support/agentEmailFixtures.js`, a copy of `shared/spec`'s, since `cli/` never imports `shared/spec/**`).

## Alternatives considered

- **Renaming `core/bin/arcanum` to free the name.** Rejected: it touches `engine_dispatch.sh`, the Docker image and older installs for no user benefit, since the dispatcher is never on `PATH`.
- **One binary for internal and user commands.** Rejected: it mixes two argv conventions and exposes internal commands to users.
- **Shipping the CLI inside each Arcanum install**, with a `PATH` migration. Rejected: users with several installs would get competing clients.
- **Skew against the Arcanum install's own version.** Rejected: the CLI cannot reliably locate the install serving a repo, and the tier pointers are what describe the files' shape.
- **A CLI framework (`commander`, `yargs`).** Rejected: supply-chain surface on a tool that writes into `~/.claude`, and it breaks the zero-runtime-dependency rule. `commander` is the upgrade path if the surface grows a lot.
- **Defaulting `set` to `--local`, like git.** Rejected: with a committed tier and a shared one, an implicit tier makes accidental writes too easy.
- **Only exit codes `1`/`2`, like git.** Rejected: scripts need to tell "nowhere to write" and "corrupted file" apart from a typo.
- **Overwriting malformed files, like `RepoConfigWriter`.** Rejected: it destroys user data the CLI cannot read.
- **Waiting forever for the lock, like the skills.** Rejected: a silent hang is worse than a clear timeout.
- **Letting `--force` bypass read-only keys.** Rejected: the version pointers drive migrations.
- **Verbs (`show`/`set`/`unset`) on every shortcut.** Rejected: positional values read better, and verbs collide with values.
- **Unsetting via `off`.** Rejected: `off` must be able to shadow a lower tier's `on`.
- **A shortcut-specific output contract.** Rejected: two contracts to test and keep in sync.
- **`git email` instead of `agents email`, or listing only configured agents.** Rejected: the question is what each repo agent commits as, including agents with no override.
- **Every tier, or merged arrays, for `ignore-checks`.** Rejected: the runtime reads only the repo tier.
- **Collecting every wizard answer and writing at the end.** Rejected: Ctrl-C would lose everything, and a late error would hide what applied.
- **A hardcoded wizard key list.** Rejected: it drifts from the registry.

## Future work

- **`list --json` and registry defaults.** Whether `list` should also report defaults of keys unset in every tier; `get` already reports them in `default`.
- **Splitting the `--repo` overload** into separate flags (e.g. `--repo-path` for targeting), if the syntactic path/tier rule proves confusing.
- **Per-key skew granularity.** Refusing a write to a key touched by a pending migration, rather than only warning per tier; see [the key registry](shared-state-and-configuration.md#the-key-registry).

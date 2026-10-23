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
| `1` | `error` | `CliError` | Generic error: an unexpected failure, a shared `ConfigError` with no dedicated mapping (`UNREGISTERED_KEY` included), or a Node.js below the floor (printed by `cli/bin/arcanum`, before any JSON mode exists). |
| `2` | `usage` | `UsageError` | Unknown command, subcommand or flag; bad arity; conflicting or missing tier flags; bad key syntax; bad `--lock-timeout`; a bad `--repo` or `--claude-config-dir` path. `parseArgs` errors (`ERR_PARSE_ARGS_*`) map here too. |
| `3` | `validation` | `ValidationError` | Key registry refusal: unknown key, wrong type, enum, format, tier not allowed, read-only key. |
| `4` | `target_unavailable` | `TargetUnavailableError` | Nowhere to read or write the requested tier: no repo, an unconfigured repo, or an unresolved, missing or non-directory Claude config dir. One code for every tier. Never bypassed by `--force`. |
| `5` | `version_skew` | `VersionSkewError` | A write to a tier whose pointer is ahead of the CLI, without `--force`. |
| `6` | `lock_timeout` | `LockTimeoutRefusal` | The write lock was not acquired within `--lock-timeout`. A shared `LOCK_TIMEOUT` maps here too. |
| `7` | `file` | `FileError` | A malformed tier file the CLI refuses to write over, or an I/O error. The shared `NOT_AN_OBJECT` and `INVALID_JSON` codes and any Node errno error (`EACCES`, `ENOSPC`, `EISDIR`, …) map here too. |
| `130` | — | — | Interrupted by Ctrl-C (`SIGINT`) during a write or the setup wizard. |

Each `CliError` carries an optional `hint`, printed as a `hint:` line (see [Output](#output)).

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

## Argument parsing

- `parseArgs` only knows boolean `--repo` (the tier flag). Before it runs, `extractRepoTarget` removes the targeting forms (`--repo=<path>`, and `--repo <token>` when the token has a `/` or is `.`/`..`), stopping at `--`.
- The command name is the first positional, skipping the values of every string option of every command, so `--claude-config-dir /d config ...` and `--repo ./x config ...` work.
- The `config` namespace merges the tier flags and the union of all subcommand flags into `parseArgs`. Which subcommand accepts which flag is checked afterwards (`checkFlags`), so the error names the flag and the subcommands that take it.

## Refusal order

Each command runs its checks in the spec's precedence order instead of collecting errors and sorting them:

1. Usage (`2`): `parseArgs`, flag sets, tier exclusivity, arity, key syntax (in `config.js`), then the required tier and `--lock-timeout` (in `set`/`unset`). Bad `--repo`/`--claude-config-dir` paths also raise `2`, during targeting, before any tier file is read.
2. Target (`4`): `checkWriteTarget` for writes; for reads, an explicit `--repo`/`--local` with no repo, or a Claude config dir that is not a directory.
3. File (`7`): `readTierForWrite` on the target file. A non-object on the key's path is caught later, by the shared writer (`ConfigError('NOT_AN_OBJECT')`), before anything is written.
4. Registry (`3`): `validateSet`/`validateUnset` (`KeyRegistry#lookup`/`#check`, plus the precision and broken-JSON-array rules).
5. Skew (`5`): `checkWriteSkew` on the target tier's pointer only.
6. Lock (`6`): the shared `Lock`'s bounded acquire.

`--force` only turns the unknown-key refusal and the skew refusal into a bypass, which the JSON output reports as `"forced": true`.

## Reads

- `get` and `list` read the tier files themselves with `readTierTolerant`, in local → repo → global order, and apply the same present-and-non-`null` rule as `ConfigChain`. They don't call `ConfigChain#readWithSource` directly, because it reads malformed files silently (the CLI must warn), needs a repo path (the CLI must work outside a repo), and only resolves namespaced keys (the CLI also reads top-level keys such as `version`). Two specs keep them aligned: `tierFiles_spec` checks the paths against `ConfigChain`'s, and `get_spec` checks resolution against `readWithSource`.
- With no tier and no repo, only the global tier is read, with a note. An unresolved or missing Claude config dir reads as an empty global tier, with a warning.
- A tier whose pointer is ahead of the CLI warns. A tier behind it warns only when its scope has migrations between the pointer and the CLI version. A pointer behind the CLI with nothing pending is reported as `up_to_date`.
- `info` uses the strict `readTier` and reports the malformed, missing and skew states instead of warning. It never fails on environment state.

## Writes

- `RepoConfigWriter#write`/`#unset` do the actual write: nested `setpath`, kept siblings, no pruning, jq-identical serialization, atomic `<file>.tmp` + rename, under `<file>.lock`. A known key of two or more segments is passed as `namespace` + the rest. A one-segment key, or a `--force`d unknown key, uses the top-level form. The tier files have no legacy file.
- The CLI wraps the shared `Lock` before handing it to the writer, so `acquire` always runs with `warn: false` (the timeout message replaces `Lock`'s "seems stuck" warning) and the CLI knows whether the lock is held. `timeoutMs` is `--lock-timeout` × 1000.
- A SIGINT handler is installed for the duration of the write. It releases the lock if it is held (the release is owner-checked) and exits `130`.
- `unset` of a key that is not in the file skips the writer: nothing is locked or written, `"changed": false`.

## Shortcuts

The contract is [Shortcuts and Setup](../specs/arcanum-cli/shortcuts-and-setup.md). The design point is that shortcuts add no output contract of their own:

- **Delegation.** A single-value shortcut (`engine`, `git safe-branch`, `git merge-body`, the `clear-context`/`finish-on-empty-queue` toggles, `next-step auto <skill>`) maps to a key, a default write tier and a value kind, then calls the generic subcommand's `run` with `args` and `tier` filled in: no value → `get`, a value → `set` (at the default tier unless a tier flag is given), `--unset` → `unset`. Validation, refusal order, output and JSON are therefore the generic ones, byte for byte. The `--unset` flag is a shortcut-only option, which `config.js` refuses on the generic subcommands.
- **Value parsing.** `set` accepts an optional `parseValue` in its context. Shortcuts pass one for booleans (`booleanToken.js`) and for refs and emails (stored as typed); enums keep the generic parser so enum refusals match `config set`'s. A parser that throws has its error deferred to the registry step of `prepareWrite`, so a missing target (`4`) or a malformed file (`7`) still wins over a bad token (`3`).
- **Shadowed-tier note.** `writeValue` shares one memoized `resolveTargets` with the delegated `set`, then reads the higher-precedence tiers (strict `readTier`, silent on malformed files) and prints `arcanum: note: <tier> still overrides <key> (value: …)` through `output.note`.
- **`next-step auto`** without a skill reads the tiers with `readTiers` and resolves every `next_step.auto.*` child (first non-`null` value wins), sorted by skill.
- **`agents email`** resolves through `AgentEmail#resolve` (`ConfigChain#readWithSource`), never through its own loop. `ConfigChain` gets `CLAUDE_CONFIG_DIR` from the resolved account. Outside a repo, a small `ConfigChain` subclass drops the repo and local files, so nothing is read from a non-repo cwd. The per-tier detail and the agent discovery read the tiers with `readTiers` (`allTiers: true`, so `file: null` marks a tier with no target). Agents come from `git.agents.*` in any tier plus the repo's `.claude/agents/*.md`.
- **`ignore-checks`** goes through `prepareWrite` (target, file, registry — tier and, for `add`, `format: regex` over the given patterns — then skew) and then `writeKey`'s `update` op, which calls `RepoConfigWriter#update`: the `mutate` callback re-reads the array inside the lock, refuses a non-array, appends or removes, and returns the new array. A remove on an absent key throws an internal no-change marker, so the file isn't created.

## Setup wizard

The contract is [Shortcuts and Setup → `arcanum config setup` wizard](../specs/arcanum-cli/shortcuts-and-setup.md#arcanum-config-setup-wizard).

- **Items.** `setupItems` takes every registry entry with `setup`, sorted by `SETUP_SECTIONS` index then `setup.order`, and expands `setup.instances` into concrete keys. `git.agents.<agent>` stays one `agents` item, expanded from `repoAgents(root)` once the user opts in. Each item's default tier comes from `defaultTier(key)`.
- **Targeting.** Targets are resolved once (`memoizeTargets`). Without a configured repo, the `agents` item, the `ci` section and every item whose default tier is not `global` are dropped, with one `note:` per section; nothing left is exit `4`.
- **Writes.** `set.js` and `unset.js` expose their bodies as `applySet`/`applyUnset`, and `ignoreChecks.js` exposes `updatePatterns`; the wizard calls them with the chosen tier and a fixed `parseValue`, so the target, file, registry, skew and lock checks are the generic code. Each write takes and releases its own lock; no lock is held while prompting.
- **Errors.** A `ValidationError` while typing a value re-asks. A write failure is printed with `reportError`, recorded as failed, and the wizard goes on; the exit code is the first failure's.
- **Interrupts.** The prompter rejects with `Interrupted` on EOF or SIGINT; the wizard prints the summary and returns `130`. During a write, `writeKey`'s own SIGINT handler runs with signal hooks whose `exit` prints the summary first.
- **Summary.** Every exit path after the first question prints it once, on stderr. Items with no recorded result are "not reached"; a wildcard entry none of whose instances was reached collapses to `next_step.auto.*` / `git.agents.*`.

## Specs

- `cli/spec/support/fixtures.js` builds temp git repos and tier files; `cli/spec/support/cli.js` runs `main.run` in-process against them, with an injected env and cwd.
- Every exit code and precedence pair, each malformed-file kind (with byte-unchanged checks on refused writes), each value-parsing row with and without `--string`, the JSON shapes, the lock cases (held by a live fake owner, `--lock-timeout 0`, acquired after release, no "seems stuck" warning) and SIGINT each have a spec.
- `setup_spec` drives the wizard with a scripted prompter (`cli/spec/support/prompter.js`, with `EOF`/`SIGINT` answers) and `deps.isInteractive`; `fakeIo` can also fake a TTY stdin. One bundle smoke spec checks the real no-TTY refusal.
- The shortcut specs (`cli/spec/lib/commands/config/shortcuts/`) use `cli/spec/support/shortcuts.js`, which re-seeds the tiers before each run, so a shortcut and its generic equivalent run against the same files and their stdout, stderr and exit code are compared directly. `agentsEmail_spec` runs the `AgentEmail` shell/native parity table (`cli/spec/support/agentEmailFixtures.js`, a copy of `shared/spec`'s, since `cli/` never imports `shared/spec/**`).

# Arcanum CLI internals

How the user-facing `arcanum` CLI (`cli/`, the npm package `arcanum-cli`) is put together. The contract it implements — syntax, value parsing, exit codes, output and JSON shapes — is the [Arcanum CLI spec](../specs/arcanum-cli.md) and its [Command Surface](../specs/arcanum-cli/command-surface.md) part; this doc does not repeat it. End-user docs: [the guide](../../guides/arcanum-cli.md) and [`cli/README.md`](../../../cli/README.md).

`cli/` is owned by the `client` agent. It is not `core/bin/arcanum`, the internal dispatcher the skills call.

## Runtime path

1. `cli/bin/arcanum` (unbundled, ES2020) checks the Node floor, then imports `cli/dist/arcanum.mjs`.
2. The bundle's entry is `cli/lib/main.js`, which `cli/scripts/build.mjs` bundles with `esbuild` together with the `shared/lib/` files it imports. The build injects `__ARCANUM_CLI_VERSION__`, `__ARCANUM_NODE_FLOOR__` and `__ARCANUM_MIGRATION_VERSIONS__` through `define`. A source run, as in the specs, sees `0.0.0-dev`, a `>=22.13.0` fallback (kept equal to `engines.node` by a spec) and empty migration lists.
3. `main.run(argv, { io, env, cwd, version, migrationVersions, deps })` never throws: every error goes through `output.reportError`, which uses `exitCodes.exitCodeForError` and returns the exit code. Everything a command touches (streams, env, cwd, versions, `execFileAsync`, `Lock`, signal hooks, Node version) can be injected, so specs never touch the real `~/.claude`, the real cwd or the real process.

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
| `lib/booleanToken.js` | The shortcuts' `on`/`off`/`true`/`false` tokens, with the exit-`3` hint. |
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

## Specs

- `cli/spec/support/fixtures.js` builds temp git repos and tier files; `cli/spec/support/cli.js` runs `main.run` in-process against them, with an injected env and cwd.
- Every exit code and precedence pair, each malformed-file kind (with byte-unchanged checks on refused writes), each value-parsing row with and without `--string`, the JSON shapes, the lock cases (held by a live fake owner, `--lock-timeout 0`, acquired after release, no "seems stuck" warning) and SIGINT each have a spec.
- The shortcut specs (`cli/spec/lib/commands/config/shortcuts/`) use `cli/spec/support/shortcuts.js`, which re-seeds the tiers before each run, so a shortcut and its generic equivalent run against the same files and their stdout, stderr and exit code are compared directly. `agentsEmail_spec` runs the `AgentEmail` shell/native parity table (`cli/spec/support/agentEmailFixtures.js`, a copy of `shared/spec`'s, since `cli/` never imports `shared/spec/**`).

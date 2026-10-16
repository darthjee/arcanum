# Arcanum CLI: Command Surface

Part of the [Arcanum CLI spec](../arcanum-cli.md).

## Purpose

Define the generic `arcanum config` layer, which works like `git config`, plus the meta commands and global flags. This part is the contract for every command: syntax, value parsing, `--force`'s scope, `--repo` normalization, exit codes, output and `--json` shapes, error wording, missing and malformed tier files, and lock contention. The curated shortcuts built on top of it are in [Shortcuts and Setup](shortcuts-and-setup.md).

## Decisions

### Namespace

- Everything configuration-related lives under **`arcanum config ...`**.
- The top level has only meta commands (`--help`, `--version`), so `arcanum <command>` stays free for later, non-config features.

### Generic commands

```text
arcanum config get <key> [--global|--repo|--local] [--all-tiers]
arcanum config set <key> <value> (--global|--repo|--local) [--string] [--force] [--lock-timeout <seconds>]
arcanum config unset <key> (--global|--repo|--local) [--force] [--lock-timeout <seconds>]
arcanum config list [--global|--repo|--local]
arcanum config info
```

Each command also accepts the [global flags](#global-flags) and `--help`.

- **`get`** without a tier prints the resolved value and its source tier, resolving local → repo → global like `/arcanum-check-config`. With a tier flag, it reads only that tier. `--all-tiers` shows every tier's value, including shadowed ones.
- **`set` / `unset`** require a tier. There is no implicit default, so nothing is ever written by accident to the committed repo file or the shared global file. Omitting the tier is a usage error.
- **`list`** prints flattened dotted keys, for every tier or only the given one. Known keys show their registry description.
- **`info`** describes the environment: the resolved `CLAUDE_CONFIG_DIR` and its source, the repo root, each tier file and its version pointer, and the CLI version. Its fields and behaviour are defined in the index's [`arcanum config info`](../arcanum-cli.md#arcanum-config-info) section; its JSON shape is [below](#json-output).

### Syntax rules

- **Flag placement.** Global flags and command flags may appear before or after the subcommand and its positionals: `arcanum --json config get k` and `arcanum config get k --json` are equivalent.
- **Tier flags are mutually exclusive.** `--global`, `--repo` and `--local` together (any two) is a usage error (exit `2`).
- **`--repo` is overloaded on purpose.** Without a value it is the repo tier flag; with a path (`--repo <path>` or `--repo=<path>`) it is the global [targeting](#global-flags) flag. To target a repo **and** select the repo tier, pass both: `--repo=<path> --repo`. The rule is syntactic, never based on what exists on disk: `--repo=<path>` is always the targeting form; `--repo <token>` is the targeting form when `<token>` contains a `/` or is `.` or `..` (keys never do); anything else, including a trailing `--repo`, is the tier form. A targeting path that does not exist is then a usage error.
- **`--all-tiers`** is accepted only by `get`, and is a usage error combined with a tier flag.
- **`--string`** is accepted only by `set`.
- **`--`** ends option parsing. Use it for values that start with `-`: `arcanum config set k --global -- -1`.
- **Arity.** Missing or extra positionals are usage errors. `set` needs exactly `<key> <value>`; `get` and `unset` exactly `<key>`; `list` and `info` none.
- **Unknown flags** are usage errors (`parseArgs` strict mode).

### Keys

- Keys are dotted paths, e.g. `next_step.auto.enhance-issue`.
- A key segment may not be empty: `a..b`, a leading `.` and a trailing `.` are usage errors.
- Writes use the same nested `setpath` semantics as `global_config_write` and `RepoConfigWriter`: missing intermediate objects are created and sibling keys are kept.
- `set` and `unset` validate the key against the [Key Registry](key-registry.md): key, type, enum, tier and read-only-ness. Unknown keys are refused unless `--force` is passed.
- A registry tier restriction can make a key single-tier. For example, `auto-fix-all.ignored_check_patterns` is repo-only, because the runtime reads it only from the repo tier; `set`/`unset` of it with `--global` or `--local` is exit `3`.
- `unset` of a key that is not set in the target tier is a no-op that exits `0`, like `rm -f`; the JSON output reports `"changed": false`.
- `unset` of the last key in an intermediate object leaves the now-empty parent object in place, matching the shell helpers. It does not prune.

### Value parsing

- `true`, `false`, numbers, `null`, JSON arrays and JSON objects are parsed as JSON. Anything else is a string.
- `--string` forces the value to be stored as a string. This matters because, for example, `next_step.auto.*` accepts only the JSON boolean `true`, not the string `"true"`.
- After parsing, the value is checked against the registry type and enum of a known key. A mismatch is exit `3`. An unknown key passed with `--force` skips this check.
- `null` on a **known** key is a type mismatch (exit `3`, `hint: use 'config unset' to remove it`). Storing `null` is therefore only possible for an unknown key with `--force`. The registry-specific checks (order, empty strings, number ranges, regex) are in [Key Registry](key-registry.md#validation).

Edge cases:

| Input | Without `--string` | With `--string` |
| --- | --- | --- |
| `''` (empty) | the empty string `""` | `""` |
| `true` / `false` | boolean | `"true"` / `"false"` |
| `42`, `-1.5`, `1e3` | number | string |
| `9007199254740993` (beyond `Number.MAX_SAFE_INTEGER`) | refused, exit `3`: precision would be lost. Pass `--string` to store it as text. | string |
| `null` | JSON `null`. For a known key this is exit `3` (see above); for an unknown key with `--force` it is stored as a value. This is **not** `unset`: the key stays present. | `"null"` |
| `[1,2]`, `{"a":1}` | array / object | string |
| `"quoted"` (JSON string literal) | the string `quoted`, quotes removed | the string `"quoted"`, quotes kept |
| `[1,` or `{a:1}` (looks like JSON, is not) | stored as a string, unless the key's registry type is array, in which case exit `3` with the JSON parse error | string |
| ` 42 ` (surrounding whitespace) | the string ` 42 `; values are never trimmed | string |

- "Looks like JSON" means the value starts with `[`, `{` or `"`, after no trimming.
- A JSON object value replaces the whole subtree at that key; it is not merged.

### `--force` scope

`--force` is accepted only by `set` and `unset`.

| Refusal | Exit | Bypassed by `--force` |
| --- | --- | --- |
| Unknown key | `3` | **Yes** |
| Version skew: target tier ahead of the CLI | `5` | **Yes** |
| Wrong type or enum for a known key | `3` | No |
| Wrong tier for a known key | `3` | No |
| Read-only key (`version`, `migrations.version`) | `3` | No: those pointers belong to migrations and `init-claude` |
| Usage error | `2` | No |
| Target unavailable | `4` | No |
| Lock timeout | `6` | No |
| Malformed tier file, I/O error | `7` | No |

`--force` is the escape hatch for keys newer than the installed CLI and for experimental keys. It never weakens checks on keys the CLI knows, and never touches environment problems.

### `--repo` normalization

- The target is the current directory, or the path given to `--repo <path>`.
- The path is normalized with `git -C <path> rev-parse --show-toplevel`, run through `execFile` with an argument array.

| Target | Result |
| --- | --- |
| Repo root | That root. |
| Subdirectory of a repo | The repo root. |
| Inside a worktree | The worktree's own root, since each worktree has its own `.claude/state/`. |
| Bare repo, or not inside a repo | "No repo". |
| `git` not on PATH | "No repo", with a stderr warning. |
| Non-existent path, or a file | Usage error (exit `2`), with `RepoPath`'s messages (`core/lib/utils/file/RepoPath.js`). |

What each repo state means for reads and writes is in the index's [Targeting](../arcanum-cli.md#targeting) section and is not repeated here.

### Exit codes

The CLI uses a small dedicated set. Identifiers are the constant names in `cli/lib/`.

| Code | Identifier | Meaning |
| --- | --- | --- |
| `0` | `EXIT_OK` | Success. |
| `1` | `EXIT_ERROR` | Generic error. Also `get` on an unset key, like `git config`, and a Node.js below the [floor](../arcanum-cli.md#runtime). |
| `2` | `EXIT_USAGE` | Usage error: unknown flag or command, bad arity, conflicting flags, bad `--repo` or `--claude-config-dir` path, missing TTY for `config setup`. |
| `3` | `EXIT_VALIDATION` | Validation error against the [Key Registry](key-registry.md): unknown key, type, enum, tier, read-only. |
| `4` | `EXIT_TARGET_UNAVAILABLE` | **Target unavailable**: no repo, an unconfigured repo, or an unresolved or missing Claude config directory. |
| `5` | `EXIT_VERSION_SKEW` | **Version skew refused**: a write to a tier whose pointer is ahead of the CLI, without `--force`. |
| `6` | `EXIT_LOCK_TIMEOUT` | The write lock could not be acquired within `--lock-timeout`. |
| `7` | `EXIT_FILE` | Malformed tier file, or an I/O error (unreadable file, permission denied, disk full). |

- Codes `4` and `5` are the numbers of the two dedicated codes the index names by meaning.
- When several refusals apply, the first in this order wins: `2`, `4`, `7`, `3`, `5`, `6`. Usage is checked before touching the filesystem, the target before its file, the file before the key, and the lock last.
- `info` always exits `0`, except on usage errors (see the index).

### Missing and malformed tier files

A tier file is **malformed** when it is not valid JSON, or is valid JSON whose top level is not an object (`null`, an array, a string, a number, a boolean).

| File state | Reads (`get`, `list`) | Writes (`set`, `unset`) to that tier |
| --- | --- | --- |
| Missing | Tier is empty. Silent. | Normal; created on first write, as the skills do. Subject to the index's targeting rules. |
| Empty (zero bytes, or whitespace only) | Tier is empty. Silent. | Normal; the file is written as if it were `{}`. |
| Invalid JSON | Stderr warning naming the file; tier treated as empty, so other tiers still resolve. | **Refused, exit `7`.** The file is left untouched. |
| Valid JSON, not an object | Same as invalid JSON. | **Refused, exit `7`.** |
| Unreadable (permissions, a directory) | Stderr warning; tier treated as empty. | **Refused, exit `7`.** |
| Not writable | Normal. | Exit `7` with the OS error. |

- **Why writes refuse.** `RepoConfigWriter._readBase` (`core/lib/utils/config/RepoConfigWriter.js`) reads a malformed file as `{}`, so writing through it would silently overwrite a corrupted user file. The CLI must never destroy user data it cannot parse, so it diverges here on purpose.
- **How.** Before calling the shared writer, the CLI reads and parses the target file itself and refuses on any malformed state. The check and the write are not atomic, but the window is the same one a hand edit already has, and the shared writer still takes the lock.
- `--force` does not bypass this. The fix is to repair or remove the file by hand.
- `get` with an explicit tier flag on a malformed file prints the warning and behaves as if the key is unset (exit `1`), so scripts see a stable code; the warning tells the human why.

### Lock contention

- Writes go through the shared `Lock` (`core/lib/utils/file/Lock.js`) on `<file>.lock`, the same protocol as `arcanum/_lib/lock.sh` (see [Lock System](../../architecture/lock-system.md)), so the CLI and running skills exclude each other.
- Unlike skills, the CLI **bounds the wait**. The default is `10` seconds; `--lock-timeout <seconds>` changes it. `0` means try once and fail if the lock is held. Negative or non-numeric values are usage errors.
- On timeout the CLI exits `6`, names the lock file, and hints at removing it by hand if no process holds it. Nothing is written.
- Reads take **no lock**. A read racing a write sees either the old or the new file, since writes replace the file whole.
- **Dependency.** Today `Lock.acquire` never gives up: it warns once after 10 failed attempts and retries forever. The CLI needs an optional bound (a timeout or a max-attempts option) on `Lock`, with skills keeping the current wait-forever default. That change is owned by `node` and is listed in the index's "Pieces introduced" table. See also [Shared Config Logic](shared-config-logic.md)'s lock-interoperability open point.
- `Lock`'s own "seems stuck" warning is not printed by the CLI; the timeout message replaces it.

### Meta commands

- `arcanum --help` and `arcanum <cmd> --help` print usage on stdout and exit `0`. Key docs in help come from the registry.
- `arcanum --version` prints the CLI version (e.g. `arcanum-cli 2.4.0`) on stdout and exits `0`. With `--json` it prints `{"version": "2.4.0"}`.
- `arcanum` with no arguments prints the top-level usage on stderr and exits `2`.

### Global flags

| Flag | Effect |
| --- | --- |
| `--repo <path>` | Targets the repo at `<path>` instead of the current directory. See [`--repo` normalization](#--repo-normalization). |
| `--claude-config-dir <dir>` | Targets that global config dir. Overrides `CLAUDE_CONFIG_DIR`. A leading `~` is expanded. |
| `--json` | Machine-readable output. |

See [Targeting](../arcanum-cli.md#targeting) for how the account and repo are resolved.

### Output

- Human-readable by default, `--json` for scripting.
- **stdout** carries only the command's result. **stderr** carries every warning, note and error, in both modes. So `--json` stdout is always either empty or exactly one valid JSON object followed by a newline.
- Human examples:

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

$ arcanum config list --repo
engine.mode = "native"   Script engine mode (shell|native)
```

- An unset key prints `(unset)`, or `(unset; default: <value>)` when the registry has a default, and exits `1`.
- `config setup` writes its prompts to stderr too, so stdout stays results-only (see [Shortcuts and Setup](shortcuts-and-setup.md#tty-requirement)).
- `get` with a tier flag prints the raw value only, so `$(arcanum config get k --repo)` is usable in shell scripts. Strings print without quotes; other values print as compact JSON.

### JSON output

Each command prints one stable object. New fields may be added; existing fields are never renamed or removed without a major version.

`get`:

```json
{"key": "engine.mode", "set": true, "value": "native", "source": "repo"}
```

- Unset: `{"key": "engine.mode", "set": false, "value": null, "source": null, "default": null}`, exit `1`.
- `default` is the registry default for a known key, or `null` when it has none or the key is unknown. It is present on every `get` output, set or not. It is an additive field under the rule above, and the [shortcuts](shortcuts-and-setup.md#output) print the same shape.
- `source` is `"local"`, `"repo"`, `"global"` or `null`. With a tier flag it is that tier.

`get --all-tiers`:

```json
{
  "key": "engine.mode",
  "resolved": {"set": true, "value": "native", "source": "repo", "default": null},
  "tiers": {
    "local":  {"set": false, "value": null, "file": "/x/foo/.claude/state/arcanum-config.json"},
    "repo":   {"set": true,  "value": "native", "file": "/x/foo/.claude/configuration/arcanum-repo-config.json"},
    "global": {"set": false, "value": null, "file": "/Users/x/.claude/arcanum-config.json"}
  }
}
```

- A tier with no target (no repo, unresolved account) has `"file": null`. Exit `1` when `resolved.set` is false.

`set` / `unset`:

```json
{"key": "next_step.auto.enhance-issue", "tier": "global", "file": "/Users/x/.claude/arcanum-config.json",
 "changed": true, "previous": {"set": false, "value": null}, "value": true, "forced": false}
```

- For `unset`, `value` is `null` and `changed` is false when the key was not set.
- `forced` is true only when `--force` actually bypassed a refusal.

`list`:

```json
{"entries": [
  {"key": "engine.mode", "tier": "repo", "value": "native", "known": true, "description": "Script engine mode (shell|native)"}
]}
```

- One entry per key per tier, so a shadowed key appears once per tier that sets it. `description` is `null` for unknown keys.
- Registry defaults for unset keys are not listed (see [Open points](#open-points)); `get` reports them in its `default` field.

`info`:

```json
{
  "cli": {"version": "2.4.0", "node": "22.14.0", "node_floor": ">=22.13.0"},
  "account": {
    "claude_config_dir": "/Users/x/.claude-favini", "source": "env",
    "file": "/Users/x/.claude-favini/arcanum-config.json", "exists": true,
    "version": "2.3.0", "skew": {"status": "behind", "pending": 1}
  },
  "repo": {
    "root": "/Users/x/projects/foo", "source": "cwd",
    "repo_config": {"file": "/Users/x/projects/foo/.claude/configuration/arcanum-repo-config.json", "exists": true,
                    "version": "2.4.0", "skew": {"status": "up_to_date", "pending": 0}},
    "local_config": {"file": "/Users/x/projects/foo/.claude/state/arcanum-config.json", "exists": false,
                     "version": "0.0.0", "skew": {"status": "behind", "pending": 3}}
  }
}
```

- `account.source` is `"flag"`, `"env"`, `"default"` or `"unresolved"`; when unresolved, `claude_config_dir`, `file`, `version` and `skew` are `null`.
- `repo.source` is `"flag"` or `"cwd"`. `repo` is `null` when no repo is found.
- `skew.status` is `"up_to_date"`, `"behind"` or `"ahead"`. A missing pointer reports `"version": "0.0.0"`.
- A malformed file reports `"malformed": true` and `"version": null`.

Errors (stderr, in `--json` mode):

```json
{"error": {"code": "target_unavailable", "exit": 4, "message": "arcanum: no repo at /x/bar; --repo and --local need a git repo", "hint": null}}
```

- `code` is the exit identifier in snake case without `EXIT_` (`usage`, `validation`, `target_unavailable`, `version_skew`, `lock_timeout`, `file`, `error`).
- `get` on an unset key is **not** an error object: it prints the normal `get` shape on stdout and exits `1`.
- Warnings in `--json` mode stay plain text on stderr; they are not JSON.

### Error messages

- One line, prefixed `arcanum: `, on stderr. An optional second line starts with `hint: `.
- Name what failed: the key, the tier and the file path, whichever apply.
- No stack traces, unless `ARCANUM_DEBUG=1` is set.
- Wording is lowercase after the prefix and has no trailing period, like git.

Examples:

| Exit | Message |
| --- | --- |
| `1` | `arcanum: Node.js >= 22.13.0 required, found 20.11.0` |
| `2` | `arcanum: set needs a tier: --global, --repo or --local` |
| `2` | `arcanum: --all-tiers cannot be combined with --repo` |
| `3` | `arcanum: unknown key 'next_step.auto.enhanse-issue'` + `hint: check the spelling, or pass --force for a key newer than this CLI` |
| `3` | `arcanum: next_step.auto.enhance-issue must be a boolean, got string "true"` + `hint: drop --string` |
| `3` | `arcanum: version is read-only; it is managed by migrations` |
| `3` | `arcanum: auto-fix-all.ignored_check_patterns is repo-only` |
| `3` | `arcanum: auto-fix-all.ignored_check_patterns[2] is not a valid regex: Unterminated group` |
| `3` | `arcanum: git.safe_branch must be a string, got null` + `hint: use 'config unset' to remove it` |
| `4` | `arcanum: /x/foo is not arcanum-configured (no .claude/configuration/arcanum-repo-config.json)` + `hint: run /init-claude in that repo` |
| `4` | `arcanum: claude config dir /Users/x/.claude-favni does not exist` |
| `5` | `arcanum: repo config is at 2.5.0, newer than this CLI (2.4.0)` + `hint: npm i -g arcanum-cli@latest, or pass --force` |
| `6` | `arcanum: timed out after 10s waiting for /x/foo/.claude/state/arcanum-config.json.lock` + `hint: if no arcanum process is running, remove that file` |
| `7` | `arcanum: /Users/x/.claude/arcanum-config.json is not valid JSON (line 3); refusing to overwrite it` + `hint: fix or remove the file` |

### Implementation constraint

The CLI has **zero runtime npm dependencies**. Argument parsing uses the built-in `node:util` `parseArgs`, plus a thin in-house subcommand and help layer. The rationale:

- The tool writes into `~/.claude`, so no third-party code should run on users' machines (supply-chain risk).
- Installs stay tiny.
- It matches `core/`'s zero-runtime-dependency rule.

## Edge cases

- **Same file for two tiers.** Not possible by construction: the tiers live at fixed, distinct paths.
- **Key that is both a leaf and a parent.** `set a.b 1` when `a` is a string replaces `a` with `{"b": 1}`, per `setpath`. For a known key whose registry type forbids it this is caught by validation first.
- **Concurrent CLI writes.** Serialized by the lock; the second either waits or exits `6`.
- **Ctrl-C while waiting for the lock.** Exits `130`, writes nothing, leaves no lock behind (the CLI does not hold it yet).
- **Ctrl-C while holding the lock.** The CLI releases the lock in a signal handler before exiting `130`.
- **Non-UTF-8 or BOM-prefixed file.** A UTF-8 BOM is tolerated on read and not written back; other encodings count as malformed.
- **Very large values.** No size limit beyond the filesystem.

## Backward compatibility

- No config shape changes. The CLI reads and writes the existing tier files with the same semantics as the skills.
- The exit codes and JSON shapes are a public contract from the first release. Adding fields or codes is minor; renaming or removing them is major.
- The malformed-file refusal is stricter than `RepoConfigWriter`, which skills keep using unchanged.
- The bounded lock is opt-in on `Lock`; skills keep waiting forever.

## Testing

- Specs use temp dirs as fake `CLAUDE_CONFIG_DIR`s and repos, never the real `~/.claude`.
- One spec per exit code, asserting the code, the stderr prefix and, in `--json` mode, the error object.
- One spec per malformed-file kind (invalid JSON, `null`, array, scalar, unreadable), for reads and for writes, asserting the file bytes are unchanged after a refused write.
- One spec per row of the value-parsing table, with and without `--string`.
- JSON shape specs for every command, including `get --all-tiers`, unset `get`, `info` with no repo and with an unresolved account.
- Lock specs inject a `Lock` with a short `sleepMs` and a pre-held lock file, covering timeout (`6`), `--lock-timeout 0` and successful acquisition after release.
- Syntax specs for flag placement, the `--repo` overload, tier-flag conflicts and `--`.

## Performance

Nothing load-sensitive. Each invocation runs at most one `git rev-parse`, reads at most three small files, and takes at most one lock. The only slow path is lock contention, which is bounded by `--lock-timeout`.

## Security

- No overwrite of a file the CLI cannot parse.
- No writes outside the resolved tier files and their `.lock` siblings.
- No shell interpolation: `git` runs through `execFile` with an argument array; values are never evaluated.
- No directory creation for an unknown account, and no write into an unconfigured repo (see the index).
- Error messages may show file paths and key names, but print a value only when it is short and the user just typed it.

## Alternatives considered

- **A CLI framework (`commander`, `yargs`).** Rejected: it adds supply-chain surface to a tool that writes into `~/.claude`, and breaks consistency with `core/`'s zero-runtime-dependency rule. `commander` is the low-risk upgrade path if the surface grows a lot.
- **Defaulting `set` to `--local`, like git.** Rejected: with three tiers, one committed and one shared across repos, an implicit tier makes accidental writes to shared files too easy.
- **Reusing exit codes `1`/`2` only, like git.** Rejected: scripts need to tell "nowhere to write" and "file is corrupted" apart from a typo.
- **Overwriting malformed files, like `RepoConfigWriter`.** Rejected: it destroys user data the CLI cannot read.
- **Waiting forever for the lock, like skills.** Rejected: an interactive command that hangs with no output is worse than a clear timeout.
- **Letting `--force` bypass read-only keys.** Rejected: the version pointers drive migrations; editing them by hand can skip or replay migrations.

## Open points

- Whether `list --json` should also report registry defaults for keys that are unset in every tier. `get` already reports them in its `default` field.
- Whether the `--repo` overload (path versus tier flag) should be replaced by separate names (e.g. `--repo-path`) before the first release, if the parser rule proves confusing in practice.

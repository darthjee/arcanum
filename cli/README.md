# arcanum-cli

`arcanum-cli` is the command-line client for [Arcanum](https://github.com/darthjee/arcanum), a collection of Claude Code skills. It installs an `arcanum` command that reads and writes Arcanum's configuration tiers (global, repo and local) through the same shared config logic the skills use, so it sees and writes exactly what they do.

## Install

```bash
npm i -g arcanum-cli
arcanum --version
```

It needs Node.js 22.13.0 or newer and has no runtime dependencies. For a one-off look without a global install, use `npx arcanum-cli --help`.

Releases are published from CI with npm provenance, which links each version to the commit and pipeline that built it. `npm audit signatures` checks it after install.

This package is not the internal `core/bin/arcanum` dispatcher that Arcanum's skills call. That one ships inside Arcanum installs and is not meant to be run by hand.

## The three tiers

| Tier | Flag | File |
| --- | --- | --- |
| Local (gitignored) | `--local` | `<repo>/.claude/state/arcanum-config.json` |
| Repo (committed) | `--repo` | `<repo>/.claude/configuration/arcanum-repo-config.json` |
| Global (per account) | `--global` | `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` |

Reads resolve local → repo → global, like the skills do. Writes always name one tier.

## Commands

```text
arcanum config get <key> [--global|--repo|--local] [--all-tiers]
arcanum config set <key> <value> (--global|--repo|--local) [--string] [--force] [--lock-timeout <seconds>]
arcanum config unset <key> (--global|--repo|--local) [--force] [--lock-timeout <seconds>]
arcanum config list [--global|--repo|--local]
arcanum config info
arcanum config setup [<section>...] [--lock-timeout <seconds>]   # interactive wizard
```

`arcanum config --help` lists every known key, and `arcanum config <subcommand> --help` shows a subcommand's flags.

### get

```console
$ arcanum config get engine.mode
native   (repo: .claude/configuration/arcanum-repo-config.json)

$ arcanum config get engine.mode --repo        # raw value only, for $(...)
native

$ arcanum config get engine.mode --all-tiers
local    -        (unset)
repo     native   <- resolved
global   -        (unset)

$ arcanum config get git.safe_branch           # unset: exit 1
(unset; default: origin/main)
```

### set and unset

```console
$ arcanum config set next_step.auto.enhance-issue true --global
set next_step.auto.enhance-issue = true   (global: /Users/x/.claude/arcanum-config.json, was: unset)

$ arcanum config set git.email 'me+{agent}@example.com' --local
$ arcanum config set git.remove_coauthors '["bot@example.com"]' --repo
$ arcanum config set custom.thing --global --force -- -1   # `--` before a value starting with -

$ arcanum config unset git.safe_branch --local
unset git.safe_branch   (local: .claude/state/arcanum-config.json, was: origin/dev)
```

- `true`, `false`, numbers, `null`, arrays and objects are parsed as JSON; anything else is a string. `--string` always stores a string.
- Values are checked against the key registry (type, enum, tier, read-only). Unknown keys are refused unless `--force` is passed. `--force` also allows writing to a tier whose version is newer than the CLI. It never bypasses anything else.
- Writes take the same lock as the skills, and wait at most `--lock-timeout` seconds for it (default `10`, `0` tries once).
- A repo must be arcanum-configured (run `/init-claude` in it) before the CLI writes to its repo or local tier. The CLI never creates a missing Claude config directory.
- The CLI never overwrites a tier file it cannot parse.

### list

```console
$ arcanum config list --repo
version = "2.1.0"   Arcanum version the repo config was migrated to, managed by migrations and init-claude
engine.mode = "native"   Script engine used to run migrated skill entrypoints
```

Without a tier flag, each line is prefixed with its tier, and a shadowed key appears once per tier.

### info

```console
$ arcanum config info
arcanum-cli 2.4.0 (node 22.14.0, requires >=22.13.0)

Account
  claude config dir  /Users/x/.claude-favini   (from: env CLAUDE_CONFIG_DIR)
  global config      /Users/x/.claude-favini/arcanum-config.json   [exists]
  global version     2.3.0   behind — 1 pending migration, run /arcanum-migrate

Repo
  root           /Users/x/projects/foo   (from: cwd)
  repo config    .claude/configuration/arcanum-repo-config.json   [exists]
  repo version   2.4.0   up to date
  local config   .claude/state/arcanum-config.json   [missing]
  local version  0.0.0 (no pointer)   behind — 3 pending migrations, run /arcanum-migrate
```

`info` never prints config values and always exits `0` (usage errors aside).

## Shortcuts

Curated shortcuts over the most common keys. Each one is a thin front-end over generic `get`/`set`/`unset`: it prints exactly what the generic command prints (human, `--json` and exit codes), with a default write tier so you don't have to name one.

| Shortcut | Key(s) | Default write tier |
| --- | --- | --- |
| `agents email [<agent>]`, `agents email set <pattern>`, `agents email set <agent> <email>`, `agents email unset [<agent>]` | `git.email`, `git.agents.<agent>` | global |
| `engine [shell\|native\|docker \| --unset]` | `engine.mode` | local |
| `next-step auto [<skill> [on\|off \| --unset]]` | `next_step.auto.<skill>` | local |
| `git safe-branch [<ref> \| --unset]` | `git.safe_branch` | local (local only) |
| `git merge-body [full\|empty\|coauthors \| --unset]` | `git.merge_body_mode` | local |
| `auto-fix-all clear-context [on\|off \| --unset]` | `auto-fix-all.clear_context` | local (local only) |
| `auto-fix-all finish-on-empty-queue [on\|off \| --unset]` | `auto-fix-all.finish_on_empty_queue` | local (local only) |
| `auto-fix-all ignore-checks [list]`, `add <pattern>...`, `remove <pattern>...` | `auto-fix-all.ignored_check_patterns` | repo (repo only) |
| `monitor-issues clear-context [on\|off \| --unset]` | `monitor-issues.clear_context` | local (local only) |

All of them live under `arcanum config`; `arcanum config <shortcut> --help` shows each one's flags.

```console
$ arcanum config engine                          # same as: config get engine.mode
native   (repo: .claude/configuration/arcanum-repo-config.json)

$ arcanum config engine docker                   # same as: config set engine.mode docker --local
$ arcanum config engine docker --global          # a tier flag overrides the default tier
$ arcanum config engine --unset                  # same as: config unset engine.mode --local

$ arcanum config next-step auto enhance-issue on # same as: config set next_step.auto.enhance-issue true --local
$ arcanum config next-step auto                  # every next_step.auto.* key set, sorted
auto-plan-issue  false  (local)
enhance-issue    true   (global)
```

- **Single-value shortcuts.** No value reads (resolved, or one tier with a tier flag, or `--all-tiers`); a value writes to the default tier; `--unset` removes the key from it. `--unset` together with a value is exit `2`. `--force` and `--string` are not accepted: use `config set` for unknown keys or forced strings.
- **Booleans** take `on`/`off`/`true`/`false`, lowercase only, and are stored as JSON booleans. `off` stores `false`, so it can shadow an `on` from a lower tier; `--unset` removes the key. Any other token is exit `3`.
- **Shadowed writes.** When a higher-precedence tier still holds a value for the key you just wrote, a note on stderr names it: `arcanum: note: local still overrides engine.mode (value: docker)`.

### agents email

```console
$ arcanum config agents email
default  you+{agent}@example.com   (global: git.email)

agent      effective email            from
architect  you+architect@example.com  global git.email
node       node-bot@example.com       repo   git.agents.node
reviewer   rev@example.com            global git.agents.reviewer   (not in this repo)

$ arcanum config agents email node               # both keys in every tier; exit 1 if the model email applies
$ arcanum config agents email set 'you+{agent}@example.com'   # git.email, global
$ arcanum config agents email set node node-bot@example.com --repo
$ arcanum config agents email unset node         # git.agents.node, global
```

The emails are resolved exactly like the commit helpers do (local, then repo, then global; within a tier `git.agents.<agent>` before `git.email`; `{agent}` substituted; an explicit `""` means the model email). The agents listed are the configured ones plus the repo's `.claude/agents/*.md`.

### auto-fix-all ignore-checks

```console
$ arcanum config auto-fix-all ignore-checks add '^codacy' '^sonar'
added '^codacy' to auto-fix-all.ignored_check_patterns (repo: .claude/configuration/arcanum-repo-config.json)
added '^sonar' to auto-fix-all.ignored_check_patterns (repo: .claude/configuration/arcanum-repo-config.json)
$ arcanum config auto-fix-all ignore-checks
^codacy
^sonar
$ arcanum config auto-fix-all ignore-checks remove '^sonar'
$ arcanum config auto-fix-all ignore-checks add -- -flaky    # `--` before a pattern starting with -
```

Patterns are **case-insensitive regexes**, not globs. They match by exact string, `add` skips patterns already present and `remove` skips missing ones. Every pattern given to `add` must compile, or nothing is written. The key is repo-only: `--local`/`--global` exit `3`. Each `add`/`remove` re-reads the file inside the lock, so concurrent calls never lose a pattern.

### setup

```bash
arcanum config setup                  # every section
arcanum config setup identity flow    # only some sections
```

`arcanum config setup [<section>...]` is an interactive wizard over the settings a new user has to decide on. The sections are `identity`, `engine`, `git`, `flow` and `ci`, and they always run in that order, whatever order you give them in. With no section, all of them run.

- **Per setting**, the wizard shows the current value and its tier, then asks for a new one: Enter keeps it, `-` unsets it, and an invalid value is explained and asked again.
- **The tier** is asked only when the key allows more than one; Enter picks the matching shortcut's default tier.
- **A `[Y/n]` confirmation** shows the exact write, then the answer is written at once, with the same checks and lock as `config set`.
- **It needs an interactive terminal.** Prompts go to stderr; without a TTY on stdin and stderr it exits `2`. `--json` is refused (exit `2`).
- **Ctrl-C or Ctrl-D** stops it with exit `130`. Settings already written stay written, and a summary on stderr lists what was written, kept, failed and not reached.

See the [Setup wizard](https://github.com/darthjee/arcanum/blob/main/docs/guides/arcanum-cli.md#setup-wizard) section of the user guide for a walkthrough.

## Targeting

| Flag | Effect |
| --- | --- |
| `--repo <path>` | Target the repo at `<path>` instead of the current directory. A subdirectory resolves to the repo root; a worktree to its own root. |
| `--claude-config-dir <dir>` | Target that Claude config dir. Overrides `CLAUDE_CONFIG_DIR`, and expands a leading `~`. |
| `--json` | Machine-readable output: exactly one JSON object on stdout, and an error object on stderr on failure. |

`CLAUDE_CONFIG_DIR` is used verbatim, with no `~` expansion, like Claude Code and the skills.

`--repo` is both the repo tier flag and the targeting flag. `--repo=<path>` is always targeting. `--repo <token>` is targeting when `<token>` contains a `/` or is `.` or `..`. Anything else is the tier flag. To target a repo and pick its repo tier, pass both: `--repo=../other --repo`.

Flags may appear before or after the subcommand.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | Generic error, or `get` of an unset key. |
| `2` | Usage error: unknown flag or command, bad arity, conflicting flags, bad `--repo` or `--claude-config-dir` path, or `config setup` without an interactive terminal. |
| `3` | Validation error against the key registry: unknown key, type, enum, tier, read-only. |
| `4` | Target unavailable: no repo, an unconfigured repo, or no usable Claude config dir. |
| `5` | Version skew: a write to a tier newer than this CLI, without `--force`. |
| `6` | The write lock was not acquired within `--lock-timeout`. |
| `7` | Malformed tier file, or an I/O error. |
| `130` | Interrupted (Ctrl-C, or Ctrl-D in `config setup`). |

When several apply, the first of `2`, `4`, `7`, `3`, `5`, `6` wins. Set `ARCANUM_DEBUG=1` for stack traces.

## Development

Run from `cli/`, with the whole repository checked out (the build reads `../shared/lib/` and `../arcanum/migrations/`):

```bash
yarn install
yarn lint
yarn build   # writes dist/arcanum.mjs
yarn test    # needs yarn build first, for the smoke specs
```

From the repository root, the Docker-based `make cli-install`, `make cli-lint`, `make cli-build`, `make cli-test`, `make cli-check`, `make cli-shell` and `make cli-audit` targets do the same.

## More

- [User guide](https://github.com/darthjee/arcanum/blob/main/docs/guides/arcanum-cli.md)
- [Architecture](https://github.com/darthjee/arcanum/blob/main/docs/agents/architecture/arcanum-cli.md) of the CLI's internals
- [Arcanum CLI architecture](https://github.com/darthjee/arcanum/blob/main/docs/agents/architecture/arcanum-cli.md)

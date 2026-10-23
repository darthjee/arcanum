# Guide: The Arcanum CLI

The `arcanum` command lets you inspect and change Arcanum's configuration from a terminal, without hand-editing JSON or opening a Claude session. It reads and writes the same three files the skills use, with the same rules and the same lock.

It is optional, and it is installed separately from Arcanum. It is not the internal `core/bin/arcanum` dispatcher that the skills call, which is never on your `PATH`.

## Setup

```bash
npm i -g arcanum-cli
arcanum --version
```

You need Node.js 22.13.0 or newer. One install serves every Arcanum install and every Claude account on the machine.

## The three tiers

| Tier | Flag | File | Use it for |
| --- | --- | --- | --- |
| Local | `--local` | `.claude/state/arcanum-config.json` (gitignored) | Your own settings for one repo |
| Repo | `--repo` | `.claude/configuration/arcanum-repo-config.json` (committed) | Settings the whole team shares |
| Global | `--global` | `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` | Your defaults across every repo |

When a skill reads a key, local wins over repo, which wins over global. See [the repo config guide](arcanum-repo-config.md) and [the global config guide](arcanum-global-config.md) for what lives where.

## Everyday use

**See where you are.** Start with `info`. It shows which Claude config dir and which repo the CLI targets, which files exist, and whether they need migrating:

```bash
arcanum config info
```

**Read a value.** `get` prints the value that wins and the tier it came from:

```console
$ arcanum config get engine.mode
native   (repo: .claude/configuration/arcanum-repo-config.json)
```

Add a tier flag to read only that tier (the raw value, handy in scripts), or `--all-tiers` to see what each tier holds, including shadowed values. An unset key prints `(unset)`, with the registry default when there is one, and exits `1`.

**Write a value.** `set` always needs a tier, so nothing lands in the committed or the shared file by accident:

```bash
arcanum config set next_step.auto.enhance-issue true --global
arcanum config set engine.mode native --local
arcanum config set git.remove_coauthors '["bot@example.com"]' --repo
```

`true`, `false`, numbers, `null`, `[...]` and `{...}` are parsed as JSON; anything else is stored as a string. Pass `--string` to force a string, e.g. a branch name that looks like a number. Values are checked against the key registry. A misspelt key is refused (exit `3`), so typos don't silently create dead settings. `--force` writes a key this CLI doesn't know yet, for example one added by a newer Arcanum.

**Remove a value.** `unset` takes a tier too. Removing a key that isn't there is not an error:

```bash
arcanum config unset engine.mode --local
```

**List everything.** `list` shows every key set in every tier (or in one), with a description for known keys:

```bash
arcanum config list
arcanum config list --repo
```

`arcanum config --help` lists every key arcanum knows.

## Targeting another account or repo

- `CLAUDE_CONFIG_DIR=~/.claude-work arcanum config get git.email` targets another Claude account. The variable is used as is, like Claude Code does, so let your shell expand the `~` (don't quote it).
- `--claude-config-dir <dir>` does the same and wins over the variable. It expands a leading `~` itself.
- `--repo <path>` targets another repo instead of the current directory. A subdirectory or a worktree works too. To target a repo *and* pick its repo tier, pass both: `arcanum config get engine.mode --repo=../other --repo`.

The CLI never creates a missing Claude config dir, and it refuses to write to the repo or local tier of a repo that hasn't run `/init-claude` (exit `4`).

## Scripting with `--json`

With `--json`, stdout holds exactly one JSON object and nothing else. Warnings stay plain text on stderr, and a failure prints an error object on stderr:

```console
$ arcanum config get engine.mode --json
{"key":"engine.mode","set":true,"value":"native","source":"repo","default":"shell"}

$ arcanum config set engine.mode native --local --json 2>&1 >/dev/null
{"error":{"code":"target_unavailable","exit":4,"message":"arcanum: ...","hint":"run /init-claude in that repo"}}
```

Branch on the exit code (see the table in [`cli/README.md`](../../cli/README.md#exit-codes)). For example, `arcanum config get k --repo` exits `1` when `k` is unset, so `value=$(arcanum config get k --repo) || value=default` works.

## Troubleshooting

**Exit `5`: version skew.** The target file was migrated by a newer Arcanum than this CLI, so the CLI may not know about renamed or moved keys. Update the CLI with `npm i -g arcanum-cli@latest`. If you're sure about the key, `--force` writes anyway. When a file is *behind* and has migrations pending, reads print a hint to run `/arcanum-migrate`.

**Exit `6`: lock timeout.** Another writer (a running skill, or another `arcanum` command) held the file's lock for longer than `--lock-timeout` (10 seconds by default). Nothing was written. Retry, or pass a longer `--lock-timeout`. If no arcanum process is running, the lock file named in the message is left over: remove it by hand.

**Exit `7`: malformed file.** The file is not valid JSON, its top level is not an object, it isn't UTF-8, or it can't be read. The CLI won't overwrite a file it can't parse, and `--force` doesn't change that. Reads still work: the broken tier is skipped with a warning. Fix or remove the file named in the message, then retry. A set can also exit `7` when a parent of the key holds a non-object (e.g. `git` is a string and you set `git.email`).

Set `ARCANUM_DEBUG=1` to see stack traces.

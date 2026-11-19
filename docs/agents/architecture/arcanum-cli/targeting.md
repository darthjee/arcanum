# Targeting and version skew

Part of [Arcanum CLI](../arcanum-cli.md). This page describes account/repository resolution and cross-version migration behavior.

## Targets

Every invocation resolves the account and repository once in `cli/lib/target.js`.

### Account

The Claude config directory is selected in this order:

| Source | Rule |
|---|---|
| `--claude-config-dir <dir>` | Wins; the CLI expands leading `~`/`~/`; `~user` is also supported |
| `CLAUDE_CONFIG_DIR` | Used verbatim; no `~` expansion |
| `$HOME/.claude` | Default |
| Unresolved | No flag, environment or HOME |

Account states:

- Unresolved: global reads use an empty tier and warn; writes exit `4`.
- Directory missing or not a directory: reads are empty/warn or fail according to the command; writes exit `4`.
- Directory exists with no config file: reads are empty; writes create it normally.
- The CLI never verifies that an Arcanum install exists in the directory.

### Repository

The repo is the cwd or `--repo <path>`, normalized through `RepoPath#toplevel`. Missing/not-directory targeting is usage error `2`. A bare repo, non-repo path or missing `git` resolves as no repo; this is a result rather than an error where an explicit repo tier is not required.

| State | Reads | Repo/local writes |
|---|---|---|
| No repo | Only global, with warning | Exit `4` |
| Not configured | Missing tiers are empty | Exit `4`; hint to run `/init-claude` |
| Configured | Normal | Normal; local file is created on first write |

Writing to an unconfigured repo is refused because its missing version pointer would look like `0.0.0`, causing migrations to run against an unfinished repo.

## Version pointers

One CLI may encounter accounts/repos on different Arcanum versions.

| Tier | Pointer |
|---|---|
| Global | `.migrations.version` in `arcanum-config.json` |
| Repo | `.version` in `.claude/configuration/arcanum-repo-config.json` |
| Local | `.migrations.version` in `.claude/state/arcanum-config.json` |

Pointers hold an Arcanum version, not a migration number. Missing or non-string pointers become `0.0.0` and are never considered ahead. The build embeds, per scope, migration-bearing released versions so it can count pending migrations.

## Skew states

| Status | Condition | Reads | Writes |
|---|---|---|---|
| Ahead | Pointer > CLI | Allowed with warning | Refused `5`; hint to upgrade or pass `--force` |
| Behind | Pointer < CLI and scope has migrations pending | Allowed with warning | Allowed if target pointer passes target-specific checks |
| Up to date | Equal, or behind with no pending shape migration | Silent | Silent |

A write checks only the target tier pointer. A malformed tier file has no skew status and is handled as file error `7`. Skew is measured against tier pointers, never against an Arcanum install path that the CLI cannot reliably locate.

The CLI may be ahead of a repo, but the repo tier may remain writable; target-tier checks prevent accidentally writing keys into an unknown shape.

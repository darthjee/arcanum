# Commands and arguments

Part of [Arcanum CLI](../arcanum-cli.md). This page defines the command surface, parser rules, keys and value parsing.

## Generic commands

```text
arcanum config get <key> [--global|--repo|--local] [--all-tiers]
arcanum config set <key> <value> (--global|--repo|--local) [--string] [--force] [--lock-timeout <seconds>]
arcanum config unset <key> (--global|--repo|--local) [--force] [--lock-timeout <seconds>]
arcanum config list [--global|--repo|--local]
arcanum config info
arcanum config doctor
```

Every command accepts global flags and `--help`.

- `get` resolves local → repo → global for the first present, non-null value unless a tier flag is used.
- `set` and `unset` require exactly one tier flag.
- `list` prints keys set in every tier or one selected tier.
- `info` describes environment/target state without showing values or writing files.
- `doctor` reports unknown, disallowed-tier and invalid values, malformed tiers and read-only skips.

## Meta and global flags

Top-level help/version and config help print stdout and exit `0`. With no args, the CLI prints matching usage to stderr and exits `2`.

| Flag | Effect |
|---|---|
| `--repo <path>` | Repo targeting; a bare `--repo` is the repo tier flag |
| `--claude-config-dir <dir>` | Override Claude config/account directory |
| `--json` | Machine-readable output |
| `-h`, `--help` | Usage |

`--lock-timeout <seconds>` is supported by set/unset/setup and shortcut writes.

## Argument syntax

- Global and command flags may precede or follow subcommands and positionals.
- Tier flags are mutually exclusive.
- `--repo` overload is syntactic: without a value it selects a tier; with a path it targets a repo.
- `--all-tiers` is only accepted by `get` and reads.
- `--string` only applies to `set`; `--force` only to set/unset.
- `--` ends option parsing. Starting-dash values use `--lock-timeout=-1` or `--` with set values.
- Arity is exact. Unknown flags are usage errors.

## Keys and force

Keys are dotted paths such as `next_step.auto.enhance-issue`. Empty segments and empty keys are usage errors. Writes use nested `setpath`, preserve siblings and replace object values atomically.

Set/unset validate known keys against the key registry. Reads may use known or unknown keys. Unsetting an absent key is a no-op exit `0`.

`--force` applies only to set/unset:

| Refusal | Bypassed |
|---|---|
| Unknown key | Yes |
| Target tier ahead of CLI | Yes |
| Wrong known-key type/enum/format | No |
| Wrong tier | No |
| Read-only key | No |
| Precision-loss number | No |
| Usage/target/lock/file errors | No |

When force bypasses a refusal, JSON reports `forced: true`.

## Value parsing

`set` parses typed values unless `--string` is present:

- `true`, `false`, `null`: booleans/null normally, strings with `--string`.
- JSON numbers become numbers; malformed/unsafe numbers become strings or are refused.
- Arrays/objects become structured values; `--string` stores text.
- Quoted JSON strings lose quotes under normal parsing and keep them under `--string`.
- Values are never trimmed.
- Known-key values then pass registry type/enum/format/range checks.
- Unknown keys may only be written with `--force` and support JSON values that are not numbers losing precision.

A type mismatch after `--string` hints to drop `--string`. Null for known keys hints to use unset; unknown forced keys may store null as a present value.

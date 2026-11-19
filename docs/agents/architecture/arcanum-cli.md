# Arcanum CLI

The architecture guide for the user-facing `arcanum-cli` npm package. It owns `cli/`, the `arcanum config` namespace and `arcanum self-update`; the package is a thin command surface over the shared configuration and migration libraries.

`cli/` is owned by the `client` agent. End-user documentation is in [Arcanum CLI guide](../../guides/arcanum-cli.md) and [`cli/README.md`](../../../cli/README.md).

## Guides

- [Overview, runtime and modules](arcanum-cli/overview.md) — goals, distribution, internal/core separation, runtime, module layout and alternatives.
- [Targeting and version skew](arcanum-cli/targeting.md) — account and repository resolution, migration pointers, ahead/behind behavior and targets.
- [Commands and arguments](arcanum-cli/commands.md) — generic commands, meta commands, global flags, argument syntax, keys and value parsing.
- [Reads, writes and failures](arcanum-cli/io-and-failures.md) — tier files, refusal order, lock contention, output, JSON and exit codes.
- [Shortcuts and setup](arcanum-cli/shortcuts.md) — config shortcuts, agents email, ignore-checks and the setup wizard.
- [Self-update](arcanum-cli/self-update.md) — latest lookup, npm install, outcomes, failures, safety and backward compatibility.
- [Specs and testing](arcanum-cli/specs.md) — test organization, fixtures, future work and implementation alternatives.

## Summary

The CLI is optional and host-Node based. It is published in lockstep with Arcanum, targets one machine-wide global install and supports multiple Claude configuration directories. It never imports `core/`; shared logic is bundled from `shared/lib/` at build time.

The runtime loads `cli/bin/arcanum`, enforces Node `>=22.13.0`, imports the bundled `cli/lib/main.js`, and returns all failures through structured output and exit codes. The CLI uses strict argument parsing, exact arity and mutually exclusive tier flags.

Two targets are resolved once:

- the Claude config/account directory for the global tier; and
- the Git repository root for the repo and local tiers.

Writes require an explicit tier, use bounded locks and replace tier files atomically. Reads tolerate missing and malformed tiers according to command-specific rules. Version skew is checked against `.migrations.version` or `.version` pointers, never guessed from the local Arcanum install.

The generic commands are:

```text
arcanum config get <key> [--global|--repo|--local] [--all-tiers]
arcanum config set <key> <value> (--global|--repo|--local) [--string] [--force] [--lock-timeout <seconds>]
arcanum config unset <key> (--global|--repo|--local) [--force] [--lock-timeout <seconds>]
arcanum config list [--global|--repo|--local]
arcanum config info
arcanum config doctor
```

Curated shortcuts delegate to the same registry and writer. `agents email` resolves committed-agent identities across tiers, `ignore-checks` edits a regex array in place, and `config setup` walks registry-driven onboarding settings.

`arcanum self-update` is a separate explicit command that resolves exact `latest`, refuses dev/linked/non-global copies, and installs the exact npm version with `--ignore-scripts`.

## Stable contracts

- Human output goes to stdout for command results and stderr for warnings, notes and errors.
- `--json` stdout is exactly one object/line; existing JSON fields may not be renamed or removed without a major version.
- Exit classes are stable: usage `2`, validation `3`, unavailable target `4`, skew `5`, lock timeout `6`, file error `7`, npm error `8`, interrupted `130`.
- Tier tiers remain local → repo → global for resolution, and set/unset operations require an explicit tier.
- `self-update` always uses exact semver pins and never uses sudo or a shell to invoke npm.

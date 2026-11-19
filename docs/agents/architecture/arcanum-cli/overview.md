# Overview, runtime and modules

Part of [Arcanum CLI](../arcanum-cli.md). This page describes the CLI's purpose, distribution, relationship to the native core binary, runtime path and module layout.

## Goal and distribution

Every configuration command lives below `arcanum config`, leaving the top-level namespace free for later features. The only existing top-level feature is `arcanum self-update`.

The npm package is optional and offered with Arcanum. `npm i -g arcanum-cli` installs the global `arcanum` command. Installer/updater integration offers it, and migrations may perform a skippable global migration to install it.

One global package serves every Arcanum install and Claude account on a machine. It does not create a second Arcanum installation for each repo or account. Host Node.js is required: Node `22.13.0` is the floor, and Docker is not a fallback.

The CLI is published on every Arcanum release at the same version. Build and package behavior is documented in [Install and release](install-and-release.md).

## Relationship to `core/bin/arcanum`

The two binaries have separate entrypoints and distinct argv contracts:

- `core/bin/arcanum` is the internal native dispatcher called by `arcanum/_lib/engine_dispatch.sh`. It is not normally on `PATH`, and it must not collide with `cli/bin/arcanum`.
- `cli/bin/arcanum` is the user-facing entrypoint. It has its own command registry, help, repo-default targeting and human-readable output.
- `cli/` imports no code from `core/`. Shared behavior used by both sides lives in `shared/lib/` and is bundled into the CLI. ESLint forbids CLI imports from `core/` and nested imports from `shared/`.

## Runtime path

1. `cli/bin/arcanum` is unbundled ES2020 so it parses on older Node. It compares `process.versions.node` with `22.13.0`. Below the floor it prints `Node.js >= 22.13.0 required, found X` and exits `1` before importing the bundle.
2. `cli/scripts/build.mjs` bundles `cli/lib/main.js` with imported `shared/lib/` files. The build injects `__ARCANUM_CLI_VERSION__`, `__ARCANUM_MIGRATION_VERSIONS__` and `__ARCANUM_CLI_FROM_BUNDLE__`.
3. `main.run(argv, { io, env, cwd, version, migrationVersions, deps })` never throws. Errors pass through `output.reportError`, which selects `exitCodes.exitCodeForError` and returns an exit code.

The package is tested primarily in-process; the CLI wrapper is intentionally a thin entrypoint.

## Module layout

| Module | Responsibility |
|---|---|
| `lib/main.js` | Meta flags, repo pre-scan, command lookup, strict parsing and command context |
| `lib/args.js` | Repo targeting overload, positional lookup, tier flags, subcommand flags, arity and key syntax |
| `lib/target.js` | Claude config dir/account and Git repo root resolution |
| `lib/values.js` | Typed `set` value parsing |
| `lib/exitCodes.js` | Exit constants and `CliError` classes |
| `lib/output.js` | Human/JSON result writing, warnings, hints and debug stacks |
| `lib/tierFiles.js` | Tier paths and nonthrowing parse/classification |
| `lib/skew.js` | Semver comparison, version pointers and migration skew |
| `lib/writeTier.js` | Target, registry, skew and lock orchestration |
| `lib/commands/config.js` | Config namespace dispatch and shared checks |
| `lib/commands/config/{get,set,unset,list,info}.js` | Generic subcommands |
| `lib/commands/config/shortcuts/` | Shortcut namespaces and shared delegation |
| `lib/commands/config/setup/` | Setup wizard settings, identity, CI and summary |
| `lib/prompter.js` | TTY line prompting and interruption |
| `lib/commands/selfUpdate.js` | Global CLI self-update |
| `lib/npm.js` | Argument-array npm execution through `execFile` |
| `lib/help.js` | Top-level and command usage |

## Alternatives considered

- Renaming `core/bin/arcanum` was rejected; internal and user-facing argv contracts are different.
- One combined binary was rejected because it would expose internal commands and mix conventions.
- Shipping one CLI copy inside every Arcanum install was rejected because competing installs would conflict.
- A CLI framework was rejected due to supply-chain size and the zero-runtime-dependency rule.
- Defaulting `set` to local tier was rejected because implicit writes to repo/global files are risky.

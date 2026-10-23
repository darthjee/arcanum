# Client Plan: Generic arcanum config commands

Main plan: [plan.md](plan.md)

## Overview
Replace the "not implemented yet" stubs in `cli/lib/commands/config.js` with the five generic subcommands and their cross-cutting behaviour. The spec is the contract and this plan does not restate it. Each step names the spec sections it implements.

## Context
- `cli/lib/main.js` already parses global flags (`--help`, `--version`, `--json`) with `parseArgs` in strict mode, merges in each command's `options`, and routes every thrown error through `exitCodeForError` (`cli/lib/exitCodes.js`). Exit constants `0`–`7` and `UsageError` already exist.
- `MIGRATION_VERSIONS` and `CLI_VERSION` are build-time defines exported from `main.js`. Source runs (specs) see empty lists and `0.0.0-dev`, so skew specs must inject them.
- Shared services the CLI uses as they are: `ConfigChain` (`readWithSource`), `KeyRegistry` (`lookup`, `check`, `entries`), `RepoConfigWriter` (`write`, `write` without `namespace`, `unset`, all with `timeoutMs`), `Lock`/`LockTimeoutError`, `RepoPath`, `ConfigError`. Imports go through `../../shared/lib/**` only (the `cli/eslint.config.mjs` boundary). A gap found in `shared/` becomes a separate `shared` issue and is never patched from `cli/`.

## Steps

- [01 — Argument layer and targeting](client/01-arguments-and-targeting.md)
- [02 — Errors, output and tier-file reading](client/02-errors-output-and-tier-files.md)
- [03 — Read commands: get and list](client/03-get-and-list.md)
- [04 — info and version skew](client/04-info-and-version-skew.md)
- [05 — Write commands: set and unset](client/05-set-and-unset.md)
- [06 — Help, README, architecture doc and user guide](client/06-docs.md)

## CI Checks
- `cli`: `cd cli && yarn lint && yarn build && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- Keep `cli/lib/` to zero runtime npm dependencies: only `node:` built-ins, `shared/lib`, and the CLI's own modules. The bundle smoke spec (`cli/spec/smoke/bundle_spec.js`) and the build's metafile shared-surface check must keep passing. If a new `shared/lib` file gets bundled, check that the metafile check allows it.
- Exit-code precedence `2`, `4`, `7`, `3`, `5`, `6` is easiest to keep if each command runs its checks in that order: parse, then target, then file, then registry, then skew, then lock. Don't collect the errors and sort them afterwards.
- Tier-file paths and the `CLAUDE_CONFIG_DIR` rules (env used verbatim with a warning on a leading `~`; `--claude-config-dir` expands `~`) must match `ConfigChain`'s, so the CLI and the skills read the same files. Reuse its path helpers where they are public. Don't re-derive anything that could drift.
- The coverage report in `cli/coverage/` is generated output and must not be committed.

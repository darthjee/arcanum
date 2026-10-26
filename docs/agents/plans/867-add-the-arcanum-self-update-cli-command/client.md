# Client Plan: Add the arcanum self-update CLI command

Main plan: [plan.md](plan.md)

## Overview
Add the `self-update` command to the CLI. The spec [self-update.md](../../specs/cli-install/self-update.md) is the source of truth for behavior, messages, outcomes, failures and edge cases; the issue's Solution section records what the spec left to the implementation. If the spec is wrong, fix it in the same PR.

## Context
- The CLI has one command today (`config`), registered in `COMMANDS` in `cli/lib/main.js`. `dispatch` parses global flags (`--json`, `--claude-config-dir`; `--repo` is extracted by `extractRepoTarget`) and passes a `context` (`positionals`, `values`, `io`, `version`, `deps`, `output`, `targeting`, ...) to `command.run`.
- `cli/lib/exitCodes.js` defines codes `0`–`7`, `EXIT_IDENTIFIERS`, the `CliError` subclasses, and `exitCodeForError`, which maps any Node errno error to `7` — hence `NpmError` must wrap every npm failure.
- `compareVersions` in `cli/lib/skew.js` ignores prerelease suffixes; the spec requires semver precedence.
- Specs run with jasmine + c8 (`yarn test`) after `yarn build`; the bundle smoke spec runs `dist/arcanum.mjs` from a temp copy.

## Steps

- [01 — Semver precedence in compareVersions](client/01-semver-precedence.md)
- [02 — Exit codes 8 and 130](client/02-exit-codes.md)
- [03 — npm runner](client/03-npm-runner.md)
- [04 — The self-update command](client/04-self-update-command.md)
- [05 — Bundle smoke spec](client/05-smoke-spec.md)
- [06 — Docs and spec touch-ups](client/06-docs.md)

## CI Checks
- `cli`: `yarn build && yarn test && yarn lint` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- No spec touches the real npm or the network; everything goes through injected `deps` (`execFileAsync`, `realpath`, `lstat`, `readFile`, `platform`, `packageDir`, `runNpm`).
- No lazy `import()` anywhere on the `self-update` path after `npm i -g` (the bundle may be replaced mid-run).
- No real-install smoke test in CI (it would mutate the global prefix). Manual check before release: `npm i -g arcanum-cli@<old>`, then `arcanum self-update`.
- Message wording follows the spec's tables; the index's shared open point on exact wording stays open.

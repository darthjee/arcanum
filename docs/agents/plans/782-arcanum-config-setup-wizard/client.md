# Plan: arcanum config setup wizard

Main plan: [plan.md](plan.md)

## Overview
Implement `arcanum config setup [<section>...]` in `cli/` as a new `config` subcommand. The wizard:
- asks every registry entry carrying `setup`, in canonical section order (`identity`, `engine`, `git`, `flow`, `ci`), then by `setup.order`;
- writes each confirmed answer immediately, through the generic `set`/`unset` code path;
- prints a stderr summary on every exit path.

## Context
- The dependencies are merged: the generic commands (#780), the shortcuts (#781) and `RepoConfigWriter#update` (#841).
- What already exists:
  - `shared/lib/config/keys.json` carries the `setup` fields.
  - `KeyRegistry.js` exports the canonical `SETUP_SECTIONS` and validates the `setup` fields.
  - `cli/lib/commands/config/shortcuts/` holds:
    - the default tiers: `SINGLE_VALUE` in `singleValue.js` and `DEFAULT_TIER` in `agentsEmail.js`;
    - the boolean tokens, in `booleanToken.js`;
    - the shadowing note (`noteShadowing`, in `common.js`);
    - the per-agent discovery (`repoAgents`);
    - the `ignore-checks` add/remove logic (`applyPatterns` and `editPatterns`, which use `writeKey({op: 'update'})`).
- What does not exist yet:
  - `main.js`'s `DEFAULT_IO` has no `stdin` and no TTY detection.
  - `writeKey` installs its own SIGINT handler, which releases the lock and calls `signals.exit(130)`.

## Steps

- [01 — Command skeleton, TTY guard and section selection](client/01-command-skeleton-and-tty-guard.md)
- [02 — Per-setting flow](client/02-per-setting-flow.md)
- [03 — Identity per-agent overrides and the ci array loop](client/03-identity-and-ci-sections.md)
- [04 — Interrupts, write errors and the summary](client/04-interrupts-errors-summary.md)
- [05 — Docs](client/05-docs.md)

## CI Checks
- `cli`: `yarn build && yarn lint && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- **The wizard never holds a lock while prompting.** Each write takes and releases its own lock, through `writeKey`.
- **Write path.** Prefer delegating to the generic `set`/`unset` `run` with a capturing `output`, or factoring their bodies into a reusable `applySet`/`applyUnset` that returns `{previous, value}`, over re-implementing validation. Either way, the target, file, skew and registry checks must be the same code.
- **Error mapping.** A `ValidationError` (exit `3`) at the value step re-prompts. Every other `CliError` (`6`, `5`, `7`, `4`) marks the setting failed and continues.
- **Pseudo-TTY.** The specs inject `stdin`/`isTTY` rather than spawning a real pty. One smoke-level check of the real no-TTY path, run through `spec/support/cli.js`, is enough.

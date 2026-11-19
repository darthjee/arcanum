# Specs and testing

Part of [Arcanum CLI](../arcanum-cli.md). This page organizes CLI specs, test fixtures and future work.

## Spec layout

The CLI specs live under `cli/spec/`:

- `cli/spec/support/fixtures.js` builds temporary git repositories and tier files.
- `cli/spec/support/cli.js` runs `main.run` in-process with injected environment/cwd.
- Setup specs use `setup_spec`, scripted prompts and a fake TTY stdin.
- Self-update specs inject npm, realpath, lstat, package-file, platform and signal behavior.
- Shortcut specs reuse tier reseeding helpers so generic and shortcut forms execute against identical state.

## Coverage model

Tests cover every exit code and precedence pair, malformed tier kinds and byte preservation on refused writes, value parsing with/without `--string`, stable JSON shapes, lock cases and interruption behavior.

Setup tests cover section order, target dropping, validator re-asks, write failures and summary output. Shortcut tests cover resolution, delegation, shadowed-tier notes and array add/remove semantics.

A CLI package smoke test should verify:

- Host Node floor and bundle entry.
- Each target state and explicit tier.
- Exact JSON field stability and stream placement.
- Lock wait and SIGINT cleanup.
- npm view/install/verification behavior.

## Future work

- `list --json` could expose registry defaults for unset keys; `get` already exposes `default`.
- The `--repo` tier/target overload could be split into separate targeting and tier flags if syntax becomes confusing.
- Per-key skew could refuse writes for keys touched by pending migrations rather than using only tier-level pointer checks.

## Alternatives retained as decisions

The architecture rejects combined core/user binaries, implicit set tiers, waiting forever for locks, overwriting malformed files, `--force` bypass for read-only keys, shortcut-specific output contracts, blind `npm i -g arcanum-cli@latest`, and mapping npm failures to generic file error `7`.

It also rejects merged arrays or resolved-only output for ignore-checks; runtime and CLI operate on one tier's full list. Wizard answers are written immediately so Ctrl-C retains completed writes rather than discarding the whole session.

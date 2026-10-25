# CLI Install: Self-Update

Part of the [CLI Install](../cli-install.md) spec. Unlike the other parts, this command does not use the arcanum version pin: see [Version pinning](../cli-install.md#version-pinning).

## Purpose

Give the client a way to update itself. Today the CLI only has `config`, so this is a new command.

## Decisions

- New CLI command: `arcanum self-update`.
- With no arguments, it installs `arcanum-cli@latest` globally, running `npm i -g arcanum-cli@latest`.
- The name avoids confusion with updating the arcanum install itself (`/arcanum-update`, `arcanum/update/`).

## Alternatives considered

- **Naming it `arcanum update` or `arcanum upgrade`.** Rejected: both read as updating the arcanum install, not the client.
- **Shipping a version argument** (to pin or roll back), **a `--check` dry run, or new version-skew hints** now. Deferred: out of scope for this epic. The skew hints keep saying `npm i -g arcanum-cli@latest`.

## Open points

- The `--json` output shape and the exit codes.
- How npm failures map onto `cli/lib/exitCodes.js`.

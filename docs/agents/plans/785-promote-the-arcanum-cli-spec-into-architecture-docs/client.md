# Client Plan: Promote the arcanum CLI spec into architecture docs

Main plan: [plan.md](plan.md)

## Overview

Turn `docs/agents/architecture/arcanum-cli.md` into the CLI's full architecture doc. It holds the contract the CLI implements (from the spec index, [Command Surface](../../specs/arcanum-cli/command-surface.md) and [Shortcuts and Setup](../../specs/arcanum-cli/shortcuts-and-setup.md)) alongside today's internals sections. Write everything as current state, checked against `cli/lib/` and the `--help` output. Where the spec and the code disagree, describe the code.

Out of scope, handled by the architect: the key registry format (it goes to `shared-state-and-configuration.md`), the shared config services (`shared-lib.md`), and packaging and release (`install-and-release.md`). Link to those sections instead of repeating them. Don't touch the spec files or `docs/guides/arcanum-cli.md`.

## Context

Today the doc's intro says the contract is the spec's and "this doc does not repeat it". Its Shortcuts and Setup wizard sections link to the spec for their contracts. Once #786 deletes the spec, that contract would be lost.

## Steps

- [01 — Overview, targeting and the cross-cutting contract](client/01-overview-and-targeting.md)
- [02 — Command surface](client/02-command-surface.md)
- [03 — Shortcuts, setup wizard, alternatives and future work](client/03-shortcuts-setup-and-wrap-up.md)

## CI Checks

- None. This is a docs-only change and no CI job lints Markdown. Run `make cli-build` (or `cd cli && yarn build`) to get `cli/dist/arcanum.mjs` for the `--help` comparisons.

## Notes

- The doc will grow to about the size of `docker-engine.md` (about 450–550 lines). Keep `#` / `##` / `###` headings, with no subfolder.
- Keep the existing section anchors (`#runtime-path`, `#module-layout`, `#shortcuts`, `#setup-wizard`, …) stable where you can. Other docs and the guide may link to them.
- Exit codes and JSON shapes must match `cli/lib/exitCodes.js` and `cli/lib/output.js` exactly.

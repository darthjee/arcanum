# Client Plan: Remove the arcanum CLI spec docs

Main plan: [plan.md](plan.md)

## Shared contracts

Use the mapping table in [plan.md → Shared contracts](plan.md#shared-contracts). Every new target is a `docs/agents/architecture/...` path, mostly `architecture/arcanum-cli.md`, plus `shared-lib.md` and `install-and-release.md` for build and bundling. Change comments only. No code, no behaviour and no spec expectation changes.

## Steps

- [01 — Command-surface and runtime comments](client/01-command-surface-comments.md)
- [02 — Shortcut and setup wizard comments](client/02-shortcuts-and-setup-comments.md)
- [03 — Build, packaging and lint comments](client/03-build-and-packaging-comments.md)

## CI Checks
- `cli`: `yarn lint && yarn build && yarn test` (CI jobs: `cli`, `cli-node-floor`)

## Notes
- When a comment is done, check it with `git grep -n "specs/arcanum-cli" -- cli`. It must print nothing. `cli/coverage/` is generated and gitignored, so ignore it.
- Where a comment calls the target "the spec" (e.g. `writeTier.js`'s "spec's precedence order"), reword it to name the architecture doc.

# Client Plan: Consolidate the shared surface inside core (core/lib/shared/)

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on `node` having moved the surface to `core/lib/shared/{config,file}/` (paths in [plan.md](plan.md#shared-contracts)). You produce the cli side of the boundary: any `core/lib/shared/` import is allowed, nothing else under `core/`; the build check accepts bundled inputs under `cli/lib/**` and `core/lib/shared/**` only, and stops reading core's ESLint config.

## Steps

- [01 — Rewrite cli imports](client/01-rewrite-imports.md)
- [02 — Folder lint restriction](client/02-folder-lint-restriction.md)
- [03 — Folder build check](client/03-folder-build-check.md)

## CI Checks

- `cli`: `cd cli && yarn lint && yarn test && yarn build` (CI jobs: `cli`, `cli-node-floor`)

## Notes

- `cli/dist/` is untracked; rebuild locally to confirm the bundle still builds and its inputs pass the new check.

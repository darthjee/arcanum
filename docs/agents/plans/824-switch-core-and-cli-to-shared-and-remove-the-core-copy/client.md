# Client Plan: Switch core and cli to shared/ and remove the core copy

Main plan: [plan.md](plan.md)

## Shared contracts

- Import the surface by relative path into `<repo>/shared/lib/`, never `shared/spec/**`. `cli/` imports nothing from `core/`.
- `ALLOWED_INPUT_DIRS` is exactly `['cli/lib/', 'shared/lib/']`.
- `core/lib/shared/` is deleted by `node` in the same PR.

## Steps

- [01 — Switch the cli import](client/01-switch-import.md)
- [02 — Lint boundary](client/02-lint-boundary.md)
- [03 — Build allow-list](client/03-build-allow-list.md)

## CI Checks

- `cli`: `make cli-check` (CI jobs: `cli`, `cli-node-floor`)

## Notes

- After the switch, the bundle in `cli/dist/arcanum.mjs` must still contain `keys.json`. The build's metafile check proves the inputs now resolve under `shared/lib/`.

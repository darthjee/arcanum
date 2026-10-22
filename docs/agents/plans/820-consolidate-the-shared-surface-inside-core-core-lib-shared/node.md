# Node Plan: Consolidate the shared surface inside core (core/lib/shared/)

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the moved paths and the core side of the boundary from [plan.md](plan.md#shared-contracts): the 10 paths under `core/lib/shared/{config,file}/`, and the `lib/shared/**` folder lint rule. `client` imports the new paths; nothing in `cli/` is yours.

## Steps

- [01 — Move the surface files](node/01-move-surface-files.md)
- [02 — Move the unit specs](node/02-move-unit-specs.md)
- [03 — Folder lint rule](node/03-folder-lint-rule.md)

## CI Checks

- `core`: `cd core && yarn lint && yarn test` (CI jobs: `checks`, `test`)

## Notes

- Use `git mv` so history follows the files.
- Grep `core/` for `utils/config/` and `utils/file/` after the move: the only remaining hits should be the core-only files.

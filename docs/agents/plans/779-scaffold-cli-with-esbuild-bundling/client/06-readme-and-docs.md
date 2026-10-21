# README and folder-structure row

- `cli/README.md`: a stub developer README that is also the npm page.
  - One paragraph on what `arcanum-cli` is.
  - `npm i -g arcanum-cli`.
  - A note that this is not the internal `core/bin/arcanum` dispatcher.
  - Development commands (`yarn install`, `yarn lint`, `yarn build`, `yarn test`, and the `make cli-*` targets).
  - A pointer to the spec until the user guide (#784) exists.
- `docs/agents/folder-structure.md`: add the `cli/` row and its main subpaths (`bin/arcanum`, `lib/`, `scripts/build.mjs`, `spec/`, `dist/` gitignored), owned by `client`.

## Files to Change

- `cli/README.md` — new stub.
- `docs/agents/folder-structure.md` — the `cli/` row.

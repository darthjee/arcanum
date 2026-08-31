# node Plan: Organize commands folder

Main plan: [plan.md](plan.md)

## Steps

- [01 — Move source command files into subfolders](node/01-move-source-commands.md)
- [02 — Move spec files into mirrored subfolders](node/02-move-spec-commands.md)
- [03 — Update the command registry and RepoContext](node/03-update-registry-and-repocontext.md)
- [04 — Verify with lint and the full test suite](node/04-verify-with-lint-and-tests.md)

## CI Checks
- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes
- Use `git mv` for every relocation, never delete+recreate — preserves each file's git history.
- There is no import-resolution ESLint rule in `core/eslint.config.mjs`, so a broken relative import only surfaces when the test suite exercises that code path — Step 4's full `yarn test` run is the real acceptance bar, not a clean `git mv`.
- Out of scope (per the issue): removing/retiring `dispatch-fixture`/`dispatch-fixture-crash` (spun off to issue #340), migrating any still-shell-only command, any behavior/logic change, renaming CLI-facing command names, changes to `dispatcher.js`/`core/bin/arcanum`, further subdividing `shared/`.

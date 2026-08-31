# Verify with lint and the full test suite

There is no import-resolution ESLint rule in this project, so a broken relative import from Steps 1–3 only surfaces when the affected code path actually runs. Treat a clean full test run — not just a successful `git mv` — as the acceptance bar for this issue.

Run, from `core/`:
- `yarn lint` — catches syntax/style issues but not broken import paths
- `yarn test` — runs the full Jasmine suite with coverage; any command file with a broken import will fail here as soon as `dispatcher.js` (or the spec file itself) tries to `import()` it

Also run `git status` in the repo root afterward to confirm every relocation went through as a rename (`git mv`), not a delete+recreate pair, for each of the 46 moved files (23 source + 23 spec).

## Files to Change

None — this step is verification only, fixing forward any failures surfaced by `yarn lint`/`yarn test` in the files already touched by Steps 1–3.

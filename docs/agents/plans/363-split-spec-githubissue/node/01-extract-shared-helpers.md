# Extract shared spec helpers into a factory module

Create `core/spec/support/factories/githubIssue.js` exporting the two helpers currently
inlined at the top of `core/spec/lib/commands/shared/GithubIssue_spec.js` (lines 10–31):
`loadFixture(name)` and `stubDeps(overrides = {})`. Copy their bodies verbatim — only the
`fixturesDir` path resolution changes, since the factory lives one directory shallower
(`support/factories/` instead of `lib/commands/shared/`): resolve it as
`path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')` instead of the
original's `'..', '..', '..', 'support', 'fixtures'`. Export both as named exports; do not
change their signatures or behavior. Leave `GithubIssue_spec.js` itself untouched in this
step — steps 02–04 remove its use of these inline helpers as each new file lands.

## Files to Change

- `core/spec/support/factories/githubIssue.js` — new file, exports `loadFixture` and
  `stubDeps`, copied verbatim from `GithubIssue_spec.js` lines 10–31 with only the
  `fixturesDir` relative path adjusted.

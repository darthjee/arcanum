# Split argument-validation describes

Move the remaining three `describe` blocks from the original monolith into
`core/spec/bin/autoFixAllCheckoutFromMainParity/argument_validation_spec.js`, unchanged:
- `missing required args` (2 `it`s, including the #333 stderr-divergence note — keep its
  explanatory comment intact, it documents real, still-true behavior, not stale context)
- `a present-but-non-directory repo_path`
- `a non-git repo_path`

This file does not need the git-fixture-pair helpers (`buildRepoPair`/`runPair`/`seed*`) from
step 01 — only `runCommand`, `SHELL_SCRIPT`, and `NATIVE_BIN` from the factory module, plus
`createTempDir`/`removeTempDir` from `core/spec/support/utils/tempDir.js` and
`createGitFixtureRepo` from `core/spec/support/utils/gitFixtureRepo.js` directly (same imports
the original monolith already had for these, just re-pointed at the new file's relative path).

Copy the same top-of-file parity-test doc comment as step 02's two files, so this file is
self-contained too.

## Files to Change

- `core/spec/bin/autoFixAllCheckoutFromMainParity/argument_validation_spec.js` — new file; 3
  `describe` blocks (3 `it`s total) moved verbatim from the monolith.

# Extract runCommand/git/runBoth and path constants

Create `core/spec/support/utils/runCommand.js` and move `runCommand`, `git`, and `runBoth` out of `core/spec/bin/autoFixAllGithubParity_spec.js` (lines 40–147) into it, exporting all three.

Also move the `SHELL_SCRIPT`, `NATIVE_BIN`, and `FAKE_FETCH_PRELOAD` constants (currently derived from `REPO_ROOT` at the top of the spec file) into this same module, and export them too. Compute `REPO_ROOT` relative to *this new file's own location* (`core/spec/support/utils/runCommand.js` — three `'..'` hops up to the repo root), not relative to whatever spec file ends up calling it. This is what lets every split spec file (one directory deeper than today's flat `core/spec/bin/`) import ready-made constants instead of recomputing its own path depth.

Keep JSDoc comments on each exported function/constant, adapted from the originals.

Do not delete anything from the original spec file yet — that happens in step 05, once all extractions are done and the split files exist to replace it.

## Files to Change

- `core/spec/support/utils/runCommand.js` — new file: `runCommand`, `git`, `runBoth`, `SHELL_SCRIPT`, `NATIVE_BIN`, `FAKE_FETCH_PRELOAD`, each exported, with `REPO_ROOT` computed relative to this file's own location.

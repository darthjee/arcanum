# Split `#create` into `GithubIssueCreate_spec.js` and delete the original

Create `core/spec/lib/commands/shared/GithubIssueCreate_spec.js` with a single top-level
`describe('GithubIssue#create', ...)` containing:

- The current `#create` block's 8 `it`s and its local `writeBodyFile` helper
  (`GithubIssue_spec.js` lines 199–326), moved verbatim.
- The context-injected path's `#create` `it` (lines 344–370), moved verbatim into the same
  top-level describe as a sibling `it` — same reasoning as step 03 for `#info`: keep both
  calling conventions for `#create` together. Its own `writeBodyFile` helper (identical to the
  one above) does not need to be duplicated — reuse the single copy already defined in this
  file.

Keep the existing `beforeEach`/`afterEach` temp-`repoPath` pair scoped to this file's
top-level `describe`. Import `loadFixture`/`stubDeps` from the factory module (step 01), plus
`GithubIssue`, `RepoContext`, `readFile`, `writeFile`, and `path`.

Once this file is in place and every `it` from the original has a new home (steps 02–04),
delete `core/spec/lib/commands/shared/GithubIssue_spec.js` — nothing imports or references it
anymore.

## Files to Change

- `core/spec/lib/commands/shared/GithubIssueCreate_spec.js` — new file, ~195 lines: the 8
  original `#create` `it`s plus the 1 context-injected `#create` `it`, moved verbatim from
  `GithubIssue_spec.js`, importing `loadFixture`/`stubDeps` from the factory module, with the
  two duplicate `writeBodyFile` helpers collapsed into one.
- `core/spec/lib/commands/shared/GithubIssue_spec.js` — deleted.

## Notes

- After this step, run `make core-test` and confirm the total spec/`it` count matches the
  pre-split baseline (8 + 4 + 9 = 21 `it`s across the three new files, same as the original's
  8 + 3 + 9 + 1 = 21), and `make core-lint` is clean.

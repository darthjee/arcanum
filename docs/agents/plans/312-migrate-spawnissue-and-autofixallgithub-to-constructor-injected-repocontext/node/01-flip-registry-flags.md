# Flip the registry flags

Set `takesRepoContext: true` on the `spawn-issue` entry and on all seven
`auto-fix-all-github-*` entries in `core/lib/core/commands.js`. The seven
`auto-fix-all-github-*` entries share the single `AutoFixAllGithub` class, so they
have to flip as one set. Do this step together with steps 02/03 in the same
change (the flag and the class shape must land together — a flag flipped ahead of
the constructor change breaks dispatch), but the registry + registry-spec edits
are grouped here for clarity.

Update the `takesRepoContext` JSDoc line on the `CommandEntry` typedef in
`commands.js` (currently: "Set on the `arcanum-split-issue-*` and `auto-fix-all-*`
lifecycle commands …") to also mention `spawn-issue` and the
`auto-fix-all-github-*` family.

In `core/spec/lib/core/commands_spec.js`, the test
`'sets takesRepoContext on the migrated arcanum-split-issue and auto-fix-all
lifecycle entries and the test fixture'` asserts the exact list of flagged
entries with `toEqual`. Add the eight new names in `COMMANDS` insertion order:

- `spawn-issue` is the **last** key in `COMMANDS`, so it goes at the end of the array.
- The seven `auto-fix-all-github-*` entries sit between `auto-fix-all-cleanup-artifacts`
  and `auto-fix-all-reply-comment` in insertion order:
  `auto-fix-all-github-add-tag`, `auto-fix-all-github-cleanup-branch`,
  `auto-fix-all-github-has-shipit-label`, `auto-fix-all-github-pr-merge`,
  `auto-fix-all-github-pr-number`, `auto-fix-all-github-pr-state`,
  `auto-fix-all-github-remove-tag`.

Update the test's `it(...)` description to reflect that `spawn-issue` and the
`auto-fix-all-github-*` entries are now included.

## Files to Change

- `core/lib/core/commands.js` — add `takesRepoContext: true` to `spawn-issue` and
  the seven `auto-fix-all-github-*` entries; refresh the `CommandEntry`
  `takesRepoContext` JSDoc.
- `core/spec/lib/core/commands_spec.js` — extend the exact-match `toEqual` list
  with the eight new entry names in insertion order; update the `it` description.

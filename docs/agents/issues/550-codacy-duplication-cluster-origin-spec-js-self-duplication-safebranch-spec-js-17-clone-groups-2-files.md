# Codacy: duplication cluster — Origin_spec.js self-duplication + SafeBranch_spec.js (17 clone groups, 2 files)

## Context

`core/spec/lib/utils/git/Origin_spec.js` repeats its git-remote-parsing assertion block (domain/repo extraction) 3-4 times at different offsets (roughly lines 93-105, 96-105, 113-122, 161-173, 164-173, 182-191), one per remote-URL format tested by copy-paste, and shares a small 5-6 line fragment with `core/spec/lib/commands/shared/SafeBranch_spec.js`. Codacy reports 17 clone groups and roughly 40 duplicated lines across the pair.

## What needs to be done

- Replace the repeated remote-format assertions in `Origin_spec.js` with an `it.each(remoteUrlFixtures)` parameterized test.
- Use a single `parsesOrigin(url, expected)` helper for the parameterized test, shared with `SafeBranch_spec.js` where applicable.

## Acceptance criteria

- [ ] The repeated remote-format assertions in `Origin_spec.js` are replaced by a single parameterized test.
- [ ] The shared fragment with `SafeBranch_spec.js` is factored into the common `parsesOrigin` helper.
- [ ] Both specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this pair drops substantially after the fix lands.

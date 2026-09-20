# Codacy: duplication cluster — autoFixAllReplyCommentParity trio internal duplication (3 files)

## Context

Three specs in `core/spec/bin/autoFixAllReplyCommentParity/` share a REST-mock-setup + "reply posted" assertion block, distinct from the argument-validation pattern tracked separately:

- `preconditions_spec.js`
- `rest_failure_spec.js`
- `happy_path_spec.js`

`preconditions_spec.js` lines 85-112 map onto `rest_failure_spec.js` lines 17-53 and `happy_path_spec.js` lines 18-49 almost verbatim. Codacy reports duplication scores as high as 480 for `preconditions_spec.js` alone, with roughly 90 duplicated lines shared across the trio.

## What needs to be done

- Introduce a `replyCommentRestFixture()` helper encapsulating the REST stub + assertion shared by these three files.
- Replace the duplicated REST-mock/assert blocks in `preconditions_spec.js`, `rest_failure_spec.js`, and `happy_path_spec.js` with calls to the new helper.
- Keep this helper separate from any argument-validation helper introduced for the sibling "missing required argument" duplication cluster.

## Acceptance criteria

- [ ] A `replyCommentRestFixture()` helper exists under `core/spec/support` (or equivalent) and is used by all three files listed above.
- [ ] The duplicated REST-mock/assert blocks are removed from each file in favor of the shared fixture.
- [ ] All three specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this folder drops substantially after the fix lands.

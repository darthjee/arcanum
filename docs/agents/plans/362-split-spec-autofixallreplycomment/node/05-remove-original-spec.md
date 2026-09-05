# Remove the original AutoFixAllReplyComment_spec.js

Once steps 01–04 are in place and every `it` from the original file has a home in one of the
three new spec files (importing shared fakes/constants from the new factory module instead of
redeclaring them locally), delete
`core/spec/lib/commands/auto-fix-all/AutoFixAllReplyComment_spec.js`.

Before deleting, double-check nothing else in the repo imports from this file directly (it's a
leaf spec file, so this should be a no-op check, not an expected finding).

## Files to Change

- `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyComment_spec.js` — delete; fully
  superseded by `AutoFixAllReplyCommentValidation_spec.js`,
  `AutoFixAllReplyCommentHappyPath_spec.js`, and `AutoFixAllReplyCommentFailureModes_spec.js`.

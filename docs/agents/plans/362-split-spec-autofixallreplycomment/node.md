# node Plan: Split spec AutoFixAllReplyComment

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared spec helpers into a factory module](node/01-extract-shared-helpers.md)
- [02 — Add AutoFixAllReplyCommentValidation_spec.js](node/02-add-validation-spec.md)
- [03 — Add AutoFixAllReplyCommentHappyPath_spec.js](node/03-add-happy-path-spec.md)
- [04 — Add AutoFixAllReplyCommentFailureModes_spec.js](node/04-add-failure-modes-spec.md)
- [05 — Remove the original AutoFixAllReplyComment_spec.js](node/05-remove-original-spec.md)

## CI Checks

- `core`: `make core-test` (CI job: `test`)
- `core`: `make core-lint` (CI job: lint step, same `test` workflow)

## Notes

- Pure reorganization: `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js` and
  `IssueClient` are not touched, and no assertion changes — every `it` body, its expectations,
  and its describe nesting under `#run` move verbatim.
- After the split, total spec count (`it` count) must be unchanged: 8 (validation) + 1 (happy
  path) + 4 (failure modes: 2 REST-call + 1 resolve_pr_number.sh + 1 git push) = 13.
- Follows the same shape as the already-merged `AutoFixAllWaitCi` split (issue #361) and
  `AutoFixAllQueue` split (issue #360): named-export factory module under
  `core/spec/support/factories/`, one flat spec file per scenario group under
  `core/spec/lib/commands/auto-fix-all/`.

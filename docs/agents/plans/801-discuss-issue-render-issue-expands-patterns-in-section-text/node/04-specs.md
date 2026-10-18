# Specs: verbatim output and parity with hostile input

Add cases using the plan's hostile fixture:

- **Native unit** (`DiscussIssueRenderIssue_spec.js`): the fixture in every section
  and in the title. Assert the exact written file content (verbatim insertion, stray
  `%%SOLUTION%%`/`%%BODY%%` kept literally, blank-line collapsing still applied).
- **Native unit** (`AutoFixAllReplyCommentHappyPath_spec.js`): the fixture as body,
  plus a `$&`-containing agent/model name. Assert the exact posted body.
- **Parity** (`core/spec/bin/discussIssueRenderIssueParity_spec.js` and
  `core/spec/bin/autoFixAllReplyCommentParity/happy_path_spec.js`): a hostile-input
  case asserting byte-identical shell vs. native output **and** that it equals the
  expected verbatim rendering. Parity alone could pass if both sides were wrong the
  same way.
- **{agent} hardening**: one case each in `AutoNewIssueCommitIssue_spec.js`,
  `AutoPlanIssueCommitPlan_spec.js` and `AutoFixIssueCommitChange_spec.js` with a
  `$&`-containing agent value, if each command's input path lets one through.
  Otherwise test the helper directly.

Before the fix, the shell-side parity cases should fail under bash ≥ 5.2. Confirm this
locally against `main` if practical.

## Files to Change

- `core/spec/lib/commands/discuss-issue/DiscussIssueRenderIssue_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyCommentHappyPath_spec.js`
- `core/spec/bin/discussIssueRenderIssueParity_spec.js`
- `core/spec/bin/autoFixAllReplyCommentParity/happy_path_spec.js`
- `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js`
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js`

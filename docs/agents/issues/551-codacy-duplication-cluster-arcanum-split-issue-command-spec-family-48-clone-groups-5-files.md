# Codacy: duplication cluster — arcanum-split-issue command spec family (48 clone groups, 5 files)

## Context

Five specs share an 8-12 line "resolve issue file / seed issue state" setup fragment:

- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueFinish_spec.js`
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssuePushSubIssues_spec.js`
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue_spec.js`
- `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssueFile_spec.js`
- `core/spec/lib/commands/shared/IssueState_spec.js`

`ArcanumSplitIssueFinish_spec.js` additionally self-duplicates a "finish and report" assertion block three times internally (roughly lines 96-100/124-128/173-177 and 104-111/128-135). Codacy reports 48 clone groups and roughly 90 duplicated lines across this family.

## What needs to be done

- Factor the shared issue-state/resolve-file setup into a single `splitIssueCommandFixture()` used by all five specs.
- Collapse `ArcanumSplitIssueFinish_spec.js`'s repeated finish-assertion blocks into an `it.each` table.

## Acceptance criteria

- [ ] A `splitIssueCommandFixture()` helper exists and is used by all five listed specs.
- [ ] The repeated finish-assertion blocks in `ArcanumSplitIssueFinish_spec.js` are collapsed into a single parameterized test.
- [ ] All five specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this family drops substantially after the fix lands.

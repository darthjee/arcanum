# Codacy: duplication cluster — label/tag mutation assertion block (58 clone groups, 5 files)

## Context

Five otherwise-unrelated specs share an 8-10 line "expect labels array to contain X, not Y" assertion block reused verbatim:

- `core/spec/lib/commands/auto-fix-all/AutoFixAllConfig_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllQueuePop_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueGithubPrView_spec.js`
- `core/spec/lib/utils/issue/IssueTaggerMarkEnqueued_spec.js`

`AutoFixAllConfig_spec.js` additionally self-duplicates the block twice internally (lines 90-98 and 105-113 mirror 185-194/223-232). Codacy reports 58 clone groups and roughly 90 duplicated lines across these five files.

## What needs to be done

- Add a `haveAppliedLabels(expected)` custom matcher (or equivalent shared example) so label-mutation expectations aren't hand-copied into every consumer spec.
- Apply the new matcher/example to all five files listed above, including collapsing the internal repetition in `AutoFixAllConfig_spec.js`.

## Acceptance criteria

- [ ] A `haveAppliedLabels(expected)` matcher or shared example exists and is used by all five listed specs.
- [ ] The duplicated label-assertion blocks (including internal repetition in `AutoFixAllConfig_spec.js`) are removed in favor of the shared matcher/example.
- [ ] All five specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score across these five files drops substantially after the fix lands.

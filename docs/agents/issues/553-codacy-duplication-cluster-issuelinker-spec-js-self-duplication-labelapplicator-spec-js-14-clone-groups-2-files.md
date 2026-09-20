# Codacy: duplication cluster — IssueLinker_spec.js self-duplication + LabelApplicator_spec.js (14 clone groups, 2 files)

## Context

`core/spec/lib/utils/issue/IssueLinker_spec.js` repeats its own "link sub-issue" assertion block at three offsets (roughly lines 105-110/125-130/157-163, 68-75/87-94, 125-136/139-150), and shares a short setup fragment with `core/spec/lib/utils/issue/LabelApplicator_spec.js` (roughly lines 21-28 vs. 15-21). Codacy reports 14 clone groups and roughly 40 duplicated lines across the pair.

## What needs to be done

- Parameterize `IssueLinker_spec.js`'s link-scenario assertions via `it.each`.
- Extract the shared label/link setup fragment into a common issue-fixture helper used by both `IssueLinker_spec.js` and `LabelApplicator_spec.js`.

## Acceptance criteria

- [ ] The repeated link-scenario assertions in `IssueLinker_spec.js` are replaced by a single parameterized test.
- [ ] A common issue-fixture helper replaces the shared setup fragment in both files.
- [ ] Both specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this pair drops substantially after the fix lands.

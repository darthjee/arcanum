# Codacy: duplication cluster — AutoFixIssueCreateBranch_spec.js internal self-duplication (34 clone groups, 1 file)

## Context

`core/spec/lib/commands/auto-fix-issue/AutoFixIssueCreateBranch_spec.js` (135 lines) repeats a 6-7 line "branch already exists" scenario six times at slightly shifted offsets (roughly lines 100-107, 113-119, 126-131, 136-142, 146-152, 156-162), each testing a near-identical branch-name-collision variant. Codacy reports 34 clone groups and roughly 60 duplicated lines within this file.

## What needs to be done

- Collapse the six near-duplicate collision scenarios into a single `it.each(collisionCases)` parameterized test.
- Drive the parameterized test with a shared `expectBranchCollisionHandled(name)` helper.

## Acceptance criteria

- [ ] The six repeated branch-collision scenarios in `AutoFixIssueCreateBranch_spec.js` are replaced by a single parameterized test.
- [ ] The spec passes with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for this file drops substantially after the fix lands.

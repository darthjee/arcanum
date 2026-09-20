# Codacy: duplication cluster — commit-command spec quartet (auto-new-issue/auto-plan-issue/auto-fix-issue/auto-fix-all) (~30 clone groups, 4 files)

## Context

Codacy's duplication analysis flags heavy cross-file cloning between four "commit the artifact and stage it" specs:

- `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js`
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js`
- `core/spec/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts_spec.js`

These four specs share a near-identical `describe`/setup block (roughly lines 3-70 in each) for building a fake repo, staging files, and mocking git. Each file additionally repeats a ~7-8 line "commit message assertion" block 5-6 times internally per scenario (e.g. `AutoNewIssueCommitIssue_spec.js` lines 181-188, 196-203, 215-222, 235-242, 248-255, 260-267 are the same assertion shape with only the trigger changed). Total duplication scores across the four files exceed 900 in Codacy's report, with ~30 clone groups and an estimated 500+ duplicated lines.

## What needs to be done

- Extract the shared repo/git-mock bootstrap into a `commitCommandSetup()` shared-context helper under `core/spec/support`.
- Replace the repeated per-scenario commit-assertion blocks in each of the four specs with a small `itCommitsWithMessage(matcher)` shared example.
- Verify all four specs still pass unchanged in behavior after the extraction (no test coverage should be lost).

## Acceptance criteria

- [ ] A shared `commitCommandSetup()` helper (or equivalent shared context) exists under `core/spec/support` and is used by all four specs listed above.
- [ ] The repeated commit-assertion blocks are replaced by a shared example (e.g. `itCommitsWithMessage`) in all four specs.
- [ ] `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js`, `AutoPlanIssueCommitPlan_spec.js`, `AutoFixIssueCommitChange_spec.js`, and `AutoFixAllCleanupArtifacts_spec.js` all pass with no reduction in asserted behavior.
- [ ] Codacy's duplication score for these four files drops substantially after the fix lands.

# Move spec files into mirrored subfolders

Mirror the exact same four subfolders under `core/spec/lib/commands/`, moving each `*_spec.js` alongside its corresponding source file via `git mv`. This matches the existing precedent of `core/spec/lib/utils/` mirroring `core/lib/utils/`'s nested subfolders 1:1, and Jasmine's spec glob (`core/spec/support/jasmine.json`: `"lib/**/*_spec.js"`) already picks up nested specs with no config change. Each moved spec file lands one directory deeper, so its relative imports need an extra `../`: `../../../lib/commands/<Name>.js` → `../../../../lib/commands/<subfolder>/<Name>.js`, and `../../support/...` → `../../../support/...`.

## Files to Change

- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssue_spec.js` → `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue_spec.js` — fix import depth
- `core/spec/lib/commands/ArcanumSplitIssueCreateSubIssueFile_spec.js` → `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssueFile_spec.js` — fix import depth
- `core/spec/lib/commands/ArcanumSplitIssueFinish_spec.js` → `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssueFinish_spec.js` — fix import depth
- `core/spec/lib/commands/ArcanumSplitIssuePushSubIssues_spec.js` → `core/spec/lib/commands/arcanum-split-issue/ArcanumSplitIssuePushSubIssues_spec.js` — fix import depth
- `core/spec/lib/commands/ArcanumUpdateRunUpdate_spec.js` → `core/spec/lib/commands/arcanum-update/ArcanumUpdateRunUpdate_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllCheckoutFromMain_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllCheckoutFromMain_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllCleanupArtifacts_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllConfig_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllConfig_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllGithub_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllGithub_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllQueue_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllQueue_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllReplyComment_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllReplyComment_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllWaitCi_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCi_spec.js` — fix import depth
- `core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js` → `core/spec/lib/commands/auto-fix-all/AutoFixAllWaitCiAndMerge_spec.js` — fix import depth
- `core/spec/lib/commands/DispatchFixture_spec.js` → `core/spec/lib/commands/shared/DispatchFixture_spec.js` — fix import depth
- `core/spec/lib/commands/GithubIssue_spec.js` → `core/spec/lib/commands/shared/GithubIssue_spec.js` — fix import depth
- `core/spec/lib/commands/IssueState_spec.js` → `core/spec/lib/commands/shared/IssueState_spec.js` — fix import depth
- `core/spec/lib/commands/ListAgents_spec.js` → `core/spec/lib/commands/shared/ListAgents_spec.js` — fix import depth
- `core/spec/lib/commands/PermissionGrant_spec.js` → `core/spec/lib/commands/shared/PermissionGrant_spec.js` — fix import depth
- `core/spec/lib/commands/ResolveAndFetch_spec.js` → `core/spec/lib/commands/shared/ResolveAndFetch_spec.js` — fix import depth
- `core/spec/lib/commands/ResolveIdAndFile_spec.js` → `core/spec/lib/commands/shared/ResolveIdAndFile_spec.js` — fix import depth
- `core/spec/lib/commands/ResolvePlanPaths_spec.js` → `core/spec/lib/commands/shared/ResolvePlanPaths_spec.js` — fix import depth
- `core/spec/lib/commands/SafeBranch_spec.js` → `core/spec/lib/commands/shared/SafeBranch_spec.js` — fix import depth
- `core/spec/lib/commands/SpawnIssue_spec.js` → `core/spec/lib/commands/shared/SpawnIssue_spec.js` — fix import depth

## Notes
- Double-check each spec file individually before assuming the depth fix is mechanical: a few specs may import additional relative fixtures beyond the `../../../lib/commands/...` and `../../support/...` patterns already surveyed — grep each file's `^import` block after moving it.
- `core/spec/bin/arcanumSplitIssueFinishParity_spec.js` also references a `lib/commands/` path in a comment only (not a live import) — verify it after the move and update the comment's path if it still points at the old flat location.

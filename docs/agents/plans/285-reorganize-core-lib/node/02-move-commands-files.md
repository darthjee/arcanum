# Move commands/ files into commands/

Move every `core/lib/*.js` file that is dispatched directly through `core/bin/arcanum`'s `COMMANDS` registry into `core/lib/commands/`. By this point (after step 01) every `utils/` file is already at its final path, so each moved file's imports of `utils/*` files can be set to their final relative path (`../utils/<category>/<Name>.js`) in one edit; imports of sibling `commands/*` files become `./<Name>.js`.

Note: `Greeter.js` is excluded here even though the original draft proposed it for `commands/` — it's deleted in step 03, not moved.

## Files to Change

- `core/lib/ArcanumSplitIssueCreateSubIssue.js` → `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js`
- `core/lib/ArcanumSplitIssueCreateSubIssueFile.js` → `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js`
- `core/lib/ArcanumSplitIssueFinish.js` → `core/lib/commands/ArcanumSplitIssueFinish.js`
- `core/lib/ArcanumSplitIssuePushSubIssues.js` → `core/lib/commands/ArcanumSplitIssuePushSubIssues.js` (imports `ArcanumSplitIssueCreateSubIssue.js`, also moving here — same-folder sibling import)
- `core/lib/ArcanumUpdateRunUpdate.js` → `core/lib/commands/ArcanumUpdateRunUpdate.js`
- `core/lib/AutoFixAllCheckoutFromMain.js` → `core/lib/commands/AutoFixAllCheckoutFromMain.js`
- `core/lib/AutoFixAllCleanupArtifacts.js` → `core/lib/commands/AutoFixAllCleanupArtifacts.js`
- `core/lib/AutoFixAllConfig.js` → `core/lib/commands/AutoFixAllConfig.js`
- `core/lib/AutoFixAllGithub.js` → `core/lib/commands/AutoFixAllGithub.js`
- `core/lib/AutoFixAllQueue.js` → `core/lib/commands/AutoFixAllQueue.js` (imports `QueueStore.js`, now at `utils/queue/`)
- `core/lib/AutoFixAllReplyComment.js` → `core/lib/commands/AutoFixAllReplyComment.js`
- `core/lib/AutoFixAllWaitCi.js` → `core/lib/commands/AutoFixAllWaitCi.js`
- `core/lib/AutoFixAllWaitCiAndMerge.js` → `core/lib/commands/AutoFixAllWaitCiAndMerge.js` (imports `AutoFixAllGithub.js` and `AutoFixAllWaitCi.js`, both moving here — same-folder sibling imports)
- `core/lib/DispatchFixture.js` → `core/lib/commands/DispatchFixture.js`
- `core/lib/GithubIssue.js` → `core/lib/commands/GithubIssue.js` (imports `GithubToken.js`, now at `utils/github/`)
- `core/lib/IssueState.js` → `core/lib/commands/IssueState.js` (imports `Tags.js`, now at `utils/issue/`)
- `core/lib/ListAgents.js` → `core/lib/commands/ListAgents.js`
- `core/lib/PermissionGrant.js` → `core/lib/commands/PermissionGrant.js` (imports `Lock.js`, now at `utils/file/`)
- `core/lib/ResolveAndFetch.js` → `core/lib/commands/ResolveAndFetch.js` (imports `GithubIssue.js`, `IssueFile.js`, `SafeBranch.js` — `GithubIssue` a same-folder sibling, `IssueFile`/`SafeBranch` now under `utils/`)
- `core/lib/ResolveIdAndFile.js` → `core/lib/commands/ResolveIdAndFile.js`
- `core/lib/ResolvePlanPaths.js` → `core/lib/commands/ResolvePlanPaths.js`
- `core/lib/SafeBranch.js` → `core/lib/commands/SafeBranch.js` (imports `Origin.js`, now at `utils/git/`)
- `core/lib/SpawnIssue.js` → `core/lib/commands/SpawnIssue.js` (imports `GithubIssue.js`, a same-folder sibling)
- every file across `core/lib/commands/` and `core/lib/utils/**` (moved in step 01) that imports any file being moved here — grep for each old filename and update the import path to the new `commands/`-relative location

## Files to Change (fan-in from the DispatchFailure/InvocationLog swept in step 01)

- Every `core/lib/commands/*.js` file that imports `DispatchFailure.js` or `InvocationLog.js` (both already at their final `utils/errors/` and `utils/logging/` paths after step 01) — since these importers move folders in this step, recompute the relative path from `commands/` (e.g. `../utils/errors/DispatchFailure.js`).

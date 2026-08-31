# Move source command files into subfolders

Group `core/lib/commands/`'s 23 files into four new subfolders by owning skill, using `git mv` for each file so history survives. After moving, every file lands one directory deeper, so its own relative imports to `../context/...`, `../utils/...`, and `../services/...` need an extra `../` (e.g. `../context/RepoContext.js` → `../../context/RepoContext.js`). Two files also import a sibling that lands in a *different* new subfolder and need that import's whole path rewritten, not just the depth; the rest of the sibling imports stay `./<Name>.js` because both files land in the same subfolder.

## Files to Change

- `core/lib/commands/ArcanumSplitIssueCreateSubIssue.js` → `core/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssue.js` — fix depth on its own imports; its `import SpawnIssue from './SpawnIssue.js'` becomes `import SpawnIssue from '../shared/SpawnIssue.js'` (SpawnIssue lands in `shared/`)
- `core/lib/commands/ArcanumSplitIssueCreateSubIssueFile.js` → `core/lib/commands/arcanum-split-issue/ArcanumSplitIssueCreateSubIssueFile.js` — fix depth on its own imports
- `core/lib/commands/ArcanumSplitIssueFinish.js` → `core/lib/commands/arcanum-split-issue/ArcanumSplitIssueFinish.js` — fix depth on its own imports; its `import SafeBranch from './SafeBranch.js'` becomes `import SafeBranch from '../shared/SafeBranch.js'` (SafeBranch lands in `shared/`)
- `core/lib/commands/ArcanumSplitIssuePushSubIssues.js` → `core/lib/commands/arcanum-split-issue/ArcanumSplitIssuePushSubIssues.js` — fix depth on its own imports; its `import ArcanumSplitIssueCreateSubIssue from './ArcanumSplitIssueCreateSubIssue.js'` stays unchanged (both files land in `arcanum-split-issue/`)
- `core/lib/commands/ArcanumUpdateRunUpdate.js` → `core/lib/commands/arcanum-update/ArcanumUpdateRunUpdate.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllCheckoutFromMain.js` → `core/lib/commands/auto-fix-all/AutoFixAllCheckoutFromMain.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllCleanupArtifacts.js` → `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllConfig.js` → `core/lib/commands/auto-fix-all/AutoFixAllConfig.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllGithub.js` → `core/lib/commands/auto-fix-all/AutoFixAllGithub.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllQueue.js` → `core/lib/commands/auto-fix-all/AutoFixAllQueue.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllReplyComment.js` → `core/lib/commands/auto-fix-all/AutoFixAllReplyComment.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllWaitCi.js` → `core/lib/commands/auto-fix-all/AutoFixAllWaitCi.js` — fix depth on its own imports
- `core/lib/commands/AutoFixAllWaitCiAndMerge.js` → `core/lib/commands/auto-fix-all/AutoFixAllWaitCiAndMerge.js` — fix depth on its own imports; its `import AutoFixAllGithub from './AutoFixAllGithub.js'` and `import AutoFixAllWaitCi from './AutoFixAllWaitCi.js'` stay unchanged (both land in `auto-fix-all/`)
- `core/lib/commands/GithubIssue.js` → `core/lib/commands/shared/GithubIssue.js` — fix depth on its own imports
- `core/lib/commands/IssueState.js` → `core/lib/commands/shared/IssueState.js` — fix depth on its own imports
- `core/lib/commands/ListAgents.js` → `core/lib/commands/shared/ListAgents.js` — fix depth on its own imports
- `core/lib/commands/PermissionGrant.js` → `core/lib/commands/shared/PermissionGrant.js` — fix depth on its own imports
- `core/lib/commands/ResolveAndFetch.js` → `core/lib/commands/shared/ResolveAndFetch.js` — fix depth on its own imports; its `import GithubIssue from './GithubIssue.js'` and `import SafeBranch from './SafeBranch.js'` stay unchanged (both land in `shared/`)
- `core/lib/commands/ResolveIdAndFile.js` → `core/lib/commands/shared/ResolveIdAndFile.js` — fix depth on its own imports
- `core/lib/commands/ResolvePlanPaths.js` → `core/lib/commands/shared/ResolvePlanPaths.js` — fix depth on its own imports
- `core/lib/commands/SafeBranch.js` → `core/lib/commands/shared/SafeBranch.js` — fix depth on its own imports
- `core/lib/commands/SpawnIssue.js` → `core/lib/commands/shared/SpawnIssue.js` — fix depth on its own imports
- `core/lib/commands/DispatchFixture.js` → `core/lib/commands/shared/DispatchFixture.js` — no imports to fix (none currently); moved unchanged otherwise, per the issue's decision to keep it (not remove it — see issue #340 for the separate removal investigation)

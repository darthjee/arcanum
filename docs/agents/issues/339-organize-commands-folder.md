# Issue: Organize commands folder

## Description
`core/lib/commands/` holds 23 flat files spanning several unrelated skill families (`ArcanumSplitIssue*`, `AutoFixAll*`, `ArcanumUpdateRunUpdate`) plus a handful of cross-cutting utilities called from many skills (`GithubIssue`, `IssueState`, `ListAgents`, `PermissionGrant`, `ResolveAndFetch`, `ResolveIdAndFile`, `ResolvePlanPaths`, `SafeBranch`, `SpawnIssue`, `DispatchFixture`). Reorganize it into subfolders grouped by owning skill, mirroring the same structure into `core/spec/lib/commands/` and keeping `core/lib/core/commands.js`'s registry in sync — with no change to command behavior or CLI-facing command names.

## Problem
The flat layout makes it hard to see which commands belong together, and will not scale as more shell-based commands are migrated to native Node.js — `docs/agents/architecture/entrypoint-migration-status.md` lists roughly 20 more still pending (`auto-fix-issue-*`, `discuss-issue-*`, `monitor-issues-*`, `init-claude-*`, `auto-monitor-issue-pr-*`, `auto-monitor-pr-*`, `auto-new-issue-*`, `auto-plan-issue-*`).

## Solution

### Subfolder scheme

Group `core/lib/commands/` by **owning skill**, using the command-name prefix as the folder name — this falls out mechanically from the existing `<skill>-<operation>` naming convention and keeps working as more commands are migrated (each future migration gets its own same-named folder for free). Today's 23 files map to:

- `commands/arcanum-split-issue/` — `ArcanumSplitIssueCreateSubIssue.js`, `ArcanumSplitIssueCreateSubIssueFile.js`, `ArcanumSplitIssueFinish.js`, `ArcanumSplitIssuePushSubIssues.js`
- `commands/arcanum-update/` — `ArcanumUpdateRunUpdate.js`
- `commands/auto-fix-all/` — `AutoFixAllCheckoutFromMain.js`, `AutoFixAllCleanupArtifacts.js`, `AutoFixAllConfig.js`, `AutoFixAllGithub.js`, `AutoFixAllQueue.js`, `AutoFixAllReplyComment.js`, `AutoFixAllWaitCi.js`, `AutoFixAllWaitCiAndMerge.js`
- `commands/shared/` — cross-cutting utilities with no single owning skill: `GithubIssue.js`, `IssueState.js`, `ListAgents.js`, `PermissionGrant.js`, `ResolveAndFetch.js`, `ResolveIdAndFile.js`, `ResolvePlanPaths.js`, `SafeBranch.js`, `SpawnIssue.js`, `DispatchFixture.js`

`core/lib/core/commands.js`'s `module:` paths must be updated to match every moved file, and its own header JSDoc example (`commands/SpawnIssue.js`) updated to the new path.

### Spec folder mirrors the same structure

`core/spec/lib/commands/` gets the same four subfolders, each `*_spec.js` moving alongside its corresponding source file — matching existing precedent (`core/lib/utils/` already has nested subfolders mirrored 1:1 in `core/spec/lib/utils/`). Jasmine's spec glob (`"lib/**/*_spec.js"`) already picks up nested specs with no config change needed.

### dispatch-fixture stays

`DispatchFixture.js` is not dead code: `dispatch-fixture` is the reference command proving shell↔native dispatch parity (`arcanum/_lib/test_engine_dispatch.sh` byte-matches it against `arcanum/_lib/test_fixtures/dispatch_fixture.sh`), and `dispatch-fixture-crash` is deliberately kept logged to prove `InvocationLog#record` survives a crashing command (plan #244/issue #192). It just moves into `commands/shared/` unchanged. Whether it can eventually be retired is a separate concern, spun off into sub-issue #340.

### Backward compatibility

No external break: consuming code only calls `engine_dispatch <repo> <command-name>`, resolved through the `COMMANDS` registry — command names are unchanged. Internally, since there is no import-resolution lint rule, every relative import affected by the move needs fixing by hand and verifying via the test suite:

1. Every `../context/...`, `../utils/...`, `../services/...` import inside each moved file needs an extra `../`.
2. Cross-folder sibling imports where the two files land in *different* new subfolders: `ArcanumSplitIssueFinish.js` → `SafeBranch.js`, `ArcanumSplitIssueCreateSubIssue.js` → `SpawnIssue.js`.
3. `core/lib/context/RepoContext.js` statically imports `GithubIssue` from `../commands/GithubIssue.js` — must become `../commands/shared/GithubIssue.js`.
4. Every spec file's relative paths need the equivalent depth adjustment.

### Edge cases

Checked `.jscpd.json`, `package.json`'s `c8.exclude`, and `scripts/generate_entrypoint_migration_status.sh` for flat-path assumptions — none found (all use recursive globs or `git log --follow` on an unrelated file). Use `git mv` for every relocation so each file's git history survives the move.

### Scope

**In scope**: moving all 23 files into the four subfolders, mirroring `core/spec/lib/commands/`, updating `commands.js` and its stale JSDoc example, fixing every affected relative import, using `git mv`, verifying with a full `npm test` run.

**Out of scope**: removing/retiring `dispatch-fixture`/`dispatch-fixture-crash` (#340), migrating any still-shell-only command, any behavior/logic change, renaming CLI-facing command names, changes to `dispatcher.js`/`core/bin/arcanum`, further subdividing `shared/`.

## Benefits
- Commands are discoverable by feature area instead of an alphabetical wall of 23 files
- Future migrations (per the migration-status doc) get a home for free — one folder per skill prefix, no repeat reorg needed
- Spec structure mirrors source 1:1, matching existing `core/lib/utils/` precedent
- Pure internal reorg: no behavior change, no CLI-facing break, verified by the full test suite

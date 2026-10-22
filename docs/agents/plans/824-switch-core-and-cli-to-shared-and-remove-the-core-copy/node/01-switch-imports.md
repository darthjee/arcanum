# Switch core imports to shared/lib

Check first that `diff -r core/lib/shared shared/lib` prints nothing. Then rewrite every import of the surface to point at `shared/lib/`, with relative paths.

- `core/lib/<x>/File.js` importing `../shared/config/X.js` becomes `../../../shared/lib/config/X.js`. In general, go one level further up for each folder between the file and `core/`, then add `shared/lib/`.
- Core specs and spec support use the same rewrite, e.g. `core/spec/lib/utils/config/*_spec.js` importing `../../../../lib/shared/file/Lock.js` becomes `../../../../../shared/lib/file/Lock.js`.
- After the edit, check with: `grep -rnE "(\.\./)+(lib/)?shared/(config|file)/" core/lib core/bin core/spec`. The only matches left must be the new `shared/lib/` imports.

Interop specs stay in core and only change their imports: `core/spec/lib/utils/config/ShellConfigKeyScan_spec.js`, `KeyRegistryDefaults_spec.js` and `core/spec/bin/agentEmailParity_spec.js`.

## Files to Change

- `core/lib/context/RepoContext.js`, `core/lib/services/IssueStateService.js` and `core/lib/utils/config/BooleanKeyConfig.js`: switch their surface imports.
- `core/lib/commands/**`: `auto-new-issue/AutoNewIssueCommitIssue.js`, `auto-plan-issue/AutoPlanIssueCommitPlan.js`, `auto-fix-issue/AutoFixIssueCommitChange.js`, `monitor-issues/MonitorIssuesRewriteQueue.js`, `shared/IssueState.js`, `shared/GithubIssue.js`, `shared/SafeBranch.js`, `shared/NextStepPrompt.js`, `shared/PermissionGrant.js`, `auto-fix-all/AutoFixAllQueue.js`, `auto-fix-all/AutoFixAllWaitCi.js`, `arcanum-check-config/ArcanumCheckConfig.js`, `init-claude/InitClaudeSetCiIgnoredPatterns.js`, `init-claude/InitClaudeStampArcanumVersion.js` and `init-claude/InitClaudeSetNextStepKey.js`: switch their surface imports.
- `core/spec/support/sharedExamples/issueStateWriteSharedExamples.js` and `core/spec/support/factories/autoFixAllQueue.js`: switch their `Lock` imports.
- `core/spec/lib/utils/config/*_spec.js`, `core/spec/lib/commands/**/*_spec.js` and `core/spec/lib/services/*_spec.js`: switch every `lib/shared/` import (see `grep -rln "lib/shared/" core/spec --exclude-dir=shared`).

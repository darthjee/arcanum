# Audit the remaining core readers

Check that no other `core/lib` code reads a registered config key straight from a tier file. Known state at planning time:

- `RepoContext#readConfig` → `ConfigChain#read`: covered automatically.
- `SafeBranch`, `AutoFixAllWaitCi` → `RepoConfig`: covered by the shared plan.
- `CoauthorTrailers`, `AgentEmail`, `NextStepPrompt`, `AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan`, `AutoFixIssueCommitChange`, `SpawnIssue` → `ConfigChain`: covered automatically.
- `InitClaudeStampArcanumVersion` (`version`, `migrations.version`): bookkeeping, out of scope. Leave it.
- `InitClaudeSetNextStepKey`, `InitClaudeSetCiIgnoredPatterns`: writers, out of scope.

Grep `core/lib` for `arcanum-config.json`, `arcanum-repo-config.json` and `readFile` once more. Move any remaining read of a registered key to `ConfigChain`, or list it in the PR description with the reason it stays. Check the specs that build these collaborators with a hand-made `ConfigChain` or fixture files, and update any fixture that set a key in a now-filtered tier.

## Files to Change

- None expected. Any file the grep turns up, plus its spec.

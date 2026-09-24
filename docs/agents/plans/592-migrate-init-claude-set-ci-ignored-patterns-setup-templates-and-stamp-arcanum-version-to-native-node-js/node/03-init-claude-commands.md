# Implement the three init-claude commands

Each class takes the `RepoContext` as its sole constructor argument, plus injectable collaborators. Each exposes `async run(...args)` that returns the stdout string, following the pattern of the other `run`-style commands (check `DiscussIssueRenderIssue.js` for how stdout and exit codes are returned). Behavior follows the shared output contracts exactly.

- `InitClaudeSetCiIgnoredPatterns#run(...args)` — builds the array (`--clear` → `[]`; otherwise the args split on `\n`) and calls `RepoConfigWriter#write` with `.claude/configuration/arcanum-repo-config.json`, `.claude/configuration/auto-fix-all.json`, `auto-fix-all`, `ignored_check_patterns`. Returns `''`. The zero-args usage error lives in the shim. Natively, throw a usage `Error` only as a defensive fallback.
- `InitClaudeSetupTemplates#run()` — `mkdir -p <repoPath>/.github`, then copies or skips the three templates from `resolveInstallPath('init-claude', 'templates', name)`. "Present" means a regular file, to match `[ -f ]`. Returns the `Created:` / `Already present, left untouched:` lines.
- `InitClaudeStampArcanumVersion#run()` — `InstallVersion#resolve(INSTALL_ROOT)`. If the result is semver, calls `RepoConfigWriter#setVersion` twice: the committed file with no namespace, then the local file with namespace `migrations`. Always returns `''`. Swallow resolution errors so the command never fails.

## Files to Change
- `core/lib/commands/init-claude/InitClaudeSetCiIgnoredPatterns.js` — new.
- `core/lib/commands/init-claude/InitClaudeSetupTemplates.js` — new.
- `core/lib/commands/init-claude/InitClaudeStampArcanumVersion.js` — new.
- `core/spec/lib/commands/init-claude/InitClaudeSetCiIgnoredPatterns_spec.js` — new.
- `core/spec/lib/commands/init-claude/InitClaudeSetupTemplates_spec.js` — new.
- `core/spec/lib/commands/init-claude/InitClaudeStampArcanumVersion_spec.js` — new. Cover zip, exact tag, no tag, non-semver (for example `v1.2.3`), and neither `arcanum.json` nor `.git`.

# Disallowed-tier fixtures in the shell-vs-native parity specs

Add cases to the existing shell-vs-native parity specs. Each case puts a value in a tier keys.json doesn't allow for that key, and asserts that shell and native give byte-identical output, both ignoring the value. Use the real installed keys.json and do not set `KEY_REGISTRY_FILE`, so each spec also checks the real registry.

- **`core/spec/bin/checkoutSafeBranchParity_spec.js`:** `git.safe_branch` set only in `.claude/configuration/arcanum-repo-config.json` (disallowed). Both sides check out `origin/main` (`BRANCH=origin/main`).
- **`core/spec/bin/autoFixAllWaitCiParity/`** (the suite that covers ignored check patterns): `auto-fix-all.ignored_check_patterns` set only in `.claude/state/arcanum-config.json` (disallowed). Both sides treat the pattern as not ignored.
- **`core/spec/bin/autoFixAllConfigParity/get_spec.js` and `is_enabled_spec.js`:**
  - `auto-fix-all.clear_context: true` only in the repo config (disallowed): get prints `false` and is_enabled fails, on both sides;
  - `clear_context: null` in the local state file: get prints `false` on both sides. This is the `null` fix; shell printed `null` before.
- **`core/spec/bin/monitorIssuesConfigParity/` get and is_enabled:** the same two cases for `monitor-issues.clear_context`.
- **`core/spec/bin/agentEmailParity_spec.js`** (positive control): a `git.agents.<agent>` value set only in the global tier (temp `CLAUDE_CONFIG_DIR`) is still resolved by shell, matching native.

If one of these suites can't express a case without large refactoring, add it as a focused new spec file in the same folder instead, and say so in the PR.

## Files to Change

- `core/spec/bin/checkoutSafeBranchParity_spec.js`: disallowed-tier case.
- `core/spec/bin/autoFixAllWaitCiParity/*_spec.js`: disallowed-tier case for `ignored_check_patterns`.
- `core/spec/bin/autoFixAllConfigParity/get_spec.js`, `is_enabled_spec.js`: disallowed-tier and `null` cases.
- `core/spec/bin/monitorIssuesConfigParity/*_spec.js` (get / is_enabled): disallowed-tier and `null` cases.
- `core/spec/bin/agentEmailParity_spec.js`: global-tier positive control.

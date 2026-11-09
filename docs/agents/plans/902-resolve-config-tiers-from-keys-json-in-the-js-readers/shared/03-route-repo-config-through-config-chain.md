# Route RepoConfig through ConfigChain

Replace `RepoConfig`'s hand-rolled file reads with `ConfigChain`:

- The constructor becomes `(repoContext, { env, configChain = new ConfigChain({ env }) } = {})`. Its existing callers (`core/lib/commands/shared/SafeBranch.js`, `AutoFixAllWaitCi.js`) keep working unchanged.
- `getSafeBranch()`: `const branch = await this._configChain.read(repoPath, 'git', 'safe_branch')`. Return `branch` when it is a non-empty string, otherwise `DEFAULT_SAFE_BRANCH`. This keeps the current behavior that `""` means the default.
- `getIgnoredCheckPatterns()`: `const patterns = await this._configChain.read(repoPath, 'auto-fix-all', 'ignored_check_patterns')`. Return `patterns` if it is an array, otherwise `[]`.
- Drop the direct `readFile`/`path` use and the explicit `assertRegisteredConfigKey` calls, since `ConfigChain` already asserts. Rewrite the class JSDoc: the reads now follow the key's `keys.json` tiers.

Spec cases:

- the existing local and repo cases still pass;
- `git.safe_branch` set only in the repo or global config → `origin/main`;
- `ignored_check_patterns` set only in the local or global config → `[]`;
- `""` → `origin/main`;
- a malformed local file → `origin/main`.

## Files to Change

- `shared/lib/config/RepoConfig.js`: read through `ConfigChain`.
- `shared/spec/config/RepoConfig_spec.js`: update and add the cases above.

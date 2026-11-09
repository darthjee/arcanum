# Route safe_branch_get and wait_ci_shell.sh through the chain

Both readers stop hardcoding a config file, mirroring #902's change to `RepoConfig#getSafeBranch` / `#getIgnoredCheckPatterns`.

- **`arcanum/_lib/safe_branch.sh`**
  - Source `config_chain.sh` instead of (or in addition to) `repo_config.sh`.
  - `safe_branch_get` becomes `config_chain_read "." git safe_branch`, keeping the quote-strip and the `origin/main` default.
  - Update the header comment: the tiers now come from keys.json, which today allows only `local`.
- **`auto-fix-all/scripts/wait_ci_shell.sh`**
  - Source `../../arcanum/_lib/config_chain.sh`.
  - Read with `config_chain_read "." auto-fix-all ignored_check_patterns`, keeping the `[]` default.
  - Update the comment near line 20 that names the repo config file.

Both calls use literal namespace and key arguments, so the static scan reads them without annotations.

## Files to Change

- `arcanum/_lib/safe_branch.sh`: `safe_branch_get` reads through `config_chain_read`.
- `auto-fix-all/scripts/wait_ci_shell.sh`: reads `ignored_check_patterns` through `config_chain_read`.

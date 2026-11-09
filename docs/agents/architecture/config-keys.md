# Config Keys

This is a lookup reference: every arcanum config key in [`shared/lib/config/keys.json`](../../../shared/lib/config/keys.json), with its type, allowed tiers, default, and where it is read from. It records **today's** behavior. For how the config files and the registry work, see [Shared State & Configuration Files](shared-state-and-configuration.md).

The main table is temporary. Once reads are driven by the registry (#902, #903, #905), #909 replaces it with a pointer to `keys.json`.

## Tiers and files

| Tier | File |
| --- | --- |
| local | `<repo>/.claude/state/arcanum-config.json` (gitignored, per clone) |
| repo | `<repo>/.claude/configuration/arcanum-repo-config.json` (committed) |
| global | `$CLAUDE_CONFIG_DIR/arcanum-config.json`, falling back to `$HOME/.claude/arcanum-config.json` (see [`arcanum-global-config.md`](../../guides/arcanum-global-config.md)) |

## How keys are read

Every key is read through the chain, shown in the **Read via** column below.

**`chain`**: read through `config_chain_read` ([`arcanum/_lib/config_chain.sh`](../../../arcanum/_lib/config_chain.sh)) in shell, or `ConfigChain#read` ([`shared/lib/config/ConfigChain.js`](../../../shared/lib/config/ConfigChain.js)) in JS. The tiers are tried in order: local, then repo, then global. The rules:

- The first value that is present and not `null` wins.
- `null` counts as absent and falls through to the next tier.
- `""` and `false` are real values and stop the chain. An explicit `false` in local overrides a `true` in global.
- A missing, unreadable or malformed file counts as absent.

**`chain` filtered by `tiers`.** In both JS and shell, the `tiers` field in `keys.json` **drives** every chain read (#902 for JS, #903 for shell): only the tiers a key's entry lists are consulted, and the others are silently skipped. In JS that is `ConfigChain#read` / `#readWithSource`, using `KeyRegistry#allowsTier` ([`shared/lib/config/KeyRegistry.js`](../../../shared/lib/config/KeyRegistry.js)). In shell it is `config_chain_read`, using `key_registry_allows_tier` from [`arcanum/_lib/key_registry.sh`](../../../arcanum/_lib/key_registry.sh), a `jq` mirror of `KeyRegistry#lookup` / `#allowsTier` that reads the installed `keys.json`. The filter never changes precedence: resolution is always local, then repo, then global, whatever order `keys.json` lists the tiers in. A key with no registry entry (or a non-leaf key such as `git.agents`) reads all three tiers, as before (`allowsTier` returns `null`, which counts as allowed).

Every reader in the table below goes through the chain. `RepoConfig` ([`shared/lib/config/RepoConfig.js`](../../../shared/lib/config/RepoConfig.js)) no longer opens files itself, and `safe_branch_get` and `wait_ci_shell.sh` call `config_chain_read`. `NamespacedBooleanKeyConfig` ([`core/lib/utils/config/NamespacedBooleanKeyConfig.js`](../../../core/lib/utils/config/NamespacedBooleanKeyConfig.js)) and its shell counterparts (`config_common.sh` in `auto-fix-all/scripts` and `monitor-issues/scripts`) read every key registered in `keys.json` through the chain. An unregistered key in their namespace, such as `auto-fix-all.auto_merge`, is still read straight from its file in both. Its legacy-file fallback stays until #904.

So, for every key:

- a value placed in a tier the key doesn't allow is ignored by both the JS and the shell readers;
- it is not invisible: `/arcanum-check-config` and `arcanum config get --all-tiers` / `config list` mark it `ignored: tier not allowed`, and `ConfigChain#readTiers` reports it with `allowed: false`;
- tiers are checked on write only when writing through the CLI (`KeyRegistry#check`). A hand edit, or a script writing the file directly, is not checked. The shell writers (`config_toggle_shell.sh`, `config_set_shell.sh`) still pick their file themselves (#905).

## Settings

Types, tiers and defaults come from `keys.json`. The defaults drift spec (`core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`) keeps them equal to the code's own fallbacks. `—` means the key has no default. Wildcard keys keep their placeholder in a single row. A reader that exists only in shell, or only in JS, is listed alone.

| Key | Type | Tiers | Default | Read via | Reader | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `engine.mode` | enum (`shell`, `native`, `docker`) | global, repo, local | `shell` | chain | shell: `arcanum/_lib/engine_dispatch.sh` → `engine_dispatch` | Shell only: the dispatch guard runs before any JS. See [Script Engine](script-engine.md). |
| `engine.log.location` | string | global, repo, local | — | chain | shell: `arcanum/_lib/engine_dispatch_docker.sh` (docker branch); JS: `core/lib/utils/logging/InvocationLog.js` (shells out to `config_chain_read`) | When absent, no invocation log is written and no log directory is mounted. See [Docker Engine](docker-engine.md). |
| `git.email` | string (may contain `{agent}`) | global, repo, local | — | chain | shell: `arcanum/_lib/agent_email.sh` → `agent_email_get`; JS: `shared/lib/config/AgentEmail.js` | Resolved together with `git.agents.<agent>`: at each tier, `git.agents.<agent>` is tried first, then `git.email`, before the next tier. So a local `git.email` beats a global `git.agents.<agent>`. When neither is set anywhere, commits fall back to the model's email. |
| `git.agents.<agent>` | string | global, repo, local | — | chain | shell: `arcanum/_lib/agent_email.sh` → `agent_email_get`; JS: `shared/lib/config/AgentEmail.js` | Resolved together with `git.email`, per tier (see the `git.email` row). When neither is set anywhere, commits fall back to the model's email. |
| `git.safe_branch` | string | local | `origin/main` | chain | shell: `arcanum/_lib/safe_branch.sh` → `safe_branch_get`; JS: `shared/lib/config/RepoConfig.js` → `getSafeBranch` | A value in the repo or global file is ignored. See [Branch Bootstrap and Merge Conflicts](branch-bootstrap-and-merge-conflicts.md). |
| `git.merge_body_mode` | enum (`full`, `empty`, `coauthors`) | global, repo, local | `empty` | chain | shell: `arcanum/_lib/merge_body.sh` → `merge_body_mode`; JS: `core/lib/utils/github/MergeBodyResolver.js` | An unrecognized value falls back to the default with a warning. |
| `git.omit_model_coauthor` | boolean | global, repo, local | `false` | chain | shell: `arcanum/_lib/agent_email.sh` → `model_coauthor_omitted` (also used by `merge_body.sh`); JS: `core/lib/utils/git/CoauthorTrailers.js`, `core/lib/utils/github/MergeBodyResolver.js` | |
| `git.remove_coauthors` | array of strings | global, repo, local | `[]` | chain | shell: `arcanum/_lib/agent_email.sh` → `remove_coauthors_list` (used by `merge_body.sh`); JS: `core/lib/utils/github/MergeBodyResolver.js` | |
| `next_step.auto.<skill>` | boolean | global, repo, local | `false` | chain | shell: `arcanum/_lib/next_step_prompt_shell.sh` (`--auto-key`); JS: `core/lib/commands/shared/NextStepPrompt.js` | Known instances (`setup.instances`): `enhance-issue`, `discuss-issue`, `auto-plan-issue`. `auto-plan-issue/scripts/auto_next.sh` (JS: `AutoPlanIssueAutoNext.js`) reads it through `next_step_prompt.sh`. |
| `next_step.clear.<skill>` | boolean | global, repo, local | `false` | chain | same readers as `next_step.auto.<skill>` | Read only when the matching `next_step.auto.<skill>` is `true`. |
| `auto-fix-all.ignored_check_patterns` | array of strings (regex) | repo | `[]` | chain | shell: `auto-fix-all/scripts/wait_ci_shell.sh`; JS: `shared/lib/config/RepoConfig.js` → `getIgnoredCheckPatterns` (used by `AutoFixAllWaitCi.js`) | Patterns match check names case-insensitively. A value in the local or global file is ignored.[^legacy] |
| `auto-fix-all.clear_context` | boolean | local | `false` | chain | shell: `auto-fix-all/scripts/config_common.sh` (+ `config_*_shell.sh`); JS: `core/lib/commands/auto-fix-all/AutoFixAllConfig.js` (`NamespacedBooleanKeyConfig`) | A value in the repo or global file is ignored. |
| `auto-fix-all.finish_on_empty_queue` | boolean | local | `false` | chain | shell: `auto-fix-all/scripts/config_common.sh` (+ `config_*_shell.sh`); JS: `core/lib/commands/auto-fix-all/AutoFixAllConfig.js` (`NamespacedBooleanKeyConfig`) | A value in the repo or global file is ignored. |
| `monitor-issues.clear_context` | boolean | local | `false` | chain | shell: `monitor-issues/scripts/config_common.sh` (+ `config_*_shell.sh`); JS: `core/lib/commands/monitor-issues/MonitorIssuesConfig.js` (`NamespacedBooleanKeyConfig`) | A value in the repo or global file is ignored. |
| `plan-issues.max-retry-count` | integer, min 0 | global, repo, local | `5` | chain | shell: `arcanum/_lib/spawn_issue_shell.sh`; JS: `core/lib/commands/shared/SpawnIssue.js` | Read by the shared spawn helper, not by the `plan-issue` skill. |
| `plan-issues.error-sleep-time` | integer, min 0 | global, repo, local | `5` | chain | shell: `arcanum/_lib/spawn_issue_shell.sh`; JS: `core/lib/commands/shared/SpawnIssue.js` | Read by the shared spawn helper, not by the `plan-issue` skill. |

[^legacy]: The legacy `.claude/configuration/auto-fix-all.json` is not read for this key. See [`arcanum-repo-config.md`](../../guides/arcanum-repo-config.md). Its removal is #904/#906.

## Version pointers (not settings)

Three version pointers live in the same files but are not settings: they record how far migrations have run. See [`arcanum-repo-version.md`](../../guides/arcanum-repo-version.md).

| Pointer | File | Written by | Read by |
| --- | --- | --- | --- |
| `version` (committed) | repo | `init-claude`, migration runner | `arcanum/migrations/run.sh` |
| `migrations.version` (local) | local | `init-claude`, migration runner | `arcanum/migrations/run.sh` |
| `migrations.version` (global) | global | migration runner only | `arcanum/migrations/run.sh` (`global_config_get_version` in `arcanum/_lib/global_config.sh`) |

All three are `read_only` for the CLI.

Registry gap: `keys.json` declares `migrations.version` with `tiers: ["local"]`, but the same dotted key also lives in the global file as a separate pointer. #907 fixes this.

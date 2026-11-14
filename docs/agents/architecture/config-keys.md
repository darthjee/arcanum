# Config Keys

This is a lookup reference for where each arcanum config key is read and how resolution works. Each key's type, allowed tiers, default tier and default live only in [`shared/lib/config/keys.json`](../../../shared/lib/config/keys.json); this doc does not copy them. For how the config files and the registry work, see [Shared State & Configuration Files](shared-state-and-configuration.md).

## The registry

`keys.json` has one entry per key. The fields that matter when looking up a key:

- `key`: the dotted key. `<placeholder>` segments make it a wildcard (for example `git.agents.<agent>`).
- `type`, plus `values` / `items` / `min` / `integer` / `format` where they apply: the value's shape, checked on CLI writes.
- `tiers`: the tiers the key may live in. It filters reads in `ConfigChain` / `config_chain_read` and is checked on CLI writes.
- `default_tier`: where an untargeted write goes (see [Default write tier](#default-write-tier)).
- `default`: the value the CLI reports when nothing is set. `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js` keeps it equal to the code's own fallbacks.
- `description`: the text shown by the CLI.
- `read_only`: the CLI refuses to write the key.
- `setup`: how the `config setup` wizard offers the key.

For the full validation rules, see [Shared State & Configuration → Entry shape](shared-state-and-configuration.md#entry-shape). To look a key up, open `keys.json`, or run `/arcanum-check-config <key>` or `arcanum config get <key> --all-tiers`.

## Tiers and files

| Tier | File |
| --- | --- |
| local | `<repo>/.claude/state/arcanum-config.json` (gitignored, per clone) |
| repo | `<repo>/.claude/configuration/arcanum-repo-config.json` (committed) |
| global | `$CLAUDE_CONFIG_DIR/arcanum-config.json`, falling back to `$HOME/.claude/arcanum-config.json` (see [`arcanum-global-config.md`](../../guides/arcanum-global-config.md)) |

## How keys are read

Every key is read through the chain, shown in the **Read via** column of the [Readers](#readers) table below.

**`chain`**: read through `config_chain_read` ([`arcanum/_lib/config_chain.sh`](../../../arcanum/_lib/config_chain.sh)) in shell, or `ConfigChain#read` ([`shared/lib/config/ConfigChain.js`](../../../shared/lib/config/ConfigChain.js)) in JS. The tiers are tried in order: local, then repo, then global. The rules:

- The first value that is present and not `null` wins.
- `null` counts as absent and falls through to the next tier.
- `""` and `false` are real values and stop the chain. An explicit `false` in local overrides a `true` in global.
- A missing, unreadable or malformed file counts as absent.

**`chain` filtered by `tiers`.** In both JS and shell, the `tiers` field in `keys.json` **drives** every chain read (#902 for JS, #903 for shell): only the tiers a key's entry lists are consulted, and the others are silently skipped. In JS that is `ConfigChain#read` / `#readWithSource`, using `KeyRegistry#allowsTier` ([`shared/lib/config/KeyRegistry.js`](../../../shared/lib/config/KeyRegistry.js)). In shell it is `config_chain_read`, using `key_registry_allows_tier` from [`arcanum/_lib/key_registry.sh`](../../../arcanum/_lib/key_registry.sh), a `jq` mirror of `KeyRegistry#lookup` / `#allowsTier` that reads the installed `keys.json`. The filter never changes precedence: resolution is always local, then repo, then global, whatever order `keys.json` lists the tiers in. A key with no registry entry (or a non-leaf key such as `git.agents`) reads all three tiers, as before (`allowsTier` returns `null`, which counts as allowed).

Every reader in the [Readers](#readers) table below goes through the chain. `RepoConfig` ([`shared/lib/config/RepoConfig.js`](../../../shared/lib/config/RepoConfig.js)) no longer opens files itself, and `safe_branch_get` and `wait_ci_shell.sh` call `config_chain_read`. `NamespacedBooleanKeyConfig` ([`core/lib/utils/config/NamespacedBooleanKeyConfig.js`](../../../core/lib/utils/config/NamespacedBooleanKeyConfig.js)) and its shell counterparts (`config_common.sh` in `auto-fix-all/scripts` and `monitor-issues/scripts`) read every key registered in `keys.json` through the chain. An unregistered key in their namespace, such as `auto-fix-all.auto_merge`, is read straight from its file in both, with no legacy-file fallback. Neither engine reads, warns about, or seeds a namespace from the legacy `auto-fix-all.json` / `monitor-issues.json`; the skippable migration `arcanum/migrations/repos/next/001.sh` deletes them.

So, for every key:

- a value placed in a tier the key doesn't allow is ignored by both the JS and the shell readers;
- it is not invisible: `/arcanum-check-config` and `arcanum config get --all-tiers` / `config list` mark it `ignored: tier not allowed`, and `ConfigChain#readTiers` reports it with `allowed: false`;
- tiers are checked on write only when writing through the CLI (`KeyRegistry#check`). A hand edit, or a script writing the file directly, is not checked.

## Default write tier

A write that names no tier goes to the key's **default tier**. That covers the CLI shortcuts, the `config setup` wizard, `NamespacedBooleanKeyConfig`'s writer and the shell writers (`_new_file_for_key` in `config_common.sh`). Every writer takes it from `keys.json`, by one rule:

1. the entry's `default_tier`, when set (optional, and it must be one of the entry's own `tiers`: `validateRegistry` rejects anything else with `default_tier must be one of the entry's tiers`);
2. else the entry's only tier, when `tiers` lists one;
3. else `local`, when `tiers` includes it;
4. else the first tier in `tiers`.

In JS the rule is `KeyRegistry#defaultTier(keyOrPattern)` ([`shared/lib/config/KeyRegistry.js`](../../../shared/lib/config/KeyRegistry.js)), which takes a concrete key (`next_step.auto.enhance-issue`) or a registry pattern (`git.agents.<agent>`) and returns `null` for an unknown key. `ConfigChain#tierFile(repoPath, tier)` maps the tier to its file (see [Tiers and files](#tiers-and-files)). In shell it is `key_registry_default_tier <full_key>` in [`arcanum/_lib/key_registry.sh`](../../../arcanum/_lib/key_registry.sh), which prints nothing for an unknown key. A key that is not in the registry is written to the repo tier, in both JS and shell.

Which keys set `default_tier` is in `keys.json`; the rest get their default tier from rules 2 to 4. To change where a key is written by default, edit its `keys.json` entry only.

## Readers

Which code reads each key, and behavioral notes. Types, tiers, default tiers and defaults are in `keys.json` (see [The registry](#the-registry)). Wildcard keys keep their placeholder in a single row. A reader that exists only in shell, or only in JS, is listed alone.

| Key | Read via | Reader | Notes |
| --- | --- | --- | --- |
| `engine.mode` | chain | shell: `arcanum/_lib/engine_dispatch.sh` → `engine_dispatch` | Shell only: the dispatch guard runs before any JS. See [Script Engine](script-engine.md). |
| `engine.log.location` | chain | shell: `arcanum/_lib/engine_dispatch_docker.sh` (docker branch); JS: `core/lib/utils/logging/InvocationLog.js` (shells out to `config_chain_read`) | When absent, no invocation log is written and no log directory is mounted. See [Docker Engine](docker-engine.md). |
| `git.email` | chain | shell: `arcanum/_lib/agent_email.sh` → `agent_email_get`; JS: `shared/lib/config/AgentEmail.js` | Resolved together with `git.agents.<agent>`: at each tier, `git.agents.<agent>` is tried first, then `git.email`, before the next tier. So a local `git.email` beats a global `git.agents.<agent>`. When neither is set anywhere, commits fall back to the model's email. |
| `git.agents.<agent>` | chain | shell: `arcanum/_lib/agent_email.sh` → `agent_email_get`; JS: `shared/lib/config/AgentEmail.js` | Resolved together with `git.email`, per tier (see the `git.email` row). When neither is set anywhere, commits fall back to the model's email. |
| `git.safe_branch` | chain | shell: `arcanum/_lib/safe_branch.sh` → `safe_branch_get`; JS: `shared/lib/config/RepoConfig.js` → `getSafeBranch` | See [Branch Bootstrap and Merge Conflicts](branch-bootstrap-and-merge-conflicts.md). |
| `git.merge_body_mode` | chain | shell: `arcanum/_lib/merge_body.sh` → `merge_body_mode`; JS: `core/lib/utils/github/MergeBodyResolver.js` | An unrecognized value falls back to the default with a warning. |
| `git.omit_model_coauthor` | chain | shell: `arcanum/_lib/agent_email.sh` → `model_coauthor_omitted` (also used by `merge_body.sh`); JS: `core/lib/utils/git/CoauthorTrailers.js`, `core/lib/utils/github/MergeBodyResolver.js` | |
| `git.remove_coauthors` | chain | shell: `arcanum/_lib/agent_email.sh` → `remove_coauthors_list` (used by `merge_body.sh`); JS: `core/lib/utils/github/MergeBodyResolver.js` | |
| `next_step.auto.<skill>` | chain | shell: `arcanum/_lib/next_step_prompt_shell.sh` (`--auto-key`); JS: `core/lib/commands/shared/NextStepPrompt.js` | Known instances (`setup.instances`): `enhance-issue`, `discuss-issue`, `auto-plan-issue`. `auto-plan-issue/scripts/auto_next.sh` (JS: `AutoPlanIssueAutoNext.js`) reads it through `next_step_prompt.sh`; it also always pushes, marks the issue Ready and, when not chaining, releases to the safe branch. |
| `next_step.clear.<skill>` | chain | same readers as `next_step.auto.<skill>` | Read only when the matching `next_step.auto.<skill>` is `true`. |
| `auto-fix-all.ignored_check_patterns` | chain | shell: `auto-fix-all/scripts/wait_ci_shell.sh`; JS: `shared/lib/config/RepoConfig.js` → `getIgnoredCheckPatterns` (used by `AutoFixAllWaitCi.js`) | Patterns match check names case-insensitively. |
| `auto-fix-all.clear_context` | chain | shell: `auto-fix-all/scripts/config_common.sh` (+ `config_*_shell.sh`); JS: `core/lib/commands/auto-fix-all/AutoFixAllConfig.js` (`NamespacedBooleanKeyConfig`) | |
| `auto-fix-all.finish_on_empty_queue` | chain | shell: `auto-fix-all/scripts/config_common.sh` (+ `config_*_shell.sh`); JS: `core/lib/commands/auto-fix-all/AutoFixAllConfig.js` (`NamespacedBooleanKeyConfig`) | |
| `monitor-issues.clear_context` | chain | shell: `monitor-issues/scripts/config_common.sh` (+ `config_*_shell.sh`); JS: `core/lib/commands/monitor-issues/MonitorIssuesConfig.js` (`NamespacedBooleanKeyConfig`) | |
| `plan-issues.max-retry-count` | chain | shell: `arcanum/_lib/spawn_issue_shell.sh`; JS: `core/lib/commands/shared/SpawnIssue.js` | Read by the shared spawn helper, not by the `plan-issue` skill. |
| `plan-issues.error-sleep-time` | chain | shell: `arcanum/_lib/spawn_issue_shell.sh`; JS: `core/lib/commands/shared/SpawnIssue.js` | Read by the shared spawn helper, not by the `plan-issue` skill. |

## Version pointers (not settings)

Three version pointers live in the same files but are not settings: they record how far migrations have run. See [`arcanum-repo-version.md`](../../guides/arcanum-repo-version.md).

| Pointer | File | Written by | Read by |
| --- | --- | --- | --- |
| `version` (committed) | repo | `init-claude`, migration runner | `arcanum/migrations/run.sh` |
| `migrations.version` (local) | local | `init-claude`, migration runner | `arcanum/migrations/run.sh` |
| `migrations.version` (global) | global | migration runner only | `arcanum/migrations/run.sh` (`global_config_get_version` in `arcanum/_lib/global_config.sh`) |

All three are `read_only` for the CLI.

The two `migrations.version` entries are separate scopes, not a fallback chain: the migration runner reads each pointer from its own file and never resolves `migrations.version` through `config_chain_read` / `ConfigChain`.

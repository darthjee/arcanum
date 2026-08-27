# Plan: Command SpawnIssue has too many responsibilities

Issue: [298-command-spawnissue-has-too-many-responsibilities.md](../../issues/298-command-spawnissue-has-too-many-responsibilities.md)

## Overview

Refactor `SpawnIssue` (core/lib/commands/SpawnIssue.js) so it stops threading `repoPath` through 5 individually-constructed collaborators and instead builds a per-call `RepoContext` (mirroring `AutoFixAllGithub#_prOperations`), migrates its `plan-issues` config reads from the single-tier `RepoConfig` to the 3-tier `ConfigChain`, and extracts its label-application and issue-linking logic into two new `core/lib/utils/issue/` classes. The shell counterpart (`arcanum/_lib/spawn_issue_shell.sh`) gets its `plan-issues` config reads migrated to the same config-chain-equivalent shell helper, so the native and shell paths — which run side by side per repo depending on `migration-status.json` — keep behaving identically.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

The `plan-issues` config namespace, keys `max-retry-count` and `error-sleep-time`, both defaulting to `5`. `node`'s `SpawnIssue` reads these via `RepoContext.readConfig('plan-issues', 'max-retry-count' | 'error-sleep-time')` (backed by `ConfigChain`, 3-tier: local state → repo config → global config). `scripter`'s `spawn_issue_shell.sh` must read the exact same namespace/keys via `arcanum/_lib/config_chain.sh`'s `config_chain_read "$REPO_PATH" plan-issues max-retry-count|error-sleep-time`, with the same `5`/`5` fallback when unset at every tier — so a given repo's retry/sleep behavior is identical whether it's running in shell mode or native mode.

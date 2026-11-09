# Issue: Resolve config tiers from keys.json in the shell readers

## Description

Part of #900 (split from the original sub-issue 2).

Make the shell config readers use the same registry-driven tier resolution as the JS readers (#902). After #902, a key's `tiers` in `shared/lib/config/keys.json` decides which config files the JS readers consult. The shell readers still read every tier, or hardcode one file.

## Problem

- **`config_chain_read` reads all three tiers for every key.** It is in `arcanum/_lib/config_chain.sh` and ignores keys.json. All of its callers inherit that: `engine_dispatch.sh`, `engine_dispatch_docker.sh`, `next_step_prompt_shell.sh`, `spawn_issue_shell.sh`, `agent_email.sh` and `merge_body.sh`.
- **Some readers bypass the chain and hardcode a single file:**
  - `safe_branch_get` (`arcanum/_lib/safe_branch.sh`) reads only `.claude/state/arcanum-config.json`;
  - `auto-fix-all/scripts/wait_ci_shell.sh` reads `ignored_check_patterns` only from `arcanum-repo-config.json`;
  - the auto-fix-all and monitor-issues `config_get_shell.sh` / `config_is_enabled_shell.sh` pick their file through `_new_file_for_key`.
- **Tier rules live in two places.** In shell, `tiers` only describes the readers, which happen to open the right files. Changing a key's `tiers` (#907) would change JS reads but not shell reads.
- **`null` already diverges.** The shell boolean readers presence-check, so an explicit `null` prints `null`. Since #902, native falls through to the legacy file or the default instead.
- **The docs still say "shell readers don't consult the registry yet (#903)":** `docs/agents/architecture/config-keys.md` and `shared-state-and-configuration.md`.

## Expected Behavior

Every shell config read consults only the tiers its keys.json entry allows, with the same answers as JS `KeyRegistry#allowsTier` and `ConfigChain`. Precedence is always local, then repo, then global.

`key_registry_allows_tier <key> <tier>` prints `true`, `false` or `null` (the same values as JS) and always exits 0. `null` counts as allowed.

### Edge cases

1. **Multi-key fallback** (for example `config_chain_read . git agents.<agent> email`). Within one tier, a key that isn't allowed is skipped and the next key is tried. A tier is still fully resolved before the next one is consulted.
2. **Pattern keys.**
   - A `<...>` segment matches exactly one segment, and the segment count must match.
   - An exact entry beats a pattern.
   - Agent and skill names contain no dots.
3. **Unknown, non-leaf and malformed keys** (segments not matching `^[A-Za-z0-9_-]+$`) give `null`, so they are allowed in every tier, with no warning. There is no shell version of `ARCANUM_STRICT_CONFIG_KEYS`, because the `# config-key:` annotations already let `ShellConfigKeyScan_spec.js` catch unregistered shell keys.
4. **keys.json missing or malformed.** Every tier is allowed, with no warning. A warning on every `config_chain_read` call would be noise, and a broken install must never silently drop config.
5. **Invalid tier name** gives `null`. `config_chain_read` only ever passes `local`, `repo` or `global`.
6. **Legacy-file fallback** (`config_get_shell.sh` / `config_is_enabled_shell.sh`). The chain runs first, and the legacy file is read only when the chain finds nothing. The "config has moved" warning still prints.
7. **Empty string and null.**
   - `""` still stops the chain, and `safe_branch_get` still turns it into `origin/main`.
   - `null` still falls through.
   - A value in a disallowed tier is skipped whatever it holds.
8. **cwd.** `config_chain_read` keeps reading the repo files relative to cwd. `key_registry.sh` finds keys.json through `BASH_SOURCE`.
9. **Docker engine.** The image copies the whole install, so keys.json is present inside the container.
10. **jq** is already a hard requirement of `repo_config_read`, so nothing new is needed.

### Backward compatibility

No visible change today. Every shell reader already opens exactly the tiers its keys.json entry allows:

| Reader | Reads today | keys.json allows |
|---|---|---|
| `config_chain_read` callers (`engine.*`, `next_step.*`, `plan-issues.*`, `git.email` / `agents.<agent>` / `merge_body_mode` / `omit_model_coauthor` / `remove_coauthors`) | all 3 tiers | all 3 tiers |
| `safe_branch_get` | local file | local |
| `wait_ci_shell.sh` `ignored_check_patterns` | repo file | repo |
| boolean readers `clear_context` / `finish_on_empty_queue` | local file | local |
| boolean reader `ignored_check_patterns` | repo file, then legacy | repo, then legacy |
| unregistered namespaced keys | their file | unknown, so the direct read stays |

- **The only behavior difference is the `null` fix.** A registered boolean-reader key set to an explicit `null` used to make `config_get_shell.sh` print `null`. It now falls through to the legacy file or the default (`false`), as native has done since #902. `is_enabled` already treated `null` as not enabled.
- **From now on, editing `tiers` in keys.json (#907) changes shell reads too.** That is intended.
- **No version skew.** keys.json and `_lib` ship together in every install (git clone, release zip, Docker image).

## Solution

### Approach: a jq lookup in `_lib`

1. **New `arcanum/_lib/key_registry.sh`** with `key_registry_allows_tier <full_key> <tier>`:
   - it reads `KEY_REGISTRY_FILE`, which defaults to `${_lib}/../../shared/lib/config/keys.json`, the test seam;
   - it mirrors `KeyRegistry#lookup` (segment validation, exact-over-pattern) and `#allowsTier`;
   - it does all matching in jq.
2. **`config_chain_read`** checks `key_registry_allows_tier "<namespace>.<key>" local|repo|global` before reading each key in each tier, and skips a tier that prints `false`. Every caller picks this up without changes.
3. **`safe_branch_get`** and **`auto-fix-all/scripts/wait_ci_shell.sh`** stop hardcoding a file and read through `config_chain_read`, mirroring #902's change to `RepoConfig`.
4. **The auto-fix-all and monitor-issues `config_get_shell.sh` / `config_is_enabled_shell.sh`** mirror `NamespacedBooleanKeyConfig#_readNewValue`:
   - a key registered in keys.json is read through `config_chain_read`;
   - an unregistered key (for example `auto-fix-all.auto_merge`) keeps the direct `_new_file_for_key` read;
   - the legacy-file fallback is unchanged.
5. **bash 3.2.** `_lib` must run on macOS `/bin/bash` 3.2, and CI runs bash 5, so it won't catch a 3.2 problem. So: no associative arrays, no `mapfile`, no `${var,,}`.
6. **Docs.** `docs/agents/architecture/config-keys.md` and `shared-state-and-configuration.md` change to say shell readers are driven by `tiers` too. The `direct` rows become `chain` in shell as well.

An audit found no other shell code that reads config values directly. Every other mention of the config files is in a comment.

### Out of scope

- **Writers.** `config_toggle_shell.sh` and `config_set_shell.sh`, including the toggle's read-before-flip, belong to #905.
- **Migration bookkeeping** (`migrations.version` and the top-level `version`). The version helpers in `repo_config.sh` and `global_config.sh` address their files on purpose.
- **Deleting the legacy `auto-fix-all.json` and `monitor-issues.json` fallbacks** (#904 and #906).
- **Revisiting which tiers each key allows** (#907).
- **A doctor that reports values sitting in a disallowed tier** (#914).

### Alternatives not chosen

- **Calling into Node or the CLI.** `engine.mode` is read in shell before the engine decides whether Node runs, and with `engine.mode=shell` Node may be missing altogether. That would always need a shell exception, and every read would start a Node process.
- **A tier map generated at build time.** It is one more generated file that can go stale, and jq is already required throughout `_lib`.

The cost of the chosen approach is a second implementation of the lookup. The registry parity spec below covers it.

### Testing

Owner: node, in `core/spec`. CI gate: `make core-check`. Shell libraries are tested from Jasmine by running bash against fixture repos.

1. **`core/spec/bin/sharedLibKeyRegistry_spec.js`** (new):
   - an exact entry, allowed and not allowed;
   - a wildcard entry, with exact-over-pattern precedence (fixture registry through `KEY_REGISTRY_FILE`);
   - unknown, non-leaf and malformed keys, each giving `null`;
   - a missing or malformed registry file, giving `null`;
   - an invalid tier name, giving `null`.
2. **`core/spec/bin/sharedLibConfigChain_spec.js`** (new), with a fixture repo and a fixture registry:
   - a disallowed tier is skipped and the next allowed tier wins;
   - with multiple keys, a disallowed key is skipped within a tier;
   - a value only in a disallowed tier resolves to empty;
   - an unknown key reads all 3 tiers;
   - `null` falls through and `""` stops the chain.
3. **Registry parity.** `key_registry_allows_tier` must equal `KeyRegistry#allowsTier` for:
   - every keys.json entry, across all 3 tiers;
   - a concrete key per wildcard entry;
   - an unknown key, `git.agents` and `git.bad key`.
4. **Resolution parity.** The existing shell-vs-native parity specs gain a fixture with a value in a disallowed tier, and both implementations must ignore it:
   - `checkoutSafeBranchParity`: `git.safe_branch` in the repo file;
   - `autoFixAllWaitCiParity`: `ignored_check_patterns` in the local file;
   - `autoFixAllConfigParity` / `monitorIssuesConfigParity` get + is_enabled: `clear_context` in the repo file, plus a `null` case;
   - `agentEmailParity`: `git.agents.<agent>` still read from every tier, as a positive control.
5. **`ShellConfigKeyScan_spec.js`** keeps passing with no changes.

### Performance

At most one extra jq lookup on keys.json per key per tier. keys.json is small, and each tier read already starts jq, so no caching is needed.

### Migration

None. No config file changes shape and no file moves.

### Owners

- **scripter**: `key_registry.sh`, `config_chain.sh`, `safe_branch.sh`, `wait_ci_shell.sh`, and the auto-fix-all and monitor-issues `config_get_shell.sh` / `config_is_enabled_shell.sh`.
- **node**: the specs in `core/spec`.
- **architect**: `config-keys.md` and `shared-state-and-configuration.md`.

### Depends on

#902 (merged in PR #915), which provides `KeyRegistry#allowsTier` and the JS behavior mirrored here.

## Benefits

- **One source of truth for tiers.** keys.json drives both the shell and native engines, so the engine a user runs no longer changes what config is read.
- **Changing a key's `tiers` (#907) takes effect everywhere.** No shell file needs to be hand-edited to match.
- **Shell and native agree on `null`**, removing a known parity gap.
- **`safe_branch_get` and `wait_ci_shell.sh` stop hardcoding config files**, which shrinks the work left for #905 and #909.

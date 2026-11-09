# Issue: Remove the legacy auto-fix-all.json and monitor-issues.json config fallbacks

## Description

Part of #900 (split from the original sub-issue 2).

Remove the remaining fallbacks to the legacy `.claude/configuration/auto-fix-all.json` and `.claude/configuration/monitor-issues.json`:

- **Read fallback.**
  - Shell: `_config_read_value` and `_legacy_file_for_key` in `auto-fix-all/scripts/config_common.sh` and `monitor-issues/scripts/config_common.sh` (the legacy step #903 left in place).
  - JS: `legacyFileName` in `AutoFixAllConfig` (`core/lib/commands/auto-fix-all/AutoFixAllConfig.js`) and `MonitorIssuesConfig` (`core/lib/commands/monitor-issues/MonitorIssuesConfig.js`), through `NamespacedBooleanKeyConfig`.
- **Seed on write.**
  - The auto-fix-all and monitor-issues `config_set_shell.sh` / `config_toggle_shell.sh` pass `_legacy_file_for_key` to `repo_config_write`.
  - `init-claude/scripts/set_ci_ignored_patterns_shell.sh` and `InitClaudeSetCiIgnoredPatterns` (`core/lib/commands/init-claude/`) pass the legacy file to `repo_config_write` / `RepoConfigWriter`.

## Problem

The legacy files were superseded by the namespaced `arcanum-repo-config.json` long ago.
- Migrations `0.9.3/001` and `0.18.0/001` (the latter cannot be skipped) already copied `auto-fix-all.json` into the repo config.
- The CI check (`wait_ci_shell.sh`) already reads `ignored_check_patterns` only through the config chain, so the legacy file has no effect on it.

The fallbacks remain anyway:
- Every `auto-fix-all config get` / `is-enabled` call can still be answered from a stale legacy file (for example, ward's `["codacy"]` versus `["Codacy"]`).
- Every write can still seed a whole namespace from it.

The `monitor-issues.json` path is dead in practice. `monitor-issues.clear_context` is the only `monitor-issues` key in `keys.json`, and it is local only with no fallback, so only an unregistered, made-up key could ever reach that file.

## Expected Behavior

- `auto-fix-all` and `monitor-issues` `config get` / `is-enabled` / `set` / `toggle` never read, warn about or seed from `auto-fix-all.json` or `monitor-issues.json`, in shell or in JS.
- `init-claude`'s set-ci-ignored-patterns writes `ignored_check_patterns` into `arcanum-repo-config.json` without seeding the namespace from `auto-fix-all.json`.
- A registered key resolves through `config_chain_read` / `ConfigChain` exactly as today. An unregistered key gets only the direct `_new_file_for_key` read. With no value, the caller's default applies.
- If a legacy file is still present it is silently ignored, with no warning. `/arcanum-migrate` already lists #906's pending deletion migration.
- Shell and JS stay in parity (the `autoFixAllConfigParity`, `monitorIssuesConfigParity` and `initClaudeSetCiIgnoredPatternsParity` specs).

### Backward compatibility

| Repo state | Before | After |
| --- | --- | --- |
| Has caught up on migrations (namespace present) | namespaced value wins | same |
| Namespace missing a key that only the legacy file has | legacy value, with a warning | default |
| No legacy file | default | default |

The middle row can only happen if someone edited the legacy file by hand after `0.18.0/001` ran. #906 seeds any namespace that is still missing before deleting the file.

## Solution

### Approach

1. **Shell readers.**
   - In both `config_common.sh` files, drop the legacy step from `_config_read_value`.
   - Delete `_legacy_file_for_key` and the `CONFIG_FILE` constants.
   - Keep the `# config-key:` annotations on the remaining reads.
2. **Shell writers.**
   - The auto-fix-all and monitor-issues `config_set_shell.sh` / `config_toggle_shell.sh` call `repo_config_write "<new_file>" "" …`. The toggle's read-before-flip uses `_config_read_value`, or a legacy-free read.
   - `set_ci_ignored_patterns_shell.sh` passes `""` and drops `LEGACY_CONFIG_FILE`.
3. **JS.**
   - Remove the `legacyFileName` option, `_legacyFile` and the legacy fallback from `NamespacedBooleanKeyConfig`, along with the seed `legacyFile` it passes to the writer.
   - `AutoFixAllConfig` and `MonitorIssuesConfig` stop passing it.
   - `InitClaudeSetCiIgnoredPatterns` passes `legacyFile: ''`, or omits it.
4. **Shared helpers keep their signatures.**
   - `repo_config_read`, `repo_config_write`, `repo_config_seed` and `RepoConfigWriter` keep their `<legacy_file>` / `legacyFile` parameter.
   - Shipped migrations call them with `""`, and `0.9.3`, `0.18.0` and `2.2.0` (and #906) rely on `repo_config_seed`. Only the callers change.
5. **Docs.**
   - Remove the fallback wording from `docs/guides/arcanum-repo-config.md`, `docs/agents/architecture/shared-state-and-configuration.md`, `docs/agents/folder-structure.md` and the `[^legacy]` footnote in `docs/agents/architecture/config-keys.md`.
   - Remove the code comments that describe it (`wait_ci_shell.sh`, `repo_config.sh` header, `AutoFixAllConfig.js`, `MonitorIssuesConfig.js`).

### Testing

- Delete or rewrite the specs that set up a legacy file:
  - `AutoFixAllConfig_spec.js`
  - `MonitorIssuesConfig_spec.js` (the "falls back to the legacy monitor-issues.json" case)
  - `NamespacedBooleanKeyConfig_spec.js` (`legacyFileName`)
  - `InitClaudeSetCiIgnoredPatterns_spec.js` (the "seeds from the legacy auto-fix-all.json" case)
  - `initClaudeSetCiIgnoredPatternsParity_spec.js`
  - `monitorIssuesConfigParity/config_spec.js`
  - `autoFixAllConfigParitySetup.js`
- Add one negative case per reader and writer: a legacy file that is present is neither read nor seeded from.
- Keep the `RepoConfigWriter` / `repo_config_write` seed specs, since the helpers still support it.
- CI: `make core-check`.

### Out of scope

- **Deleting the legacy files** (#906).
- **Removing the `<legacy_file>` parameter from the shared helpers.** It would mean editing about 20 shipped migrations.
- **CLI shortcut tiers** (#905).

### Ordering

#904 and #906 should land in the same release, in either order. Repos that have caught up on migrations already carry the namespaced values, so neither PR depends on the other.

### Owners

- scripter: the shell readers and writers.
- node: `core/lib` and the specs.
- architect: the docs.

## Benefits

- Each config value has one source. A stale legacy file can no longer override or seed the repo config (for example, the `codacy` versus `Codacy` drift).
- It removes dead code and specs from both engines, and one more shell/JS divergence point.
- It finishes #900's goal: every config read goes through `keys.json` tiers, with no side channel.

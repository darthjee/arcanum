# Plan: Remove the legacy auto-fix-all.json and monitor-issues.json config fallbacks

Issue: [904-remove-the-legacy-auto-fix-all-json-and-monitor-issues-json-config-fallbacks.md](../../issues/904-remove-the-legacy-auto-fix-all-json-and-monitor-issues-json-config-fallbacks.md)

## Overview

This plan removes every read fallback to, and write-time namespace seed from, `.claude/configuration/auto-fix-all.json` and `.claude/configuration/monitor-issues.json`, in both engines:
- the auto-fix-all and monitor-issues `config` get / is-enabled / set / toggle;
- init-claude's set-ci-ignored-patterns.

The shared helpers keep their `<legacy_file>` / `legacyFile` parameter (`repo_config_read`, `repo_config_write`, `repo_config_seed`, `RepoConfigWriter`), because shipped migrations and #906 still use it. Only the callers stop passing a legacy file.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

The two engines must keep matching. The `core/spec/bin` parity specs (owned by node) run both and compare them.

- **Reads** (`config get` / `is-enabled`, auto-fix-all and monitor-issues):
  - A key registered in `keys.json` resolves through `config_chain_read` / `ConfigChain`, unchanged.
  - An unregistered key gets only the presence-checked direct read of its new file:
    - `.claude/state/arcanum-config.json` for the state keys (auto-fix-all `clear_context`, `finish_on_empty_queue`; monitor-issues `clear_context`);
    - `.claude/configuration/arcanum-repo-config.json` for every other key.
  - With no value, the caller's default applies (`get` prints nothing; `is-enabled` gives false).
  - Legacy files are never read, and the shell no longer prints the "reading '<key>' from legacy config file" warning from these readers.
- **Writes** (`config set` / `toggle`, set-ci-ignored-patterns):
  - The value goes to `.<namespace>.<key>` of the new file. Other namespaces and keys are kept.
  - The namespace is never seeded from a legacy file. A missing namespace starts as `{}`.
  - Shell passes `""` as `repo_config_write`'s `<legacy_file>`. JS passes no `legacyFile` (or `''`) to `RepoConfigWriter`.
  - `toggle`'s read-before-flip uses the same legacy-free read of the new file. A missing value counts as `false`.
- **Stdout and exit codes** don't change for any subcommand.
- **A legacy file that is still present is ignored.** No warning is printed.

## Notes

- **Architect (docs, after both agents finish):** remove the fallback wording from:
  - `docs/guides/arcanum-repo-config.md`: the legacy rows and paragraphs for `auto-fix-all.json` and `monitor-issues.json`. Say the files are no longer read and that a pending migration (#906) deletes them.
  - `docs/agents/architecture/shared-state-and-configuration.md`.
  - `docs/agents/folder-structure.md` (the `.claude/configuration/` row).
  - the `[^legacy]` footnote in `docs/agents/architecture/config-keys.md`.
- **Out of scope:**
  - deleting the files (#906);
  - removing the helper parameter (it would mean editing about 20 shipped migrations);
  - CLI shortcut tiers (#905).
- **Ordering:** this can land in the same release as #906, in either order.
- **No migration** is needed for #904 itself.

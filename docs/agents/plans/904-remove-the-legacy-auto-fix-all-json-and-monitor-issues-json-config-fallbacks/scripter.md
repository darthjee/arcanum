# Scripter Plan: Remove the legacy auto-fix-all.json and monitor-issues.json config fallbacks

Main plan: [plan.md](plan.md)

## Overview

Drop the legacy step from both `config_common.sh` files and stop the set/toggle and set-ci-ignored-patterns scripts from passing a legacy file to `repo_config_write` / `repo_config_read`. Keep `arcanum/_lib/repo_config.sh`'s function signatures as they are.

## Shared contracts

See [plan.md](plan.md#shared-contracts). Reads never touch a legacy file. Writes pass `""` as `<legacy_file>`. Stdout and exit codes are unchanged.

## Steps

- [01 — auto-fix-all config scripts](scripter/01-auto-fix-all-config.md)
- [02 — monitor-issues config scripts](scripter/02-monitor-issues-config.md)
- [03 — set_ci_ignored_patterns and comments](scripter/03-ci-patterns-and-comments.md)

## CI Checks

- `make core-check` (the shell is exercised through the `core/spec/bin` Jasmine specs, including `ShellConfigKeyScan_spec.js`)
- `shellcheck` on the changed scripts

## Notes

- Keep the `# config-key:` annotations next to every remaining read and write, so `ShellConfigKeyScan_spec.js` stays green.
- bash 3.2 compatible, as usual.
- Don't touch `arcanum/migrations/`. Migrations keep using `repo_config_seed` and `repo_config_write` with explicit files.

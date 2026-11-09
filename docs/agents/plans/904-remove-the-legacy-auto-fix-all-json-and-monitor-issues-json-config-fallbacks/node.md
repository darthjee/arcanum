# Node Plan: Remove the legacy auto-fix-all.json and monitor-issues.json config fallbacks

Main plan: [plan.md](plan.md)

## Overview

Remove the `legacyFileName` option and the legacy read and seed paths from `NamespacedBooleanKeyConfig` and its two subclasses. Stop `InitClaudeSetCiIgnoredPatterns` from passing a legacy seed. Update the unit and parity specs so they no longer exercise a legacy file, and add a negative case to each: a legacy file that is present is ignored.

## Shared contracts

See [plan.md](plan.md#shared-contracts). The parity specs in `core/spec/bin` are the check that the shell (scripter's work) and JS agree.

## Steps

- [01 — NamespacedBooleanKeyConfig and its subclasses](node/01-namespaced-boolean-key-config.md)
- [02 — InitClaudeSetCiIgnoredPatterns](node/02-init-claude-set-ci-ignored-patterns.md)
- [03 — Parity specs and fixtures](node/03-parity-specs.md)

## CI Checks

- `make core-check` (lint, plus Jasmine with coverage, for `core/`)

## Notes

- Leave `shared/lib/config/RepoConfigWriter.js` and its seed specs unchanged. The helper still supports `legacyFile` for other callers.
- `shared/spec/config/RepoConfig_spec.js` already asserts no fallback for the CI key. Leave it.
- Keep JSDoc in sync (ESLint's `jsdoc` rules apply).

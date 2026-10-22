# Shared Plan: Writer additions needed by #780 (unset, lock timeout, top-level keys)

Main plan: [plan.md](plan.md)

## Overview

Add `timeoutMs` pass-through, top-level `write` and a new `unset` to `RepoConfigWriter`, with specs. The behaviour contract is in [docs/agents/specs/shared-lib.md#writer-additions](../../specs/shared-lib.md#writer-additions) and in the issue.

## Context

#780 (`arcanum config set/unset --lock-timeout`) must stay a pure `client` change, so every writer capability it needs lands here first.

Current callers, which must not change:
- `core/lib/commands/init-claude/InitClaudeStampArcanumVersion.js` (`setVersion`);
- `InitClaudeSetNextStepKey.js` and its subclasses `InitClaudeSetNextStepAuto`/`InitClaudeSetNextStepClear` (`write`);
- `InitClaudeSetCiIgnoredPatterns.js` (`write`).

## Steps

- [01 — Lock timeout pass-through](shared/01-lock-timeout.md)
- [02 — Top-level write](shared/02-top-level-write.md)
- [03 — Unset](shared/03-unset.md)

## CI Checks

- `shared`: `make shared-check` (lint + specs with coverage; CI job: `shared`)
- `core`: `make core-test` (callers unchanged; CI job: `checks`). Run it only as a regression check; no core files change.

## Notes

- Do not change `write`/`setVersion` behaviour when the new options are omitted. The existing `RepoConfigWriter_spec.js` examples must pass unmodified.
- No shell counterpart (`repo_config_unset` in `arcanum/_lib/repo_config.sh`) and no registry validation; both are out of scope.
- Update the class JSDoc header, which lists the shell writers it mirrors, to mention `unset` and the native-only `timeoutMs`. `shared/README.md` does not list methods, so it needs no change.

# Node Plan: Shared config surface refactor in core/lib

Main plan: [plan.md](plan.md)

## Overview
Implement the `core/` half of the shared config surface, as designed in `docs/agents/specs/arcanum-cli/shared-config-logic.md` (authoritative). Dispatcher (`core/bin/arcanum`) output and exit codes must stay byte-identical; the only deliberate behaviour change is native `""` agent email → model email.

## Context
- **Prerequisite: #777 must be merged first** (KeyRegistry, `keys.json`, and the `ARCANUM_STRICT_CONFIG_KEYS` guard `assertRegisteredConfigKey`, today a plain `Error`). Before starting, merge `origin/main` into `issue-778`; if #777 has not landed, do steps 01, 03–06 and leave the guard conversion in step 02 for a follow-up commit once it has.
- #807 already landed: `Lock` has `timeoutMs` and throws `LockTimeoutError` (`code: 'LOCK_TIMEOUT'`). Leave it as is.
- No shared-surface file uses `DispatchFailure` today; `BooleanKeyConfig.js` (off-surface) keeps it.
- CLI-side guardrails (`cli/eslint.config.mjs`, esbuild metafile check) are out of scope (#779).

## Steps

- [01 — Add ConfigError and convert surface throws](node/01-config-error.md)
- [02 — Convert the strict-keys guard to ConfigError](node/02-strict-guard-config-error.md)
- [03 — Add ConfigChain#readWithSource](node/03-read-with-source.md)
- [04 — Add AgentEmail and replace the _agentEmailGet copies](node/04-agent-email.md)
- [05 — Add RepoPath#toplevel](node/05-repo-path-toplevel.md)
- [06 — Declare the shared surface in ESLint and reword JSDoc](node/06-eslint-shared-surface.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes
- Messages must stay **byte-identical** (`Cannot index <file|.path>: not a JSON object`, the JSON parse message); existing specs asserting messages should keep passing unchanged — add `code`/`instanceof` assertions on top.
- The `""` agent-email change must be mentioned in the PR description so it lands in the release notes.
- The ESLint `files` list is the authoritative surface declaration; keep the spec's table in sync if anything differs.
- The four `_modelCoauthorOmitted` copies stay as they are (out of scope).

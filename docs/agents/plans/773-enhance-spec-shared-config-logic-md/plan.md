# Plan: Enhance spec: shared-config-logic.md

Issue: [773-enhance-spec-shared-config-logic-md.md](../../issues/773-enhance-spec-shared-config-logic-md.md)

## Overview

Docs-only. Rewrite `docs/agents/specs/arcanum-cli/shared-config-logic.md` so it records every decision taken in issue #773 and has no open points left (only the npm-package extraction stays, as future work). Then make the consequential edits in the sibling parts (`command-surface.md`, `shortcuts-and-setup.md`, `packaging-and-release.md`, `key-registry.md`) and in the index (`arcanum-cli.md`), so cross-links and the "Pieces introduced" table stay consistent. No code changes; implementation belongs to the epic #767 issues and to #807.

## Context

Issue #773 (part of epic #767) resolved the five open points of the shared-config-logic part, plus gaps found while reviewing it:

- **Lock:** the shared lock protocol (`lock.sh` / `Lock.js`) does not exclude a writer that already holds the lock. Fix spun off as **#807** (atomic create-if-absent, owner-checked release, stale-pid detection, optional bound) — a hard blocker for the CLI's write commands, kept standalone outside the epic.
- **`ConfigError`:** `BooleanKeyConfig` leaves the shared surface (it is the `config.sh` dispatch layer; keeps `DispatchFailure`). New `ConfigError extends Error` with `code` (`NOT_AN_OBJECT`, `INVALID_JSON`, `LOCK_TIMEOUT`, `UNREGISTERED_KEY`) and `file`, keeping today's messages — so the dispatcher needs no mapping. CLI maps `LOCK_TIMEOUT`→6, `NOT_AN_OBJECT`/`INVALID_JSON`/errno→7, else→1.
- **Lint:** two-sided — an allowlist block in `core/eslint.config.mjs` whose explicit `files` list is the authoritative surface declaration (plus `no-restricted-syntax` on `ImportExpression`), and a CLI-side rule restricting `core/lib` imports to surface entry files. JSDoc `RepoContext` references stay, reworded "optional, core-only".
- **`esbuild`:** entry `cli/lib/main.js`, out `cli/dist/arcanum.mjs` (gitignored), `cli/bin/arcanum` unbundled; options table; metafile resolved-path surface check in `cli/scripts/build.mjs`; `prepack` build; smoke specs on the bundle; Node 22.13 JSON-module warning to verify, fallback `keys.js`.
- **CI:** always-on `cli` job in the CircleCI `test` workflow (no path filters), same build script as the publish job.
- **Agent email:** `ConfigChain#readWithSource` + new `AgentEmail.js` (`resolve`, `get`) on the surface; native `""` aligned to the shell (→ model email); shell/native parity fixtures.

The full decision text is in the issue file's `## Solution` section; copy from it rather than re-deriving.

## Steps

- [01 — Rewrite shared-config-logic.md](plan/01-rewrite-shared-config-logic.md)
- [02 — Update command-surface.md](plan/02-update-command-surface.md)
- [03 — Update shortcuts-and-setup.md](plan/03-update-shortcuts-and-setup.md)
- [04 — Update packaging-and-release.md and key-registry.md](plan/04-update-packaging-and-key-registry.md)
- [05 — Update the index arcanum-cli.md](plan/05-update-index.md)

## Notes

- **Decision taken while planning (not discussed in #773): repo-root normalizing helper.** The index (`arcanum-cli.md` lines ~65 and ~121) defers "where the repo-root normalizing helper lives" to this part, but the part never said. Chosen: `core/lib/utils/file/RepoPath.js` joins the shared surface (it imports only `node:` built-ins, and the CLI already reuses its messages per the index), gaining a `toplevel(repoPath)` method that runs `git -C <path> rev-parse --show-toplevel` via `execFile` with an argument array. Owner `node`. Reviewers may revisit this in the PR.
- The shared-surface list after this issue: `ConfigChain.js`, `RepoConfig.js`, `RepoConfigWriter.js`, `ConfigError.js`, `AgentEmail.js`, `KeyRegistry.js`, `keys.json` (all under `core/lib/utils/config/`), plus `core/lib/utils/file/Lock.js` and `core/lib/utils/file/RepoPath.js`. Keep the lint snippet's `files` list and allowlist patterns in sync with this (add `RepoPath.js` / `AgentEmail.js` entries and the `../file/RepoPath.js` pattern).
- Spec style: follow the existing parts (short sentences, `## Decisions` / `## Alternatives considered` / `## Open points` shape, relative links). Keep cross-reference anchors stable — other parts link to `shared-config-logic.md#open-points` and `#future-work`; update those links where the target moves.
- No migration, no code, no CI change in this issue.

# Issue: Migrate auto-fix-all-wait-ci-and-merge entrypoint to native Node.js

Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family. Last in the batch's suggested order — depended on two other sub-issues, both now merged (see Dependency status below).

## Source script

`auto-fix-all/scripts/wait_ci_and_merge.sh`

A thin orchestrator over `wait_ci.sh` and `github.sh pr-merge` — no CI-polling or merge logic of its own. Waits for CI; if it passes, immediately merges internally and prints the merged PR's URL as line 2 (line 1 `passed`). If CI fails, relays `wait_ci.sh`'s own `failed` output unchanged and does not attempt a merge. Exists as a separate script mainly so it's a distinctly-named, narrowly-allowlistable Bash invocation for the `shipit`-preapproved merge path (see issue #170) — the normal human-reviewed merge path still calls `wait_ci.sh` then a separate `github.sh pr-merge` invocation.

## Migration

**Dependency status: resolved.** This issue was blocked on both `auto-fix-all-wait-ci` (#262) and `auto-fix-all-github` (#265) migrating first, since this script is a thin orchestrator over them and its native version should call the two sibling native modules directly in-process rather than shelling out to bash. Both have since merged — `core/lib/AutoFixAllWaitCi.js` (`run(repoPath)`) and `core/lib/AutoFixAllGithub.js` (`prMerge(repoPath, modelEmail)`) both exist now — so this issue is unblocked and ready to implement.

Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-all/scripts/wait_ci_and_merge.sh` for its exact output/exit-code contract.
2. Create `core/lib/AutoFixAllWaitCiAndMerge.js` (zero runtime deps, built-in Node APIs only) — call `AutoFixAllWaitCi`'s `run` method and, on `passed`, `AutoFixAllGithub`'s `prMerge` method directly.
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'auto-fix-all-wait-ci-and-merge': { module: 'AutoFixAllWaitCiAndMerge.js', method: 'run' }`.
4. Add `"auto-fix-all-wait-ci-and-merge": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/lib/AutoFixAllWaitCiAndMerge_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code) in `core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js`.
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

None of its own — all external dependencies (GitHub REST API, git) live in the two modules it orchestrates.

## Dependencies on other sub-issues

Depended on both `auto-fix-all-wait-ci` (#262) and `auto-fix-all-github` (#265) migrations landing first — real functional dependency, not just a suggested order. Both merged; no remaining blockers.

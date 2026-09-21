# node Plan: Codacy: duplication cluster — engine_dispatch_spec.js family across Parity suites (43 clone groups, 4 files)

Main plan: [plan.md](plan.md)

## Overview

Four `engine_dispatch_spec.js` files under `core/spec/bin/` duplicate routing-test scaffolding. Three of them (`autoFixIssueGithubParity`, `autoFixAllWaitCiParity`, `autoFixAllWaitCiAndMergeParity`) share a real fixture shape (a git repo seeded as GitHub-like, `.claude/state/arcanum-config.json`'s `engine.mode`, a real per-entrypoint shim) and get a shared, flexible dispatch-routing example — flexible because their actual stdout/stderr/exit-code assertions differ per subcommand and file, so the shared example takes per-case setup/assertion callbacks rather than a fixed `(name, expectedArgs)` table (mirroring the existing `itRejectsMissingArgument`/`itRejectsInvalidRepoPath` shared examples in `core/spec/support/sharedExamples/cliParityValidation.js`). The fourth (`autoFixAllGithubParity`) tests something structurally different — the generic `engine_dispatch.sh` via a throwaway wrapper, no GitHub/PR fixture — and gets its own separate, smaller extraction instead of being folded into the shared harness.

## Context

Codacy reports 43 clone groups (~150 duplicated lines) across:
- `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js` — duplicates an inline `seedEngineMode(repo, mode)` helper and self-duplicates the seed/run/assert scaffold 4 times internally (once per sub-command: `info`, `pr-create`, `pr-view`, `pr-ready`).
- `core/spec/bin/autoFixAllWaitCiParity/engine_dispatch_spec.js` — duplicates the same inline `seedEngineMode(repo, mode)` helper and scaffold once.
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js` — already partly deduplicated: imports `SHIM_SCRIPT`/`seedLocalState` from its own setup factory (`core/spec/support/factories/autoFixAllWaitCiAndMergeParitySetup.js`) instead of an inline `seedEngineMode`, but still repeats the same seed/run/assert `describe`/`it` shape as the other two.
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js` — structurally different: no GitHub/PR fixture, no `fakeGh`, exercises the generic `arcanum/_lib/engine_dispatch.sh` via a throwaway wrapper script built in-test, and its own inline `seedEngineMode(repoDir, mode)` takes a plain directory rather than a repo object.

## Steps

- [01 — Add shared dispatch-routing helpers](node/01-add-shared-dispatch-routing-helpers.md)
- [02 — Dedupe autoFixIssueGithubParity and autoFixAllWaitCiParity](node/02-dedupe-autofixissuegithubparity-and-autofixallwaitciparity.md)
- [03 — Dedupe autoFixAllWaitCiAndMergeParity and extract autoFixAllGithubParity's own helper](node/03-dedupe-autofixallwaitciandmergeparity-and-autofixallgithubparity.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- Keep `autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js`'s existing `seedLocalState(repo, { engine: { mode } })` call as-is (it's already a working, differently-named equivalent) — only its `describe`/`it` scaffold needs to move onto the new shared dispatch-routing example, not its seeding call.
- `autoFixAllGithubParity/engine_dispatch_spec.js`'s own `seedEngineMode(repoDir, mode)` extraction should live next to (or inside) its existing throwaway-fixture helper (`core/spec/support/fixtures/engineDispatchFixtures.js` — see `buildDispatchFixtures`), not inside the new shared GitHub-fixture-based helpers, since it takes a plain directory rather than a repo object and has no GitHub/PR fixture at all.
- Preserve every existing scenario's exact assertions (stdout/stderr/exit code) — this is a pure refactor; behavior and coverage must not change.

# Node Plan: Codacy: duplication cluster — autoFixAllQueueParity sibling specs (push/save/pop/empty/list/next/wait-next) (7 files)

Main plan: [plan.md](plan.md)

## Overview
Add a case-driven shared example, `itMatchesShellForQueueOp`, that owns the shell-vs-native queue parity scaffold, covering both fixture setups: git + fake `gh` (`push`, `save`) and plain temp dirs (`pop`, `empty`, `list`, `next`, `wait-next`). Then rewrite all seven parity specs as thin lists of cases. This is a spec-only refactor: no `core/lib/` or shell script changes.

## Context
- `core/spec/support/factories/queueParitySetup.js` already provides `seedQueue`, `runPair`, `setupParityTest` (fake `gh` + two git fixture repos with a github.com-shaped origin), `SHELL_SCRIPTS` and `NATIVE_COMMANDS`.
- Each test currently repeats: build fixtures → `seedQueue` on both sides (sometimes skipped) → `runPair(op, shellRepo, nativeRepo, args, { env, fakeFetch })` → `expectParity(shell, native)` → assert `shell.code` (exact, or `not.toEqual(0)`) and `shell.stdout` → optionally a follow-up `runPair` (`push` → `list`, `pop` → `next`) whose shell stdout is asserted and whose native stdout must equal it → cleanup in `finally`.
- The github setup always needs `PATH=${ctx.fakeGh.binDir}:${process.env.PATH}` in `env`. It can only be built after `setupParityTest()` resolves, so the helper must prepend it itself; cases only supply the extra `FAKE_GH_*`/`FAKE_FETCH_*` vars.
- The existing shared-example convention is shown in `core/spec/support/sharedExamples/engineDispatchRouting.js`: exported `itXxx(description, …)` functions with full JSDoc.

## Steps

- [01 — Add the queue parity shared example](node/01-add-queue-parity-shared-example.md)
- [02 — Migrate the temp-dir specs (pop/empty/list/next/wait-next)](node/02-migrate-temp-dir-specs.md)
- [03 — Migrate the github specs (push/save)](node/03-migrate-github-specs.md)

## CI Checks
- `core`: `npm test` and `npm run lint` from `core/` (CircleCI jobs with `working_directory: ~/project/core`); or `make` targets run through Docker per the root Makefile's `core-*` targets.

## Notes
- Keep every test's `it` description string exactly as it is today, so test names are unchanged.
- Keep each spec file's header comment explaining the parity contract. Only the test bodies change.
- Keep the explanatory inline comments about expected stdout (for example the per-tag label lines and the stderr-only failure lines in `push`) next to the corresponding case data.
- The helper must be generic enough that the remaining clones fall below Codacy's threshold, but it should not add assertion knobs that no current case uses (no stderr assertions, for example).

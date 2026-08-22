# node Plan: Migrate auto-fix-all-checkout-from-main entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See plan.md's "Shared contracts" in full — node owns all of it: the `DispatchFailure` exit-code generalization, the `AutoFixAllCheckoutFromMain` module + its `COMMANDS` registration, and both test files. scripter only consumes the finished command name/shim contract once this agent's steps are done and merged into the branch.

## Steps

- [01 — Generalize DispatchFailure's exit code](node/01-generalize-dispatch-failure-exit-code.md)
- [02 — Implement AutoFixAllCheckoutFromMain and register it](node/02-implement-and-register-checkout-from-main.md)
- [03 — Unit tests for AutoFixAllCheckoutFromMain](node/03-unit-tests-checkout-from-main.md)
- [04 — Parity test (shell vs. native)](node/04-parity-test-checkout-from-main.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- Do the four steps in this exact order — 02 depends on 01 (throws the generalized `DispatchFailure`), 03 depends on 02, 04 depends on 02 and exercises 01's exit-code wiring end-to-end (no separate `arcanum_spec.js`/`DispatchFailure_spec.js` addition is required beyond what 01/03/04 already cover — the parity test proves exit `2` actually reaches the process, not just the thrown object).
- `git_branch_fetch_main`'s tolerated-missing-ref detection is a case-insensitive regex over stderr: `couldn't find remote ref|not found|no such ref`. Reuse this exact pattern natively — don't re-derive a different heuristic.
- The shell script calls `git_branch_fetch_main` twice on the branch-reuse path (once directly, once again inside `git_branch_merge_main`). This is redundant for stdout parity (git fetch's own output goes to stderr, not stdout) but mirror it anyway — it's what lets a commit pushed to `origin/main` between the two fetches actually get merged, exactly like the shell version.

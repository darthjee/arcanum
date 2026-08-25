# Update specs and verify parity

Reconcile `AutoFixAllGithub_spec.js` with the new facade shape, and verify the whole refactor is behavior-preserving end to end.

`AutoFixAllGithub_spec.js`'s existing parity assertions (expected stdout/error strings for all 7 subcommands) must pass **without assertion changes** — only the setup (constructing `AutoFixAllGithub` with injected/mocked `issueTagger`/`prOperations`/`branchCleanup`, or with real collaborators pointed at fakes/mocks, whichever the current spec style uses) may change. Also confirm `AutoFixAllWaitCiAndMerge_spec.js` still passes unchanged, since that class instantiates `AutoFixAllGithub` directly.

## Files to Change

- `core/spec/lib/commands/AutoFixAllGithub_spec.js` — remove spec cases now covered by `PrOperations_spec.js`/`BranchCleanup_spec.js` (avoid duplicate coverage), keep the facade-level delegation/wiring assertions and the full parity assertions for all 7 subcommands' stdout/error output.
- `core/spec/lib/commands/AutoFixAllWaitCiAndMerge_spec.js` — no assertion changes expected; run as a regression check that this consumer is unaffected.

## Verification

- Run `yarn test` in `core/` — all specs (including the new `PrOperations_spec.js`, `BranchCleanup_spec.js`, updated `IssueTagger_spec.js`/`Tags_spec.js`/`Origin_spec.js`/`AutoFixAllGithub_spec.js`) must pass.
- Run `yarn lint` in `core/` — must pass clean.
- Confirm `core/lib/commands/AutoFixAllGithub.js` is under ~100 lines.

# node Plan: Split spec ArcanumUpdateRunUpdateParity

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared setup module](node/01-extract-shared-setup-module.md)
- [02 — Create check_spec.js](node/02-create-check-spec.md)
- [03 — Create apply_spec.js](node/03-create-apply-spec.md)
- [04 — Delete the original spec file](node/04-delete-original-spec.md)

## CI Checks

- `core`: `make core-test` (CI job: `test`)
- `core`: `make core-lint` (CI job: `checks`)

## Notes

- Pure navigability improvement — every `it` moves verbatim, no assertion changes. Total spec
  count must stay identical before/after (`make core-test` output).
- `apply_spec.js` (step 03) references the module-level constants `SHELL_SCRIPTS`, `NATIVE_BIN`,
  and `NATIVE_COMMANDS` directly (not only through `runPair`) — these three constants must be
  exported from the shared setup module alongside the six helper functions the issue names, or
  `apply_spec.js` won't have what it needs.
- Convention check against sibling splits (`autoFixAllWaitCiParity/`, `autoFixAllQueueParity/`,
  etc.): shared setup modules live in `core/spec/support/factories/` and are named
  `<name>ParitySetup.js`; each split-out spec file flattens its single nested `describe` into one
  top-level block suffixed with the subcommand name, and keeps its own trimmed header comment
  cross-referencing the sibling file. Follow the same shape here.

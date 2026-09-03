# node Plan: Split spec AutoFixAllCheckoutFromMainParity

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract shared git-fixture helpers into a support factory](node/01-extract-shared-helpers.md)
- [02 — Split branch-topology and merge-conflict describes](node/02-split-happy-path-and-merge-conflict.md)
- [03 — Split argument-validation describes](node/03-split-argument-validation.md)
- [04 — Delete the original monolith and verify](node/04-delete-original-and-verify.md)

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- Every `it` moves verbatim — no assertion, fixture, or entrypoint change. `checkout_from_main_shell.sh`
  and the native `auto-fix-all-checkout-from-main` implementation are out of scope.
- Naming follows the precedent set by the `autoFixAllWaitCiParity` split (issue #350): a
  `core/spec/bin/<Name>Parity/` directory of `*_spec.js` files, plus a
  `core/spec/support/factories/<Name>ParitySetup.js` module for the shared fixture helpers —
  not the bare `autoFixAllCheckoutFromMainParity.js` name the issue used as an illustrative
  example.

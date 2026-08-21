# scripter Plan: Migrate next entry point to use native nodejs

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — this plan produces the shell side of the command key `resolve-id-and-file`, the exact `SCENARIO=`/`STATUS=`/`KEY=value` output contract, and the hard-failure non-numeric-id precondition that `node`'s native path depends on.

## Steps

- [01 — Extract the shell implementation](scripter/01-extract-shell-implementation.md)
- [02 — Convert to an engine_dispatch shim](scripter/02-convert-to-dispatch-shim.md)
- [03 — Verify the delegation chain](scripter/03-verify-delegation-chain.md)
- [04 — Flip the migration-status flag](scripter/04-flip-migration-status-flag.md)

## Notes

- Step 04 must not run until `node`'s work (unit tests, parity test) is committed on this branch and passing, and code review has approved it — see [plan.md](plan.md)'s "Gating."
- No shell-script CI exists in this repo today (`.circleci/config.yml` only runs `core/`'s `yarn test`/`yarn lint`) — Step 03 is a manual verification, not an automated check.

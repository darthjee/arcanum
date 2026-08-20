# scripter Plan: Migrate resolve_and_fetch.sh to a native (Node.js) implementation

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — this plan produces the shell side of the command key `resolve-and-fetch`, the simplified `#<id>`-only input grammar, the exact `STATUS=`/`ERROR=` output contract, and the `HOME`-inclusive `engine_dispatch` env allowlist that `node`'s native path depends on.

## Steps

- [01 — Simplify the id contract](scripter/01-simplify-id-contract.md)
- [02 — Convert to an engine_dispatch shim](scripter/02-convert-to-dispatch-shim.md)
- [03 — Add the opt-in migration notice](scripter/03-add-migration-notice.md)
- [04 — Fix resolve_id_and_file.sh's cwd bug](scripter/04-fix-resolve-id-and-file-cwd-bug.md)
- [05 — Flip the migration-status flag](scripter/05-flip-migration-status-flag.md)

## Notes

- Step 05 must not run until `node`'s work (unit tests, parity test) is committed on this branch and passing, and code review has approved it — see [plan.md](plan.md)'s "Gating."
- No shell-script CI exists in this repo today (`.circleci/config.yml` only runs `core/`'s `yarn test`/`yarn lint`) — verify these steps manually per the issue's own checklist item ("Manually verify `discuss-issue`, `enhance-issue`, and `arcanum-split-issue` all still work correctly with `engine=native` configured").

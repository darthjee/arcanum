# scripter Plan: Investigate removing dispatch-fixture / dispatch-fixture-crash

Main plan: [plan.md](plan.md)

## Shared contracts

`arcanum/_lib/test_engine_dispatch.sh`'s shell/native parity cases must anchor on `auto-fix-all-config-get` (shell twin: `auto-fix-all/scripts/config_get_shell.sh`), the same command `node` anchors `dispatcher_spec.js`'s `context: 'none'` proof on — see [plan.md](plan.md)'s "Shared contracts" for the full calling convention and expected output.

## Steps

- [01 — Rewire test_engine_dispatch.sh's parity cases](scripter/01-rewire-test-engine-dispatch.md)
- [02 — Delete the dispatch_fixture.sh shell twin](scripter/02-delete-dispatch-fixture-shell-script.md)
- [03 — Remove the migration-status.json entry and regenerate the doc](scripter/03-update-migration-status.md)

## Notes

- `test_engine_dispatch.sh` is standalone and not wired into CI (per its own header comment) — verify it manually with `bash arcanum/_lib/test_engine_dispatch.sh` after rewiring.
- `dispatch-fixture-crash` stays in scope of #342 — case 4 (native crash) keeps invoking `dispatch-fixture-crash` by name; only the shared `FIXTURE_SCRIPT`/`REPO_DIR` setup it reuses from cases 1/2 changes underneath it.

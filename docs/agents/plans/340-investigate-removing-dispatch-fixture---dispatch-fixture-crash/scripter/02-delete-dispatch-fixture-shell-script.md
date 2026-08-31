# Delete the dispatch_fixture.sh shell twin

Once [step 01](01-rewire-test-engine-dispatch.md) repoints `test_engine_dispatch.sh`'s `$FIXTURE_SCRIPT` at `auto-fix-all/scripts/config_get_shell.sh`, `arcanum/_lib/test_fixtures/dispatch_fixture.sh` has no remaining references anywhere in the repo. Delete it. Confirm first with a repo-wide search that nothing else still points at it.

## Files to Change

- `arcanum/_lib/test_fixtures/dispatch_fixture.sh` — delete.

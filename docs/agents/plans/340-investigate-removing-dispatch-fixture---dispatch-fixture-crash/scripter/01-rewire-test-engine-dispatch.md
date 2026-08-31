# Rewire test_engine_dispatch.sh's parity cases

`arcanum/_lib/test_engine_dispatch.sh` currently proves `engine_dispatch`'s shell/native parity (cases 1 & 2) using `dispatch-fixture` and its shell twin `arcanum/_lib/test_fixtures/dispatch_fixture.sh` (`$FIXTURE_SCRIPT`), with a `REPO_DIR` fixture that is *not* git-initialized (`dispatch-fixture` is `context: 'none'`, so nothing validates it as a repo). Cases 3 (fallback) and 4 (native crash, `dispatch-fixture-crash` — stays out of scope) reuse the same `$FIXTURE_SCRIPT`/`REPO_DIR`.

Re-point `$FIXTURE_SCRIPT` at `auto-fix-all/scripts/config_get_shell.sh` and the native command at `auto-fix-all-config-get`, per [plan.md](../plan.md)'s "Shared contracts":

- `git init` the `REPO_DIR` fixture (required by the shell twin's `repo_path_enter`).
- Seed `${REPO_DIR}/.claude/configuration/arcanum-repo-config.json` with `{"auto-fix-all": {"<key>": true}}` for a chosen `<key>` (e.g. `auto_merge`, matching the existing precedent in `autoFixAllConfigParity_spec.js`).
- Case 1 (`engine.mode=shell`) and case 2 (`engine.mode=native`, parity) now invoke both sides as `<script-or-native> "$REPO_DIR" "<key>"`; update `EXPECTED_OUTPUT` from `"dispatch-fixture: ok"` to `"true"`.
- Case 3 (fallback, unavailable native command) and case 4 (native crash, `dispatch-fixture-crash`) keep their own command-name arguments unchanged — only the shared `$FIXTURE_SCRIPT`/`REPO_DIR` they reuse changes underneath them; verify both still pass with the new fixture in place.

Update the file's header comment, which currently frames both `dispatch-fixture`/`dispatch-fixture-crash` as "implemented by the node agent working in parallel on this same issue" (#192) — that framing is specific to #192 and no longer applies to the (now real, already-migrated) `auto-fix-all-config-get` anchor; keep only what's still relevant to `dispatch-fixture-crash`.

## Files to Change

- `arcanum/_lib/test_engine_dispatch.sh` — re-anchor cases 1 & 2 on `auto-fix-all-config-get`/`config_get_shell.sh`, git-init and seed `REPO_DIR`, update `EXPECTED_OUTPUT`, verify cases 3 & 4 still pass, update the header comment.

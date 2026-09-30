# Scripter Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Main plan: [plan.md](plan.md)

## Shared contracts

You **produce** C2 (`--native-only` in `engine_dispatch.sh`) and C3 (`arcanum-check-config/scripts/check_config.sh`), both specified in [plan.md](plan.md#shared-contracts). You can rely on node's C1: `core/bin/arcanum arcanum-check-config <repo_path> <key>` reads `HOME` / `CLAUDE_CONFIG_DIR`, prints JSON on success, and prints usage to stderr with exit 1 for a missing key.

## Implementation Steps

### Step 1 — `--native-only` mode in `engine_dispatch.sh`
In `arcanum/_lib/engine_dispatch.sh`, recognize `--native-only` in the flag/env-var segment, next to `--prepend-repo-path`. When it's set:
- skip the shell/docker/migration-status branches;
- run the native invocation for `shell` / `native` / unset modes;
- return 1 with the C2 stderr message for `docker`.

Keep it bash 3.2 compatible (the guarded empty-array expansions), and keep the non-`--native-only` path byte-for-byte identical. Document the flag in the function's header comment, including that `<shell_script>` is `""` in this mode.

Extend `arcanum/_lib/test_engine_dispatch.sh` with cases for:
- `--native-only` under `engine.mode` unset, `shell`, and `native`: all reach the native bin. Use the already-routed `dispatch-fixture-crash` / `auto-fix-all-config-get` commands as the anchor, the same as the existing cases.
- `--native-only` under `docker`: exits 1 with the error message, and never runs the shell script.
- `--native-only` ignores `migration-status.json`: a command absent from the map still runs natively.

### Step 2 — Skill shim `check_config.sh`
Create `arcanum-check-config/scripts/check_config.sh` (executable, `set -euo pipefail`) per C3. Give it a header comment in the style of the other shims (e.g. `discuss-issue/scripts/render_issue.sh`) that explains:
- it's native-only;
- why `HOME` and `CLAUDE_CONFIG_DIR` are forwarded (global-tier resolution);
- that `<repo_path>` is the first forwarded arg, consumed by the `context: 'repo'` dispatcher, so `--prepend-repo-path` is not used.

## Files to Change
- `arcanum/_lib/engine_dispatch.sh` — add the `--native-only` flag and branch.
- `arcanum/_lib/test_engine_dispatch.sh` — add native-only cases.
- `arcanum-check-config/scripts/check_config.sh` — new shim.

## CI Checks
- `arcanum/_lib`: `bash arcanum/_lib/test_engine_dispatch.sh`. It's standalone and not wired into CI, but run it locally.
- If `shellcheck` is available: `shellcheck arcanum/_lib/engine_dispatch.sh arcanum-check-config/scripts/check_config.sh`.

## Notes
- The shim end-to-end needs node's C1 routed in `core/bin/arcanum`. Until then, only the usage-error path can be exercised locally.
- Don't add a `check_config_shell.sh`. There's no shell implementation, by design.

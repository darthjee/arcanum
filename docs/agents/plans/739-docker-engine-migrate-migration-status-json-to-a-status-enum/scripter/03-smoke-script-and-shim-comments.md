# Update the smoke script and native-only shim comments

**Smoke script:** update `arcanum/_lib/test_engine_dispatch.sh` for the new reading rule:

- fixture maps it writes use string values (`"native"`, `"shell"`) where they mean the new format;
- keep one legacy-boolean case (`false` → shell fallback with warning, `true` → native) to prove tolerance;
- add direct `_engine_dispatch_status` assertions for: each enum value, legacy `true`/`false`, missing key, unknown string, missing file and malformed file, for both `<native_only>` = `false` and `true`;
- case 9 (`--native-only` ignores the map) stays valid. Update its comment wording.

Run it locally: `bash arcanum/_lib/test_engine_dispatch.sh`.

**Shim header comments:** the 4 native-only shims say they are "not tracked in arcanum/_lib/migration-status.json". Reword them to say they are listed there with a non-`shell` status but never fall back to a shell twin.

## Files to Change

- `arcanum/_lib/test_engine_dispatch.sh` — enum fixtures, legacy case, direct reading-rule assertions.
- `arcanum-check-config/scripts/check_config.sh` — header comment.
- `arcanum-create-issue/scripts/start.sh` — header comment.
- `arcanum-create-issue/scripts/publish.sh` — header comment.
- `init-claude/scripts/set_next_step_auto.sh` — header comment.

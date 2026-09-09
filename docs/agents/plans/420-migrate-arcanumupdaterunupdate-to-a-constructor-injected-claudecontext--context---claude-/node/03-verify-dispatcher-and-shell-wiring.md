# Verify dispatcher and shell-engine wiring need no change

Confirm the surrounding plumbing already does the right thing once step 01's registry
entry flips to `context: 'claude'` — this step is verification, not expected to produce a
code change, but must actually be checked rather than assumed.

## Files to Change

- `core/lib/core/dispatcher.js` — read-only verification. `isContextBound()` already
  returns `true` for `context === 'claude'`, and `commandInstance()` already does
  `new ModuleClass(this.claudeContext)` for that case, stripping `args[0]` via
  `commandArgs()`. No change expected here — if verification finds otherwise, that's a
  scope surprise worth flagging rather than silently patching.
- `arcanum-update/scripts/run_update.sh` — read-only verification. `check` calls
  `engine_dispatch ... -- "$TARGET_PATH"` (single positional); `apply` calls
  `engine_dispatch ... HOME -- "$TARGET_PATH"` (env-allowlist `HOME`, then the same single
  positional). Confirm `$TARGET_PATH` is still the sole method-args entry in both cases —
  no change expected.
- `arcanum/_lib/engine_dispatch.sh` — read-only verification. Its native branch invokes
  `core/bin/arcanum <command> <args...>` where `<args...>` is exactly what `run_update.sh`
  passed after `--` (`$TARGET_PATH`), so `args[0]` at the `Dispatcher` is `$TARGET_PATH` —
  matching what `ClaudeContext` needs as its anchor. No change expected.
- `arcanum-update/scripts/run_update_check_shell.sh` /
  `run_update_apply_shell.sh` — read-only verification that these keep taking
  `$1 = TARGET_PATH` unchanged; the shell engine mode (`engine.mode=shell`) never touches
  `ClaudeContext` at all, so this migration must not alter shell-mode behavior.

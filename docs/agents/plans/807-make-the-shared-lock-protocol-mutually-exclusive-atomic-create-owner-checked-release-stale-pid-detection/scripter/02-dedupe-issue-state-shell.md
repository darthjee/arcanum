# Make issue_state_shell.sh source lock.sh

`arcanum/_lib/issue_state_shell.sh` carries its own copy of the old protocol (`_LOCK_INSTANCE_ID`, `_acquire_lock`, `_release_lock`). Delete that block and `source "${SCRIPT_DIR}/lock.sh"` instead (with the usual `# shellcheck source=lock.sh` directive, following the other callers). Keep `LOCK_FILE="${STATE_DIR}/issue-${ISSUE_ID}.lock"` and every acquire/release call site unchanged. Check that the "issue state lock" wording of its warning isn't asserted anywhere (grep `core/spec` and the parity specs); if it is, switch to the shared `lock.sh` wording.

## Files to Change
- `arcanum/_lib/issue_state_shell.sh` — remove inline lock helpers, source `lock.sh`.

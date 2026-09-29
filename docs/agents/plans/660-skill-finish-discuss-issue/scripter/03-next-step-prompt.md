# next_step_prompt.sh

Create `arcanum/_lib/next_step_prompt.sh`: a plain, `/dev/tty`-interactive bash script that is not engine-dispatched. Model it on `arcanum/migrations/run.sh`'s prompt:

- Check that `/dev/tty` is readable, using the `( exec 3< /dev/tty )` probe.
- Write the prompt to `/dev/tty`.
- `read -r choice < /dev/tty`.

Behavior:

- Require `--repo <dir>` (must be an existing directory) and at least one `--command`.
- Loop until the input is valid. Input is case-insensitive: `y|yes` → `CHOICE=yes` (exit 0), `n|no` → `CHOICE=no` (exit 0), `c|chat` → `CHOICE=chat` + `CHAT_CONTEXT=next_step` (exit 3).
- A usage error or unavailable tty prints nothing on stdout, writes an error to stderr, and exits 1.

## Files to Change
- `arcanum/_lib/next_step_prompt.sh`: new

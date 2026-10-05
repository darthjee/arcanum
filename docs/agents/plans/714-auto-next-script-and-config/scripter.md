# Scripter Plan: Auto-next: script and config

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the CLI behavior in [plan.md § Shared contracts](plan.md#shared-contracts): parsing, validation order, the enabled-key branch (stderr notice, `CHOICE=yes` + `AUTO=true`, exit 0), the `--no-prompt` branch (`CHOICE=no`, exit 0), and the unchanged fallback. The node agent's specs assert exactly that contract.

## Implementation Steps

### Step 1 — Parse and validate the new flags

In `arcanum/_lib/next_step_prompt.sh`:

- Add `AUTO_KEY=""`, `AUTO_KEY_SET=false`, `NO_PROMPT=false`.
- `--auto-key` takes a value (reuse the `$# -ge 2` check); reject an empty value with `_usage_error "--auto-key must not be empty"`.
- `--no-prompt` is a bare flag (`shift 1`).
- Update `_usage_error`'s usage line and the header comment (Usage, Output/exit table, a short paragraph on auto mode and `--no-prompt`, and a note that validation still runs before any config read or TTY probe).

### Step 2 — Add the auto / no-prompt branch before the TTY probe

- Source `config_chain.sh` relative to the script (`"$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config_chain.sh"`), after validation passes.
- If `AUTO_KEY` is set: `value="$(config_chain_read "$REPO_PATH" next_step "auto.${AUTO_KEY}" 2>/dev/null || true)"`. If `value == "true"` exactly: print the notice to stderr, `CHOICE=yes` and `AUTO=true` to stdout, `exit 0`.
- Then, if `NO_PROMPT=true`: `echo "CHOICE=no"`, `exit 0`.
- Otherwise fall through to the existing TTY probe untouched.
- Make sure `set -euo pipefail` cannot abort on a missing config file (`config_chain_read` returning non-zero / empty must mean "disabled").
- Keep the script plain bash (not engine-dispatched) and shellcheck-clean.

## Files to Change

- `arcanum/_lib/next_step_prompt.sh` — new flags, config read, auto/no-prompt branch, header and usage text.

## Notes

- Verify with the node agent's spec (`make core-test`), and check the not-enabled path by hand against a real TTY once if possible.
- Do not touch any skill markdown; calling the script with `--auto-key` from skills is #715.

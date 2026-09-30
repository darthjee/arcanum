# Scripter Plan: arcanum-migrate: run.sh /dev/tty prompt fails in Claude Code sessions

Main plan: [plan.md](plan.md)

## Shared contracts

`run.sh` interactive form, exactly as in [plan.md](plan.md#shared-contracts):
- `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"` (test-only override), used for the probe and the `read`.
- Up to date → exit `0` (unchanged, regardless of TTY).
- Pending + TTY not openable → stdout is exactly `FALLBACK=chat`, `CURRENT=`, `LOCAL=`, `GLOBAL=`, then one `PENDING=` per version ascending; exit `4`; errors file **not** reset.
- `--repo` validation still runs first (exit `1`, empty stdout).

## Implementation Steps

### Step 1 — Add the exit-`4` fallback to `cmd_interactive`
In `arcanum/migrations/run.sh`:
- Add `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"` near the top, with a comment marking it test-only (same wording style as `arcanum/_lib/next_step_prompt.sh`).
- In `cmd_interactive`, after the pending list is known to be non-empty, move the TTY probe **before** `_reset_errors_file` and the human-readable "Current version:" block. Use `( exec 3< "$TTY_DEVICE" )`. On failure, print the fallback lines (reuse the `CURRENT=/LOCAL=/GLOBAL=/PENDING=` emission from `cmd_check`; extract a small shared helper such as `_print_version_data` so both paths print identical lines) and `exit 4`.
- Replace `read -r choice < /dev/tty` with `read -r choice < "$TTY_DEVICE"`. If the read fails (TTY closed/EOF), it must still end in exit `1` (with `set -e` it already does; keep that behavior and make it explicit with a stderr message if needed).
- Remove the old "no interactive terminal … exit 1" branch.

### Step 2 — Update the header comment
Rewrite the Form 1 description and the exit-code contract paragraph at the top of `run.sh`: add the exit-`4` / `FALLBACK=chat` row, drop "no-TTY" from the exit-`1` list, and document `ARCANUM_TTY_DEVICE` as test-only. Point to `docs/agents/architecture/per-repo-migrations.md#script-driven-interaction`.

## Files to Change
- `arcanum/migrations/run.sh` — exit-`4` fallback, `TTY_DEVICE` override, probe moved before the errors-file reset, shared version-data printer, header comment.

## Notes
- Do not touch `select_version.sh`, `update_per_version.sh`, `update_per_file.sh` (out of scope per the issue).
- Run `shellcheck arcanum/migrations/run.sh` if available.

# Scripter Plan: next_step_prompt.sh always fails in Claude Code sessions (no /dev/tty), so next-step offers are never shown

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the `next_step_prompt.sh` output/exit contract from [plan.md](plan.md#shared-contracts), including the new exit-`4` row and the `ARCANUM_TTY_DEVICE` test-only override. The `node` spec and the `skill-writer` call sites rely on it exactly as written there.

## Implementation Steps

### Step 1 — Add the no-TTY fallback to `next_step_prompt.sh`
- Change `TTY_DEVICE="/dev/tty"` to `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"`, with a comment marking the variable as test-only.
- Keep argument validation where it is, before the TTY probe.
- Replace the failing branch of the `( exec 3< "$TTY_DEVICE" )` probe: instead of the stderr error + `exit 1`, print `FALLBACK=chat` and then `COMMAND=<cmd>` for each entry of `COMMANDS`, in order, then `exit 4`.
- Leave the "TTY closed before a valid answer" path at exit `1` and every existing `CHOICE=` path unchanged.
- Update the header comment's "Output (stdout) and exit code" block: add the exit-`4` row, and remove "/dev/tty unreadable" from the exit-`1` row (keep "closed before a valid answer"). Also note the fallback in the opening paragraph, replacing "never a chat-mediated yes/no" with a pointer to the TTY-first-with-`AskUserQuestion`-fallback convention in `docs/agents/architecture/skill-finish.md`.

## Files to Change
- `arcanum/_lib/next_step_prompt.sh` — test-only TTY override, exit-`4` fallback, header docs.

## Notes
- The script stays plain bash and is not engine-dispatched; no native counterpart and no `migration-status.json` entry.
- Sanity-check by hand: `ARCANUM_TTY_DEVICE=/nonexistent arcanum/_lib/next_step_prompt.sh --repo . --command "/a 1" --command "/b 2"; echo $?` should print `FALLBACK=chat`, `COMMAND=/a 1`, `COMMAND=/b 2`, then `4`.

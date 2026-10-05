# Skill-writer Plan: Auto-next: skill wiring

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on:
- `github.sh has-label` → `0` Epic, `1` not Epic, `2` unknown;
- `auto-plan-issue/scripts/auto_next.sh <repo_path> <id>` → `CHAIN=yes|no` (+ `REASON=`), with the notice on stderr;
- `next_step_prompt.sh` → `CHOICE=yes` + `AUTO=true`, with the notice on stderr.

The full offer table is in [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Interactive offers
- **`enhance-issue/steps/publish.md` §5**: before the prompt, run `../../auto-fix-all/scripts/github.sh has-label "$REPO_PATH" <id> Epic`. Pass `--auto-key enhance-issue` only on exit `1`. On exit `0` (Epic) or `2` (unknown), omit it so the normal offer is kept.
- **`discuss-issue/steps/discuss_and_save.md` §8**: add `--auto-key discuss-issue` to the first offer. For the second offer, set `--command "/loop /auto-resolve-issue <id>" --auto-key auto-plan-issue`; on `CHOICE=yes` it invokes `/loop /auto-resolve-issue <id>` (the `loop` skill).
- **`plan-issue/steps/write_and_confirm.md`**: same as discuss-issue's second offer (`/loop /auto-resolve-issue <id>`, `--auto-key auto-plan-issue`). Update the section heading and the chat-branch wording.
- In each, add a line covering `AUTO=true`: relay the `auto-continuing: ...` stderr notice to the user, then proceed exactly as on `CHOICE=yes` (a chained top-level run, never `NESTED=true`). Also update the exit-code summary blockquote to mention `AUTO=true`.

### Step 2 — Top-level `auto-plan-issue` chaining
In `auto-plan-issue/steps/run.md`:
- Change every `--next "/auto-resolve-issue <id>"` (including the "plan already exists" path and the Closing report template) to `--next "/loop /auto-resolve-issue <id>"`.
- Add an "Auto-next" subsection, used by both success exits and only when `NESTED` is absent. Before the success report, run `scripts/auto_next.sh "$REPO_PATH" <id>`. Print the success report as usual.
  - If it printed `CHAIN=yes`: relay its stderr notice, then invoke `/loop /auto-resolve-issue <id>` inline as a chained top-level run.
  - On `CHAIN=no`, or a non-zero exit: end after the report, as today. On a non-zero exit, add a one-line note with the stderr.
- State that a nested run never calls `auto_next.sh`, and update the "Do not ... invoke any fix/PR skill" wording in Step 6 to make an exception for this opt-in chain.
- Check `auto-plan-issue/SKILL.md` and update its description or next-step mention if it names the bare `/auto-resolve-issue`.

## Files to Change
- `enhance-issue/steps/publish.md`: Epic check + `--auto-key enhance-issue`, `AUTO=true` handling.
- `discuss-issue/steps/discuss_and_save.md`: `--auto-key` on both offers, `/loop` second command.
- `plan-issue/steps/write_and_confirm.md`: `/loop` command + `--auto-key auto-plan-issue`.
- `auto-plan-issue/steps/run.md`: `/loop` in `--next`, Auto-next subsection.
- `auto-plan-issue/SKILL.md`: only if it mentions the next command.

## Notes
- Every `/dev/tty`-owning call keeps its exit-4 `FALLBACK=chat` → `AskUserQuestion` handling (`skill-reviewer` checks this). `--auto-key` with the key enabled never reaches exit 4.

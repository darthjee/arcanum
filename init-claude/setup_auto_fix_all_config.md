# Setup `auto-fix-all` Personal Run Behavior

Configure the personal, gitignored settings that control how `/auto-fix-all` behaves between issues in this project.

## Step 1 — Ask the user

```
Would you like to configure how /auto-fix-all behaves between issues in this project (clear_context, finish_on_empty_queue)? [y/n]
```

If the user says no, skip silently — do not write anything.

## Step 2 — Explain and ask for each flag

If the user opts in, explain each flag in plain language and ask for each independently:

- `clear_context` — clear conversation context between issues (via a short `ScheduleWakeup` pause); only takes effect when `auto-fix-all` is invoked through `/loop`.
- `finish_on_empty_queue` — stop the run once the queue empties instead of waiting forever for more issues to be pushed onto it.

## Step 3 — Write the configuration

For each flag the user gives an answer for, run:

```bash
../auto-fix-all/scripts/config.sh set clear_context true|false
../auto-fix-all/scripts/config.sh set finish_on_empty_queue true|false
```

> Resolve `../auto-fix-all/scripts/config.sh` relative to the `init-claude` skill folder. Both keys are routed to `.claude/state/auto-fix-all-config.json` (gitignored, not committed).

If the user skips a flag (gives no answer for it), don't run `config.sh set` for that key — leave it unset (default `false`).

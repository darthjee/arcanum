# Setup Repository Labels

Ensure the repository has the standard set of GitHub issue labels the Arcanum automation skills rely on (`shipit`, `Enqueued`, `Working`, `Ready`, `Created`, etc.), with consistent colors.

> Note: unlike most other scripts in this repo, `scripts/sync_labels.sh` does its own interactive `y`/`n`/`yes`/`no` prompting on stdin rather than delegating the question to you (the agent asking in chat, then passing the reply to a `confirm.sh`-style resolver). This is intentional for this one step — do not "fix" it to match the more common pattern.

## Step 1 — Start from the default table

Nothing is persisted to `.claude/configuration/` or anywhere else for this step — every `init-claude` run starts from this hardcoded default table and performs a live, one-shot sync to GitHub:

| Label | Color |
| -------- | -------- |
| Bug | #b60205 |
| Documentation | #0075ca |
| Enqueued | #e8e639 |
| Feature | #e9a20f |
| Ready | #247b61 |
| Refactor | #983e7f |
| shipit | #0e8a16 |
| Created | #024fa5 |
| Working | #c314d7 |

## Step 2 — Show the table and sync

Render the current table to the user (`Label`, `Color` columns; show `null` for any label that doesn't have a color yet) and let them know you're about to ask for confirmation to sync it to GitHub.

Every label in the default table already has a color, so invoke the script right away:

```bash
scripts/sync_labels.sh <Label1>:<color1> [<Label2>:<color2> ...]
```

> Resolve `scripts/sync_labels.sh` relative to the `init-claude` skill folder. Pass each label as `<name>:<hex color>`, color without a leading `#` (e.g. `Bug:b60205`). The script itself prints the table and prompts the user for `y`/`n`/`yes`/`no` confirmation on stdin — you do not ask this question yourself.

Interpret its output:

- **`STATUS=synced` (exit 0)** — report the created/updated labels (the `CREATED=<name>`/`UPDATED=<name>` lines) back to the user, and finish this step.
- **`STATUS=discuss` (exit 1)** — the user answered "no" to the script's prompt. Ask them directly:
  ```
  Would you like to change the label list, or skip label syncing for this run?
  ```
  - **Skip**: finish this step with no further action and no GitHub calls.
  - **Change the list**: go to Step 3 (the refinement loop) below, then come back and re-invoke the script with the updated table.

## Step 3 — Refinement loop

Only entered from the "change the list" branch above, or whenever the table has any label with a `null` color that must be resolved before the script can run.

Show the current table and let the user, in a loop, do any of the following until they say they're satisfied:
- Add a label (color optional at this point)
- Remove a label
- Update a label's color
- Replace one or more entries
- Replace the whole table (colors optional at that point)

Once the user is satisfied, if any label in the table still has a `null` color, ask for it directly — the script requires every label to have a color before it can be invoked. Then go back to Step 2 and re-invoke `scripts/sync_labels.sh` with the updated, fully-colored table.

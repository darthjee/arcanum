# Setup Repository Labels

Ensure the repository has the standard set of GitHub issue labels the Arcanum automation skills rely on (`shipit`, `Enqueued`, `Working`, `Ready`, `Created`, etc.), with consistent colors.

> Note: unlike most other scripts in this repo, `scripts/sync_labels.sh` does its own interactive `y`/`n`/`yes`/`no` prompting on stdin rather than delegating the question to you (the agent asking in chat, then passing the reply to a `confirm.sh`-style resolver). This is intentional for this one step — do not "fix" it to match the more common pattern.

## Step 1 — The label table lives in `.claude/state/init-claude-config.json`

The label/color table is no longer threaded through CLI arguments. It is persisted in the repository being initialized, at `.claude/state/init-claude-config.json`, using this schema:

```json
{
  "labels": [
    { "name": "<label name>", "color": "<hex color, no leading '#'>" }
  ]
}
```

Neither you nor `scripts/sync_labels.sh` need to hardcode a default table anymore: `scripts/lib/label_config.sh`'s `label_config_ensure_defaults` function (invoked automatically by `scripts/sync_labels.sh`, see Step 2) populates this file with the standard 9 labels the first time it's missing or its `labels` array is empty. You never need to write this file by hand for a first run.

## Step 2 — Invoke the script

```bash
scripts/sync_labels.sh
```

> Resolve `scripts/sync_labels.sh` relative to the `init-claude` skill folder. With no argument it reads/writes `.claude/state/init-claude-config.json`; pass an explicit path as `$1` only if you have a reason to point it elsewhere.

The script does everything in one shot: it ensures the config file exists and is populated (initializing the defaults if it was missing or empty), prints the current table as markdown, prompts `Sync these labels to GitHub? [y/n]:` on stdin, and on `y`/`yes` creates/updates the labels on GitHub. You do not ask this confirmation question yourself, and you do not need to render the table separately before calling it — its own printed table is what the user sees.

Interpret its output:

- **`STATUS=synced` (exit 0)** — report the created/updated labels (the `CREATED=<name>`/`UPDATED=<name>` lines) back to the user, and finish this step.
- **`STATUS=discuss` (exit 1)** — the user answered "no" to the script's prompt. Ask them directly:
  ```
  Would you like to change the label list, or skip label syncing for this run?
  ```
  - **Skip**: finish this step with no further action and no GitHub calls.
  - **Change the list**: go to Step 3 (the refinement loop) below, then come back and re-invoke the script.

## Step 3 — Refinement loop

Only entered from the "change the list" branch above.

Read the current table from `.claude/state/init-claude-config.json` (`jq '.labels'`) and show it to the user. Let them, in a loop, do any of the following until they say they're satisfied:
- Add a label (color optional at this point)
- Remove a label
- Update a label's color
- Replace one or more entries
- Replace the whole table (colors optional at that point)

Once the user is satisfied, if any label in the table still has a `null`/missing color, ask for it directly — the config requires every label to have a color. Then persist the updated table:

```bash
scripts/write_label_config.sh .claude/state/init-claude-config.json <Label1>:<color1> [<Label2>:<color2> ...]
```

> Resolve `scripts/write_label_config.sh` relative to the `init-claude` skill folder. Pass every label currently in the table (not just the changed ones) as `<name>:<hex color>`, color without a leading `#` — this call replaces the file's `labels` array wholesale.

Then go back to Step 2 and re-invoke `scripts/sync_labels.sh` (still with no argument — it now reads the table you just wrote).

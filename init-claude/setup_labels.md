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

`scripts/write_label_config.sh` (resolve relative to the `init-claude` skill folder) takes a subcommand as its first argument, so each edit below is persisted to `.claude/state/init-claude-config.json` immediately rather than batched:

```bash
scripts/write_label_config.sh replace <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
scripts/write_label_config.sh remove  <config_path> <Label1> [<Label2> ...]
scripts/write_label_config.sh add     <config_path> <Label1>:<color1> [<Label2>:<color2> ...]
```

`<config_path>` is `.claude/state/init-claude-config.json`. `replace` overwrites the whole `labels` array wholesale; `remove` deletes the named labels (by name) from the array, leaving the rest untouched; `add` upserts each `<name>:<color>` pair — updating the color if the name already exists, appending it otherwise.

Read the current table from `.claude/state/init-claude-config.json` (`jq '.labels'`) and show it to the user. Let them, in a loop, do any of the following until they say they're satisfied — apply each action to the file as soon as it's decided, using the matching subcommand:
- **Add a label** — ask for its color now (the `add` subcommand requires one per pair), then run `write_label_config.sh add <config_path> <name>:<color>`.
- **Remove a label** — run `write_label_config.sh remove <config_path> <name>`.
- **Update a label's color** — run `write_label_config.sh add <config_path> <name>:<new color>` (upsert overwrites the existing entry).
- **Replace one or more entries** — combine `remove`/`add` calls as above for each affected label.
- **Replace the whole table** — collect the user's full desired table first (asking for any missing colors, since `replace` requires one per pair), then run a single `write_label_config.sh replace <config_path> <name1>:<color1> [<name2>:<color2> ...]` with the entire new table.

Once the user says they're satisfied (all edits already persisted via the calls above), go back to Step 2 and re-invoke `scripts/sync_labels.sh` (still with no argument — it reads whatever is currently in the file).

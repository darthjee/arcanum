---
name: arcanum-check-config
description: Shows what each arcanum config tier (local state → repo config → global config) holds for a key, plus the final resolved value and which tier it came from. Read-only. Usage: /arcanum-check-config <namespace.key[.sub...]> (e.g. /arcanum-check-config git.authors)
---

Show where an arcanum config value comes from — no user interaction.

## Step 1 — Resolve REPO_PATH

Resolve `REPO_PATH="$(pwd)"` now — the one moment the target project's root can be trusted from ambient cwd.

## Step 2 — Query the config chain

Run, with `<key>` being the skill's argument (pass an empty string if no argument was given — the script prints the usage error):

```bash
scripts/check_config.sh "$REPO_PATH" "<key>"
```

## Step 3 — Report

- **Exit `0`:** relay stdout verbatim in a fenced `json` block, then add one sentence: "The final value comes from the `<final.source>` tier." — or, when `final.source` is `null`, "No tier sets `<key>`."
- **Non-zero exit:** relay stderr as-is and stop.

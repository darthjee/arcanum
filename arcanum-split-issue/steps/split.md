# Generate Sub-Issue Files and Confirm

By this point, [discuss.md](discuss.md) has already pushed the updated parent draft to GitHub, and the discussion determined how the issue splits into sub-issues.

## 1. Generate one local file per sub-issue

For each agreed sub-issue, write its body to a temporary file, then run:

```bash
../scripts/create_sub_issue_file.sh "$REPO_PATH" <id> "<sub-issue title>" <body_file>
```

> Resolve `../scripts/create_sub_issue_file.sh` relative to this file's directory. Prints `FILE=<path written>` — the script determines the next zero-padded count on its own by scanning existing `docs/agents/issues/<id>_*` files, so call it once per sub-issue, in whatever order you want them numbered.

## 2. Summarize and confirm

Once every sub-issue file has been generated, show the user a summary: the count of sub-issues and each one's title. Ask for explicit confirmation, e.g.:

```
About to create <N> GitHub issues, linked to #<id>:
- <title 1>
- <title 2>
...
Proceed? [y/n]
```

Check the reply deterministically:

```bash
../../discuss-issue/scripts/confirm.sh "<user's reply>"
```

> Resolve `../../discuss-issue/scripts/confirm.sh` relative to this file's directory — reused directly rather than duplicated.

- **Exits 0 (confirmed)** — proceed to [push.md](push.md).
- **Exits 1 (declined)** — stop here. Tell the user the sub-issue files remain locally under `docs/agents/issues/` (not committed, not pushed to GitHub) and nothing else was changed; they can resume later by re-running this skill — [fetch.md](fetch.md)'s existing-sub-issues check won't trigger yet (nothing was pushed), and any already-generated files are picked up as the starting count the next time a file is created.

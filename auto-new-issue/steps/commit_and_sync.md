# Commit the Issue File and Sync to GitHub

## Commit

Run:

```bash
scripts/commit_issue.sh <FILE> <ID> "<your AI model name>" "<your AI model noreply email>"
```

This stages `<FILE>` and commits it using the repo's commit message template (`.github/commit_message_template.md`), with `type=docs`, `scope=issue`, subject `"add issue file"`, and the agent fixed to `architect`. Never commit by hand — always go through this script.

## Sync to GitHub

If `ID` is an auto-assigned local ID (prefixed with `X`, e.g. `X01`), skip this step entirely — there is no GitHub counterpart to update.

Otherwise, run:

```bash
scripts/github.sh update <ID> "<Title>" <FILE>
```

The script resolves the GitHub domain and repository from `git remote get-url origin`, so no manual repo argument is needed. The body is read directly from the saved issue file via `--body-file`.

This is the final step of the skill — once the sync command returns (or is skipped for a local ID), the issue creation is complete. No further confirmation or output is required.

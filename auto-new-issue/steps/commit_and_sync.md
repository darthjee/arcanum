# Commit the Issue File and Sync to GitHub

## Mint the GitHub issue if needed

If Step 1's `STATUS` was `missing_id`, no real GitHub issue exists yet. Mint one now, **before committing**:

```bash
scripts/github.sh create "<Title>" <temp_file>
```

Parse the returned `ID` and `FILE` — these replace the placeholder values from Step 1 and are used for the rest of this step. The script already wrote the body to the canonical `FILE`, so skip "Sync to GitHub" below entirely once this runs.

Otherwise (the ID was already known from Step 1, e.g. an explicit numeric id or a successful fetch), skip this sub-step and proceed directly to "Commit" with the `ID`/`FILE` already known.

## Commit

Run:

```bash
scripts/commit_issue.sh <FILE> <ID> "<your AI model name>" "<your AI model noreply email>"
```

This stages `<FILE>` and commits it using the repo's commit message template (`.github/commit_message_template.md`), with `type=docs`, `scope=issue`, subject `"add issue file"`, and the agent fixed to `architect`. Never commit by hand — always go through this script.

## Sync to GitHub

Skip this step if "Mint the GitHub issue if needed" above already ran — the body is already canonical on GitHub.

Otherwise, run:

```bash
scripts/github.sh update <ID> "<Title>" <FILE>
```

The script resolves the GitHub domain and repository from `git remote get-url origin`, so no manual repo argument is needed. The body is read directly from the saved issue file via `--body-file`.

This is the final step of the skill — once the sync command returns (or is skipped because the issue was just minted), the issue creation is complete. No further confirmation or output is required.

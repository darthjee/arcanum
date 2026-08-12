# Commit the Issue File and Sync to GitHub

## Mint the GitHub issue if needed

If Step 1's `STATUS` was `missing_id`, no real GitHub issue exists yet. Mint one now, **before committing**:

```bash
scripts/github.sh create "$REPO_PATH" "<Title>" <temp_file>
```

Parse the returned `ID` and `FILE` — these replace the placeholder values from Step 1 and are used for the rest of this step. The script already wrote the body to the canonical `FILE`, so skip "Sync to GitHub" below entirely once this runs.

Otherwise (the ID was already known from Step 1, e.g. an explicit numeric id or a successful fetch), skip this sub-step and proceed directly to "Commit" with the `ID`/`FILE` already known.

## Commit

Run:

```bash
scripts/commit_issue.sh "$REPO_PATH" <FILE> <ID> "<your AI model name>" "<your AI model noreply email>"
```

This stages `<FILE>` and commits it using the repo's commit message template (`.github/commit_message_template.md`), with `type=docs`, `scope=issue`, subject `"add issue file"`, and the agent fixed to `architect`. Never commit by hand — always go through this script.

## Sync to GitHub

Skip this step if "Mint the GitHub issue if needed" above already ran — the body is already canonical on GitHub.

Otherwise, run:

```bash
scripts/github.sh update "$REPO_PATH" <ID> "<Title>" <FILE>
```

`$REPO_PATH` is the target project's root, threaded through from Step 1 of [run.md](run.md) — the script requires it explicitly rather than resolving the GitHub domain/repository from ambient `git remote get-url origin`. The body is read directly from the saved issue file via `--body-file`.

This is the final step of the skill — once the sync command returns (or is skipped because the issue was just minted), the issue creation is complete. No further confirmation or output is required.

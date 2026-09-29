# Commit the Issue File and Sync to GitHub

## Closing report

Every exit of this skill ends with exactly one report printed by the shared script. That covers the success in [Success report](#success-report) below, the failed exits in this file, and the exits in [run.md](run.md) (`STATUS=existing` and a failed Step 1):

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-new-issue --status success|failed \
  --summary "<one line>" [--issue <ID>] [--next "/auto-plan-issue <ID>"] [--nested]
```

> Resolve `../arcanum/_lib/finish_report.sh` relative to the `auto-new-issue` skill folder, the same folder the `scripts/...` calls in these steps resolve against. This skill never asks the user anything, so there is no `declined` status. It changes no labels, so `--label-change` is never passed.

- Relay its stdout **verbatim** as the last thing you print. Never hand-format, extend, or paraphrase it.
- Pass only what actually happened: `--issue <ID>` only once an id is known.
- `failed` reports never carry `--next`.
- If the script itself exits non-zero (usage error), say in one line that the closing report could not be rendered, and end.

### Nested runs

When your invocation carried `NESTED=true` (see [run.md](run.md)), make every `finish_report.sh` call in this file and in [run.md](run.md) with the same flags **minus `--next`**, **plus `--nested`**. The script then prints a `FINISH_*` result block instead of a report. End by relaying that block verbatim to your caller, with no report and no `Next:` line.

### Failed exits

Whenever a step below (or in [run.md](run.md)) says "**fail with** `<step>`", stop the skill right there. Leave any files already written on disk, and do not retry. Print the `failed` report, with a summary naming the failed step:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-new-issue --status failed [--issue <ID>] \
  --summary "<step> failed: <short reason>."
```

Pass `--issue <ID>` only when an id was known when the step failed. Then end, with no `--next`.

## Mint the GitHub issue if needed

If Step 1's `STATUS` was `missing_id`, no real GitHub issue exists yet. Mint one now, **before committing**:

```bash
scripts/github.sh create "$REPO_PATH" "<Title>" <temp_file>
```

If it exits non-zero, **fail with** `github.sh create`. No id exists yet, so omit `--issue` from the report.

On success, parse the returned `ID` and `FILE` — these replace the placeholder values from Step 1 and are used for the rest of this step. The script already wrote the body to the canonical `FILE`, so skip "Sync to GitHub" below entirely once this runs.

Otherwise (the ID was already known from Step 1, e.g. an explicit numeric id or a successful fetch), skip this sub-step and proceed directly to "Commit" with the `ID`/`FILE` already known.

## Commit

Run:

```bash
scripts/commit_issue.sh "$REPO_PATH" <FILE> <ID> "<your AI model name>" "<your AI model noreply email>"
```

If it exits non-zero, **fail with** `commit_issue.sh` (with `--issue <ID>`).

This stages `<FILE>` and commits it using the repo's commit message template (`.github/commit_message_template.md`), with `type=docs`, `scope=issue`, subject `"add issue file"`, and the agent fixed to `architect`. Never commit by hand — always go through this script.

## Sync to GitHub

Skip this step if "Mint the GitHub issue if needed" above already ran — the body is already canonical on GitHub.

Otherwise, run:

```bash
scripts/github.sh update "$REPO_PATH" <ID> "<Title>" <FILE>
```

`$REPO_PATH` is the target project's root, threaded through from Step 1 of [run.md](run.md) — the script requires it explicitly rather than resolving the GitHub domain/repository from ambient `git remote get-url origin`. The body is read directly from the saved issue file via `--body-file`.

If it exits non-zero, **fail with** `github.sh update` (with `--issue <ID>`).

## Success report

Once the sync command returns, or is skipped because the issue was just minted, the issue creation is complete. Print the `success` report and relay it verbatim (see [Closing report](#closing-report)):

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-new-issue --status success --issue <ID> \
  --summary "Issue #<ID> created, committed and synced to GitHub." --next "/auto-plan-issue <ID>"
```

With `NESTED=true`, drop `--next` and add `--nested` (see [Nested runs](#nested-runs)).

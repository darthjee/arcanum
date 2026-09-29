# Publish the PR

This skill never replicates the metadata-file tracking used by Majora's `draft-pr`/`mark-ready` (no `.claude/state/metadata/issue_<id>.json` equivalent). Instead, it checks GitHub directly for an existing PR on the current branch.

`REPO_PATH` (the target project's root) is carried in from [run.md](run.md) — thread it through to every `scripts/github.sh` call below.

## Check for an existing PR

Run:

```bash
scripts/github.sh pr-view "$REPO_PATH"
```

- **Exit code 0** — a PR already exists for the current branch. Parse `URL=` and `IS_DRAFT=` from the output.
  - If `IS_DRAFT=true`, mark it ready (path: **`pr-ready`**):

    ```bash
    scripts/github.sh pr-ready "$REPO_PATH"
    ```

    If it exits non-zero, **fail with** `open PR`, with `--issue <id>` (see [run.md](run.md)'s [Failed exits](run.md#failed-exits)).

  - If `IS_DRAFT=false`, the PR is already open and ready — nothing more to do (path: **already open and ready**).
- **Exit code 1, no error message** — no PR exists yet for this branch. Proceed to "Create the PR" below.
- **Exit code 1, with an error message on stderr** — a real GitHub/`gh` error occurred. Do not silently continue: **fail with** `open PR`, with `--issue <id>` (see [run.md](run.md)'s [Failed exits](run.md#failed-exits)).

Remember which path ran — `pr-create`, `pr-ready`, or already open and ready — for the [Report](#report) below.

## Create the PR

Write the PR body to a temporary file following the structure of `.github/pull_request_template.md`:

```markdown
## Summary
<one sentence describing what this PR does>

## Problem
<what problem does this solve — drawn from the issue>

## Solution
<how it was solved — drawn from the plan's implementation steps>

## Details
<optional: implementation notes, migration steps, caveats. Omit this section if not needed.>

Fixes #<id>
```

Then run:

```bash
scripts/github.sh pr-create "$REPO_PATH" "Fix #<id> — <title>" /tmp/pr_body_<id>.md
```

> Resolve `scripts/github.sh` relative to the `auto-fix-issue` skill folder.

This is the **`pr-create`** path. If it exits non-zero, **fail with** `open PR`, with `--issue <id>` (see [run.md](run.md)'s [Failed exits](run.md#failed-exits)).

## Report

Once [run.md](run.md) has recorded the `pr_published` step, read the PR number stored by `pr-create` / `pr-view`:

```bash
scripts/issue_state.sh "$REPO_PATH" get <id> pr_id
```

Then print the `success` report and relay it verbatim as the last thing you print (see [run.md](run.md)'s [Closing report](run.md#closing-report)):

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-fix-issue --status success --issue <id> --pr <pr_id> \
  [--label-change :pr] --summary "<one line>" --next "/auto-monitor-issue-pr <id>"
```

- Pass `--label-change :pr` only when `pr-create` or `pr-ready` ran in this run, even if its best-effort label add warned. Omit it when the PR was already open and ready.
- Summary by path: `"PR opened for #<id>."` (`pr-create`), `"Draft PR marked ready for #<id>."` (`pr-ready`), or `"PR for #<id> was already open and ready."`.
- With `NESTED=true`, drop `--next` and add `--nested`, then relay the `FINISH_*` block to your caller (see [run.md](run.md)'s [Nested runs](run.md#nested-runs)).

No confirmation is needed at any point in this step.

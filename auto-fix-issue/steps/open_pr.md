# Publish the PR

This skill never replicates the metadata-file tracking used by Majora's `draft-pr`/`mark-ready` (no `.claude/state/metadata/issue_<id>.json` equivalent). Instead, it checks GitHub directly for an existing PR on the current branch.

## Check for an existing PR

Run:

```bash
scripts/github.sh pr-view
```

- **Exit code 0** — a PR already exists for the current branch. Parse `URL=` and `IS_DRAFT=` from the output.
  - If `IS_DRAFT=true`, mark it ready:
    ```bash
    scripts/github.sh pr-ready
    ```
  - If `IS_DRAFT=false`, the PR is already open and ready — nothing more to do.
  - In both cases, persist the PR URL and number to the issue state (see "Persist PR state" below).
- **Exit code 1, no error message** — no PR exists yet for this branch. Proceed to "Create the PR" below.
- **Exit code 1, with an error message on stderr** — a real GitHub/`gh` error occurred. Report it; do not silently continue.

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
scripts/github.sh pr-create "Fix #<id> — <title>" /tmp/pr_body_<id>.md
```

> Resolve `scripts/github.sh` relative to the `auto-fix-issue` skill folder.

Persist the PR URL and number to the issue state (see "Persist PR state" below).

## Persist PR state

After every code path that yields a PR URL (`pr-view` or `pr-create`), extract the PR number from the URL (the last `/`-delimited path segment) and write both fields to the issue state:

```bash
scripts/issue_state.sh set <id> pr_url <url>
scripts/issue_state.sh set <id> pr_id  <number>
```

> Resolve `scripts/issue_state.sh` relative to the `auto-fix-issue` skill folder.

## Report

Report the final PR URL to the user. No confirmation is needed at any point in this step.

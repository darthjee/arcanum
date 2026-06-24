# Architect Plan: Delete Branch After Merging

Main plan: [plan.md](plan.md)

## Shared contracts

`github.sh cleanup-branch <branch>` — new command in `auto-fix-all/scripts/github.sh` (implemented by the scripter agent).

- **Input:** `<branch>` — the local branch name to delete.
- **Behaviour:** deletes the remote branch (tolerating not-found), checks out `main`, resets to `origin/main`, deletes the local branch.
- **Output:** exits 0 on success.

## Implementation Steps

### Step 1 — Update the "If `merged`" path in `process_one_issue.md`

In `auto-fix-all/steps/process_one_issue.md`, find the "### If `merged`" section (under "Monitor the PR"):

```markdown
### If `merged`

Report `OUTCOME=merged`. Done — stop here.
```

Replace it with:

```markdown
### If `merged`

Capture the current branch name, then run cleanup:

```bash
BRANCH=$(git branch --show-current)
scripts/github.sh cleanup-branch "$BRANCH"
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=merged`. Done — stop here.
```

### Step 2 — Update the "If CI `passed`" path in `process_one_issue.md`

Find the "#### If CI `passed`" section:

```markdown
#### If CI `passed`

```bash
scripts/github.sh pr-merge
```

Report `OUTCOME=merged`. Done — stop here.
```

Replace it with:

```markdown
#### If CI `passed`

```bash
scripts/github.sh pr-merge
```

Capture the current branch name, then run cleanup:

```bash
BRANCH=$(git branch --show-current)
scripts/github.sh cleanup-branch "$BRANCH"
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=merged`. Done — stop here.
```

### Step 3 — Verify the instruction file resolves `scripts/github.sh` consistently

Both new call-sites already reference `scripts/github.sh` relative to the `auto-fix-all` skill folder, consistent with every other `scripts/github.sh` call in the same file.

## Files to Change

- `auto-fix-all/steps/process_one_issue.md` — add `cleanup-branch` calls on both merge paths.

## Notes

- The `BRANCH=$(git branch --show-current)` capture must happen before `pr-merge` (for the CI-passed path) or before any further action (for the monitor-detected merge path), because `cleanup-branch` switches to `main` and the current branch name would no longer be available afterward.
- The closed-without-merge path is intentionally left untouched per the issue spec.

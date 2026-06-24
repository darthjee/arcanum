# Scripter Plan: Delete Branch After Merging

Main plan: [plan.md](plan.md)

## Shared contracts

`github.sh cleanup-branch <branch>` — new command in `auto-fix-all/scripts/github.sh`.

- **Input:** `<branch>` — the local branch name to delete (e.g. `issue-55`).
- **Behaviour:**
  1. Attempt `git push origin --delete <branch>`; tolerate a non-zero exit (branch may already be deleted by GitHub's auto-delete setting).
  2. `git checkout main && git reset --hard origin/main`
  3. `git branch -D <branch>`
- **Output:** nothing on stdout; exits 0 on success.
- **`cmd_pr_merge` change:** add `--delete-branch` flag to the `gh pr merge` call so the remote branch is deleted atomically at merge time.

## Implementation Steps

### Step 1 — Add `--delete-branch` to `cmd_pr_merge`

In `auto-fix-all/scripts/github.sh`, inside `cmd_pr_merge()`, find the line:

```bash
gh pr merge "$number" -R "$repo_ref" --squash --subject "${title} (#${number})" --body "" >/dev/null || {
```

Add `--delete-branch` to the flags:

```bash
gh pr merge "$number" -R "$repo_ref" --squash --delete-branch --subject "${title} (#${number})" --body "" >/dev/null || {
```

### Step 2 — Add `cmd_cleanup_branch` function

Add a new function to `auto-fix-all/scripts/github.sh` that implements the three-step local cleanup:

```bash
cmd_cleanup_branch() {
  local branch="${1:-}"
  [[ -n "$branch" ]] || {
    echo "Usage: $0 cleanup-branch <branch>" >&2
    exit 1
  }

  # Delete remote branch — tolerate "not found" (may already be gone)
  git push origin --delete "$branch" 2>/dev/null || true

  # Switch back to main and reset to origin
  git checkout main
  git reset --hard origin/main

  # Delete local branch
  git branch -D "$branch"
}
```

### Step 3 — Wire `cleanup-branch` into the dispatch table

In the `case` block at the bottom of `auto-fix-all/scripts/github.sh`:

- Add `cleanup-branch) shift; cmd_cleanup_branch "$@" ;;` to the case arms.
- Update the usage/help echo block to document the new command.
- Update the comment header at the top of the file to list `cleanup-branch`.

## Files to Change

- `auto-fix-all/scripts/github.sh` — add `--delete-branch` to `cmd_pr_merge`, add `cmd_cleanup_branch`, wire dispatch and help.

## Notes

- The `|| true` on `git push origin --delete` is intentional — if GitHub's auto-delete already removed the branch, the push would fail with a "remote ref does not exist" error, which is harmless.
- `git reset --hard origin/main` requires that `origin/main` exists as a remote-tracking ref; `checkout_from_main.sh` already fetches it before every run, so this is safe in practice.

# Push Sub-Issues to GitHub and Finish

On confirmation from [split.md](split.md), push every generated sub-issue file to GitHub:

```bash
../scripts/push_sub_issues.sh "$REPO_PATH" <id>
```

> Resolve `../scripts/push_sub_issues.sh` relative to this file's directory. Iterates every `docs/agents/issues/<id>_*` file in ascending count order, creating each as a real GitHub issue linked to the parent via GitHub's native sub-issue relationship, and tracking each new id in `.claude/state/issue-<id>.json["sub-issues"]`.

## Interpret the output

### STATUS=ok

Every sub-issue was created successfully (`CREATED` lists `<file>:<new_id>` pairs). Run the finishing step:

```bash
../scripts/finish.sh "$REPO_PATH" <id>
```

> Resolve `../scripts/finish.sh` relative to this file's directory. Relabels the parent issue (`Planning` → `Split`; it stays open as a tracking issue) and deletes the local working files — the parent's own draft and every generated sub-issue file, none of which were ever committed.

Tell the user the split is complete: parent issue `#<id>` is now labeled `Split`, and list each new sub-issue's number and title.

### STATUS=failed

Report clearly, from `CREATED` and `FAILED`:
- Which sub-issues were created successfully (file + new issue number).
- Which sub-issue file failed after exhausting its retry budget.

Tell the user to double-check GitHub directly first — the failure could be a false negative (e.g. the issue was actually created but a later step in that same attempt errored) — before deciding how to proceed. The parent issue stays labeled `Planning` (the finishing step, which would relabel it to `Split`, does not run in this case). Wait for the user's instruction (retry the failed file, skip it, etc.) and act on it by calling the single-file script directly for just that file:

```bash
../scripts/create_sub_issue.sh "$REPO_PATH" <id> <the failed file>
```

Never re-run `push_sub_issues.sh` to recover from a partial failure — that would risk recreating sub-issues that already succeeded. Once every remaining file succeeds, run the finishing step above (`finish.sh`).

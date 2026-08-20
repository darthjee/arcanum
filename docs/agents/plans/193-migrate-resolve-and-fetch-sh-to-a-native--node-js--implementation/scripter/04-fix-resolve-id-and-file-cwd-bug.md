# Fix resolve_id_and_file.sh's cwd bug

`resolve_id_and_file.sh` resolves `ISSUES_FOLDER` against the ambient shell cwd instead of the target repo path — a gap left over by #208/PR #219, which fixed the same bug class in `github_issue.sh`/`issue_state.sh`/`list_agents.sh` but didn't touch this script. Since Step 01 removes `resolve_and_fetch.sh`'s dependency on this script, the bug is no longer a parity concern for this issue — but it still affects this script's one remaining caller, `auto-new-issue`.

Fix it the same way #208/PR #219 fixed the others: accept `repo_path` as a required leading positional argument (this script currently doesn't take one at all) and call `repo_path_enter "$repo_path"` before touching any path, per [repo-path-threading.md](../../architecture/repo-path-threading.md). Update the one call site accordingly.

## Files to Change

- `arcanum/_lib/resolve_id_and_file.sh` — add the leading `repo_path` argument and `repo_path_enter` call.
- `auto-new-issue/scripts/resolve_id_and_file.sh` — thin wrapper, no signature change needed (it already just forwards `"$@"`), but confirm this after the change.
- `auto-new-issue/steps/run.md` — update the documented call to pass `"$REPO_PATH"` as the new leading argument.

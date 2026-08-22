# Create the native module

Create `core/lib/ArcanumSplitIssueCreateSubIssue.js`, the native counterpart of `arcanum-split-issue/scripts/create_sub_issue.sh`. Zero runtime dependencies — built-in Node APIs only, matching every other migrated module.

Follow the constructor-injection pattern used by `core/lib/ArcanumSplitIssueFinish.js` and `core/lib/SpawnIssue.js` (a `deps` object defaulting each collaborator to `new <Class>()`, stored on `this._<name>` for test overridability):

- `repoPath` (`RepoPath`) — validate `repoPath` the same way every migrated entrypoint does (`repoPath.validate`, matching `repo_path_enter`'s messages/exit-1 semantics).
- `spawnIssue` (`SpawnIssue`) — call `.run(repoPath, issueId, title, bodyFile, '--as-subissue')` in-process instead of shelling out to `arcanum/_lib/spawn_issue.sh`.
- `issueState` (`IssueState`) — call `.appendJson(repoPath, issueId, 'sub-issues', JSON.stringify(newId))` (or `.run(repoPath, 'append-json', issueId, 'sub-issues', ...)`) in-process instead of shelling out to `arcanum/_lib/issue_state.sh`.
- A file-reading collaborator (e.g. injectable `readFile`) to parse the sub-issue draft file.

`run(repoPath, issueId, subIssueFile)` behavior, mirroring the shell script line for line:

1. Validate all three arguments are present (usage message on missing/empty argument, thrown as a plain `Error` so `core/bin/arcanum` exits 1 with the message on stderr).
2. `repoPath.validate(repoPath)`.
3. Read `subIssueFile`; throw `Error('Error: file not found: <path>')` if it doesn't exist (matching the shell script's own check) — do not let a raw ENOENT propagate.
4. Parse title = first line with a leading `# ` stripped; body = everything after the first blank line (mirrors the shell's `sed`/`awk` parsing).
5. Derive the count-segment for the log line the same way the shell script does: `basename(subIssueFile)`, strip the `<issueId>_` prefix, take everything before the next `_`; fall back to `?` if what remains isn't purely numeric.
6. Write `Creating sub-issue <count> for issue #<issueId>: <title>\n` — this line must appear in the returned/printed output, matching the shell script's `echo` before it calls `spawn_issue.sh`.
7. Call `spawnIssue.run(repoPath, issueId, title, bodyFile, '--as-subissue')` (the draft body, not the original `subIssueFile`, needs writing to a temp file first — mirror the shell script's `mktemp` + `printf '%s\n' "$BODY" > tmp` step, since `SpawnIssue#run` takes a `bodyFile` path, not a string).
   - On success, extract `ID` from its `STATUS=ok\nID=...\nURL=...\n` return value.
   - On `DispatchFailure`, propagate it as this module's own `DispatchFailure('STATUS=failed\n')` (prefixed with whatever progress lines were already produced, matching the shell script's behavior of printing `$SPAWN_OUTPUT` then `STATUS=failed` before exiting 1).
8. On success, call `issueState.appendJson(repoPath, issueId, 'sub-issues', JSON.stringify(newId))` (append happens "regardless of linking outcome," matching the shell script's comment — i.e. run this even though `spawnIssue.run`'s own internal linking step is already best-effort/non-throwing).
9. Return `<progress-line>STATUS=ok\nID=<new_id>\n`.
10. Clean up the temp body file in a `finally` (mirroring the shell script's `trap 'rm -f "$TMP_BODY_FILE"' EXIT`).

## Files to Change

- `core/lib/ArcanumSplitIssueCreateSubIssue.js` — new native implementation.

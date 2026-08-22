# Split into engine_dispatch shim + shell impl

Rename the current `arcanum-split-issue/scripts/push_sub_issues.sh` to `push_sub_issues_shell.sh` unchanged (it keeps calling `create_sub_issue.sh`, which is itself already an `engine_dispatch` shim — no change needed there), then write a new, thin `push_sub_issues.sh` that only sources `arcanum/_lib/engine_dispatch.sh` and dispatches. Follow `arcanum-split-issue/scripts/create_sub_issue.sh` (the shim from #259) and `auto-fix-all/scripts/checkout_from_main.sh` (the shim from #258) as the two closest precedents for shape and header-comment style.

Even though `push_sub_issues_shell.sh` itself is filesystem/git-only and needs no extra environment, the shim's `engine_dispatch` call must still forward `HOME` — because step 02's native module calls `ArcanumSplitIssueCreateSubIssue` (whose own call chain reaches `SpawnIssue` → `gh auth token`) directly in-process rather than shelling out, the **native** side of this dispatch needs `HOME` even though the shell side doesn't. Mirror `create_sub_issue.sh`'s shim line: `engine_dispatch "$REPO_PATH" arcanum-split-issue-push-sub-issues "${SCRIPT_DIR}/push_sub_issues_shell.sh" HOME -- "$@"`.

Register the command in `core/bin/arcanum`'s `COMMANDS` map:

```js
'arcanum-split-issue-push-sub-issues': { module: 'ArcanumSplitIssuePushSubIssues.js', method: 'run' },
```

And flip the status flag in `arcanum/_lib/migration-status.json`:

```diff
-  "arcanum-split-issue-push-sub-issues": false,
+  "arcanum-split-issue-push-sub-issues": true,
```

## Files to Change

- `arcanum-split-issue/scripts/push_sub_issues_shell.sh` — new file, exact content of today's `push_sub_issues.sh` (`git mv` then restore the header comment referencing the new shim, same as `create_sub_issue_shell.sh`/`checkout_from_main_shell.sh` did).
- `arcanum-split-issue/scripts/push_sub_issues.sh` — replaced with the thin `engine_dispatch` shim.
- `core/bin/arcanum` — add the `arcanum-split-issue-push-sub-issues` entry to `COMMANDS`.
- `arcanum/_lib/migration-status.json` — flip `arcanum-split-issue-push-sub-issues` to `true`.

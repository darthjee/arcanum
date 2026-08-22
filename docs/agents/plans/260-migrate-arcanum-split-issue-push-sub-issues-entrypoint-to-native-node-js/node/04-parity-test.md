# Parity test

Write `core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js`, following `core/spec/bin/arcanumSplitIssueCreateSubIssueParity_spec.js`'s structure: run `arcanum-split-issue/scripts/push_sub_issues_shell.sh` directly (NOT through the `push_sub_issues.sh` engine_dispatch shim, so the test isn't circular) and `core/bin/arcanum arcanum-split-issue-push-sub-issues` against an identical fixture repo/issues directory, asserting byte-identical stdout and exit code.

Per that same spec's precedent, the real-GitHub-network happy path (actually creating sub-issues) is out of scope for this parity test — it can't be exercised offline any more than `create_sub_issue`'s own parity test can, since both engines ultimately bottom out at `create_sub_issue_shell.sh` → `spawn_issue.sh` → real `curl`/`gh` calls. Cover instead, offline and deterministically:

- **Zero matching files** — both engines print `STATUS=ok`/`CREATED=` for an empty (or non-matching-only) issues directory.
- **Failure path** — force `create_sub_issue.sh` (shared by both engines, since neither driver's own contract touches GitHub without it) to fail deterministically the same way `arcanumSplitIssueCreateSubIssueParity_spec.js` does (`.claude/state/arcanum-config.json`'s `plan-issues.max-retry-count` set to `0`), with 2+ matching sub-issue files present so the "stops at first failure" contract is actually exercised — assert both engines print identical `STATUS=failed`/`CREATED=`/`FAILED=<file>` and exit 1, and that `CREATED=` is empty in both (since the very first `create_sub_issue` call fails under this forced condition).

The happy multi-file success path (ascending-order dispatch, `CREATED=` accumulation) is instead covered by `ArcanumSplitIssuePushSubIssues_spec.js`'s fake-injected unit tests (node/03) — same division of coverage the create-sub-issue pair already uses.

## Files to Change

- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity_spec.js` — new parity test file.

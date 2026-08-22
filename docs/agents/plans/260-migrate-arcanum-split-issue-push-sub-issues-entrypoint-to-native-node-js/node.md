# Node Plan: Migrate arcanum-split-issue-push-sub-issues entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Steps

- [01 — Split into engine_dispatch shim + shell impl](node/01-add-dispatch-shim.md)
- [02 — Native module ArcanumSplitIssuePushSubIssues](node/02-implement-native-module.md)
- [03 — Unit tests](node/03-unit-tests.md)
- [04 — Parity test](node/04-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- This entrypoint's blocker, `arcanum-split-issue-create-sub-issue` (#259), is already merged: `core/lib/ArcanumSplitIssueCreateSubIssue.js` exists and `arcanum-split-issue-create-sub-issue: true` in `arcanum/_lib/migration-status.json`.
- Reference implementations for this exact shape (rename-to-`_shell.sh` + thin `engine_dispatch` shim, in-batch call to another already-migrated module) already exist in this repo: `arcanum-split-issue/scripts/create_sub_issue.sh`/`create_sub_issue_shell.sh` + `core/lib/ArcanumSplitIssueCreateSubIssue.js` (#259), and `auto-fix-all/scripts/checkout_from_main.sh`/`checkout_from_main_shell.sh` + `core/lib/AutoFixAllCheckoutFromMain.js` (#258, PR #271). Mirror their conventions rather than inventing new ones.
- The shell driver's own file-scan glob (`${ISSUE_ID}_[0-9][0-9]*_*` under `docs/agents/issues/`, lexicographically sorted) matches the `<issueId>_<NN>_<slug>.md` naming convention `core/lib/ArcanumSplitIssueCreateSubIssueFile.js` already produces (2-digit zero-padded count) — the native module must replicate this exact glob/sort behavior via `node:fs`, not assume a different naming shape.

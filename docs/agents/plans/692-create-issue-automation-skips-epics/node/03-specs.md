# Specs

- **`has-label` parity**: rename `core/spec/bin/autoFixAllGithubParity/has_shipit_label_spec.js` to `has_label_spec.js`. Cover `github_shell.sh has-label` against `core/bin/arcanum auto-fix-all-github-has-label` for: label present in another case (exit 0), label absent (exit 1), label fetch failure (exit 1), missing `<name>` (usage, exit 1), and invalid repo path. Keep one case for the `has-shipit-label` alias: `github_shell.sh has-shipit-label` and `github.sh has-shipit-label` (through engine dispatch) both exit 0 on a `ShipIt` label and 1 without it. Update `engine_dispatch_spec.js` and `fakeGhBin.js`/`fakeGithubApiFetchPreload.js` comments and modes that name `has-shipit-label`.
- **Unit**: rewrite `AutoFixAllGithubLabels_spec.js` for `#hasLabel` (usage errors, match, case-insensitive match, no match, fetch failure). Update `core/spec/lib/core/commands_spec.js` for the key swap.
- **`monitor-issues`**: in `MonitorIssuesMonitorIssuesDispatch_spec.js` (unit) and `core/spec/bin/monitorIssuesMonitorIssuesParity/monitor_issues_spec.js` (parity), check that `Ready for Work` + `Epic` is not pushed to the auto-fix-all queue, that `Created` + `Epic` is not pushed to the rewrite queue, that both log `Skipping #N: Epic`, and that `updated_at`/`tags` are still recorded. The non-Epic cases stay unchanged.

## Files to Change
- `core/spec/bin/autoFixAllGithubParity/has_shipit_label_spec.js` → `has_label_spec.js`.
- `core/spec/bin/autoFixAllGithubParity/engine_dispatch_spec.js` — subcommand list.
- `core/spec/support/utils/fakeGhBin.js`, `core/spec/support/utils/fakeGithubApiFetchPreload.js` — comments and modes, if needed.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllGithubLabels_spec.js` — `#hasLabel`.
- `core/spec/lib/core/commands_spec.js` — key swap.
- `core/spec/lib/commands/monitor-issues/MonitorIssuesMonitorIssuesDispatch_spec.js` — Epic cases.
- `core/spec/bin/monitorIssuesMonitorIssuesParity/monitor_issues_spec.js` — Epic parity cases.

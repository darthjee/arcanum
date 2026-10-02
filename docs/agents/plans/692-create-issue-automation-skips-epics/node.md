# Node Plan: Create-issue: automation skips Epics

Main plan: [plan.md](plan.md)

## Shared contracts

- Produce the native half of `auto-fix-all-github-has-label`: `AutoFixAllGithub#hasLabel(id, name)`, with the same exit/usage contract as the shell side (see [plan.md](plan.md#has-label-cli)). There is no native `has-shipit-label`: the alias lives in `github.sh` only.
- Produce the native half of the `monitor-issues` Epic skip (see [plan.md](plan.md#monitor-issues-epic-skip)). Log line: `Skipping #<id>: Epic`.
- Relies on scripter: `migration-status.json` key `auto-fix-all-github-has-label: true` and wrapper `auto-fix-all/scripts/github_shell_has_label.sh`. `github_shell.sh has-label` / `has-shipit-label` stay callable directly for the parity specs.

## Steps

- [01 — Native `has-label` command](node/01-native-has-label.md)
- [02 — Native `monitor-issues` Epic skip](node/02-monitor-issues-epic-skip.md)
- [03 — Specs](node/03-specs.md)

## CI Checks

- `core/`: `make core-check` (ESLint + Jasmine), plus jscpd and the c8 coverage threshold.

## Notes

- Leave `IssueLabels.hasShipit` (arcanum-create-issue) alone. It works on a label list and is unrelated.

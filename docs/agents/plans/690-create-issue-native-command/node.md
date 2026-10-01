# Node Plan: Create-issue: native command

Main plan: [plan.md](plan.md)

## Shared contracts

- Registry entries, exit codes, output keys and label colors: see [plan.md](plan.md#shared-contracts).
- The shims `arcanum-create-issue/scripts/start.sh` and `publish.sh` are written by `scripter`;
  the bin-level routing spec runs them end to end.
- Full behavior: [`docs/agents/specs/arcanum-create-issue.md`](../../specs/arcanum-create-issue.md)
  sections "Draft file", "Native commands", "Label rules", "Prompts" (1, 5, 6), "Edge cases".

## Steps

- [01 — IssueClient labels argument](node/01-issue-client-labels.md)
- [02 — `arcanum-create-issue-start` command](node/02-start-command.md)
- [03 — `arcanum-create-issue-publish` command](node/03-publish-command.md)
- [04 — Register commands and bin routing spec](node/04-register-and-bin-spec.md)

## CI Checks

- `core/`: `make core-check` (lint + tests), jscpd clean, c8 coverage at the repo threshold.

## Notes

- `GithubIssueService.create` writes the body to `docs/agents/issues/`; the create-issue flow
  must NOT do that (the skill never touches git, and the next skill fetches from GitHub). Reuse
  its origin/client wiring but add a path (option or sibling method) that creates with labels
  and returns the issue without writing a local file.
- `/dev/tty` prompts: open `/dev/tty` directly for read/write; if it cannot be opened, emit
  `FALLBACK=chat` and exit `4`. Keep the TTY access behind an injectable collaborator so specs
  never touch a real TTY.
- No automatic retry on the create request.

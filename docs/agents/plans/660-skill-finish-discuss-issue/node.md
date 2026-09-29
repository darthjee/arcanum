# Node Plan: Skill finish: discuss-issue

Main plan: [plan.md](plan.md)

## Shared contracts

You produce the native `finish-report` command. Its stdout and exit code must be byte-identical to scripter's `arcanum/_lib/finish_report_shell.sh`, per the CLI, report format, `--nested` block, `--merge` rules, label mapping (`TAG_TO_LABEL`), `ssh.github.com` → `github.com` web-domain mapping, and usage-error behavior in [plan.md](plan.md#shared-contracts). `next_step_prompt.sh` is out of your scope (it is plain bash and not dispatched).

## Implementation Steps

### Step 1 — Native `finish-report` command

- Add `core/lib/commands/shared/FinishReport.js`, a class taking `repoContext` with an async `run(...args)`.
- Parse the flag list the same way the shell script does. Resolve the domain and repo through `core/lib/utils/git/Origin.js` only when URLs are needed. Map labels through `TAG_TO_LABEL`.
- Write the report or `--nested` block to stdout. Throw a usage `Error` (stderr, exit 1, empty stdout) on any invalid input, following how existing commands surface usage errors through the dispatcher.
- Register `'finish-report': { module: 'commands/shared/FinishReport.js', method: 'run', context: 'repo' }` in `core/lib/core/commands.js` (keep alphabetical placement and update the JSDoc list of `'repo'` commands).
- Add a unit spec `core/spec/lib/commands/shared/FinishReport_spec.js` covering:
  - each status
  - optional lines present and absent
  - repeatable flags keep their order
  - add and remove label changes (`(none)`)
  - `ssh.github.com` mapping
  - `--nested` output
  - merge filling, appending and dedup
  - the nested-failed usage error
  - every usage error

### Step 2 — Parity spec and migration flip

- Add `core/spec/bin/finishReportParity_spec.js`, modeled on `discussIssueConfirmParity_spec.js` but with a temp git repo whose `origin` is set, as the repo-context parity specs do. It runs `arcanum/_lib/finish_report_shell.sh` directly (not via the shim) and `core/bin/arcanum finish-report`, and asserts identical stdout and exit code for the success, declined and failed cases, `--nested`, `--merge`, and usage errors.
- Set `"finish-report": true` in `arcanum/_lib/migration-status.json`.
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` with `scripts/generate_entrypoint_migration_status.sh`.

## Files to Change
- `core/lib/commands/shared/FinishReport.js`: new native command
- `core/lib/core/commands.js`: register `finish-report`
- `core/spec/lib/commands/shared/FinishReport_spec.js`: new unit spec
- `core/spec/bin/finishReportParity_spec.js`: new shell-vs-native parity spec
- `arcanum/_lib/migration-status.json`: `"finish-report": true`
- `docs/agents/architecture/entrypoint-migration-status.md`: regenerated

## CI Checks
- `core`: `cd core && yarn test` (CI job: tests)
- `core`: `cd core && yarn lint` (CI job: checks)

## Notes
- The parity spec depends on scripter's `finish_report_shell.sh`. If you run before it lands, coordinate with the contract in plan.md rather than guessing.

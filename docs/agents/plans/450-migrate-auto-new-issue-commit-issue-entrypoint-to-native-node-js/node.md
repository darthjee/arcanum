# Node Plan: Migrate auto-new-issue-commit-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Command key `auto-new-issue-commit-issue`, native module
  `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js` (method `run`,
  `context: 'repo'`), registered in `core/lib/core/commands.js`'s `COMMANDS` map
  between `auto-monitor-pr-monitor-pr` and `auto-plan-issue-commit-plan`
  (alphabetical order).
- CLI contract: `commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>`
  — usage error (exit 1) on any missing argument; `Error: file not found:
  <file_path>` (exit 1) when `<file_path>` doesn't exist; on success, `git
  commit`'s stdout followed by `git push -u`'s stdout, concatenated, exit 0.
- `scripter` (see [scripter.md](scripter.md)) owns the shim/shell split that the
  parity test in step 4 below exercises — write and land steps 1-3 first; the
  parity spec itself only needs to actually pass once the shim exists.

## Steps

- [01 — Create the native module](node/01-create-module.md)
- [02 — Register the command and flip migration status](node/02-register-command.md)
- [03 — Write native unit tests](node/03-unit-tests.md)
- [04 — Write the shell/native parity test](node/04-parity-test.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes

- `AutoPlanIssueCommitPlan.js` (`core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js`)
  is the closest precedent for shape — same commit-template/agent-email
  resolution, same `git commit -F -` / push pattern, same `defaultExecFileAsync`
  stdin-capable helper. The main differences here: staging a single file (already
  staged by the caller in the analogous `AutoFixIssueCommitChange.js` shape —
  confirm from `commit_issue.sh` whether staging happens inside `run` or is the
  caller's job; the existing shell script itself runs `git add <file_path>`
  inside `commit_issue.sh`, so the native module should stage it too, mirroring
  `AutoPlanIssueCommitPlan.js`'s `git add planDir` rather than
  `AutoFixIssueCommitChange.js`'s caller-stages contract) and validating a file
  (not a directory) exists before staging.
- The commit message shape has no `body`/`commentUrl` optional trailers (unlike
  `AutoFixIssueCommitChange.js`) and no caller-supplied `agent` (unlike it too)
  — the agent is always the fixed literal `"architect"`, matching
  `AutoPlanIssueCommitPlan.js`'s `AGENT` constant exactly.
- `defaultExecFileAsync`'s stdin-capable `execFile` wrapper is duplicated in
  both `AutoFixIssueCommitChange.js` and `AutoPlanIssueCommitPlan.js` (not
  shared, per `script-engine.md`'s "no standalone, wholesale `_lib` migration"
  rule for now) — copy it again here rather than extracting a shared helper.

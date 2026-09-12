# node Plan: Migrate auto-plan-issue-commit-plan entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- Must implement the exact same behavior as `commit_plan_shell.sh` (produced by `scripter`, see [scripter.md](scripter.md)): `git add <plan_dir>` itself, commit-template-aware `"architect"` agent-email resolution, the fixed commit message/trailers shape, `git commit -F -`, then push, relaying both commands' stdout verbatim and concatenated.
- Must register under the exact key `auto-plan-issue-commit-plan` in `core/lib/core/commands.js`'s `COMMANDS` map — this key must match the `engine_dispatch` dispatch key and `migration-status.json` flag name `scripter` uses.

## Implementation Steps

### Step 1 — Implement and register the native command

Create `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js` (zero runtime deps, built-in Node APIs only), using `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` as the direct precedent for shape and helpers:

- Reuse `core/lib/utils/file/RepoPath.js` for path validation/entry (rather than re-deriving `repo_path.sh`'s behavior by hand) — this script errors on a missing/empty `repo_path`.
- Validate `plan_dir` exists on disk; error `Error: directory not found: <plan_dir>` (matching `commit_plan.sh`'s own message) if not.
- `git add <plan_dir>` itself before building the commit message — this command does its own staging, unlike `AutoFixIssueCommitChange`'s caller-stages-first contract.
- Re-derive `_commitTemplateEngineGet`, `_agentEmailGet`, `_modelCoauthorOmitted` the same way `AutoFixIssueCommitChange.js` does (via `ConfigChain`), but call `_agentEmailGet` with the agent hardcoded to the literal string `"architect"` (never a caller-supplied parameter — `commit_plan.sh` has no `<agent>` argument at all).
- Build the commit message: `docs(plan): add implementation plan (issue #<id>)`, then (unless `omit_model_coauthor`) the model's own `Co-Authored-By` trailer, then the fixed `Co-Authored-By: architect agent <agent_email>` trailer.
- Reuse `defaultExecFileAsync` (copy the same stdin-capable `execFile` wrapper `AutoFixIssueCommitChange.js` uses, per the script-engine's "no standalone, wholesale `_lib` migration" rule — it isn't shared/exported yet) for `git commit -F -`, and the same `_pushCurrentBranch` pattern for `git push -u origin <branch>:<branch>`.
- Return the concatenation of `git commit`'s stdout and `git push`'s stdout, in that order — matching the shell script's unredirected stdout.

Register the command in `core/lib/core/commands.js`'s `COMMANDS` map:

```js
'auto-plan-issue-commit-plan': {
  module: 'commands/auto-plan-issue/AutoPlanIssueCommitPlan.js',
  method: 'run',
  context: 'repo'
},
```

### Step 2 — Native unit tests and shell/native parity test

Write `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`, covering:

- Missing/empty `repo_path`, `plan_dir`, `id`, `model_name`, or `model_email` — usage error.
- Missing `plan_dir` on disk — `Error: directory not found: <plan_dir>`.
- Both commit-template shapes (`"new"` → agent email resolved via config chain with `<model_email>` fallback; `"old"`/absent → `<model_email>` used directly).
- `omit_model_coauthor` set vs. unset — presence/absence of the model's own `Co-Authored-By` trailer.
- The assembled commit message, and that `git add`, `git commit -F -`, and `git push -u origin <branch>:<branch>` are called with the expected arguments/stdin, in order.

Write `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js`, following `autoFixIssueCommitChangeParity_spec.js`'s approach for a git-mutating parity test: a temp repo fixture, real `git`, no network, asserting identical stdout and exit code between `commit_plan_shell.sh` and the native path (`engine.mode=native` via `core/bin/arcanum`) for the same inputs.

## Files to Change

- `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js` — new native command.
- `core/lib/core/commands.js` — register `auto-plan-issue-commit-plan`.
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js` — new unit tests.
- `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js` — new parity test.

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

## Notes

- Depends on `scripter`'s `commit_plan_shell.sh` extraction landing with byte-identical behavior to today's `commit_plan.sh` — the parity test compares against it directly.

# Migrate auto-plan-issue-commit-plan entrypoint to native Node.js

## Context

Sub-issue of #446 (batch overview), part of the `auto-plan-issue` family of entrypoint migrations described in `docs/agents/architecture/script-engine.md`. The target script, `auto-plan-issue/scripts/commit_plan.sh` (50 lines), commits the implementation plan directory created by the `auto-plan-issue` skill and pushes it, but has not yet been migrated to a native Node.js implementation under the Script Engine.

`commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>` currently:

- Enters `<repo_path>` (`repo_path_enter`) and errors if `<plan_dir>` doesn't exist.
- Runs `git add <plan_dir>`.
- Resolves the commit-author email: when `commit_template_engine_get` reports `"new"`, resolves the `"architect"` agent's email via `agent_email_get` (config-chain lookup, falling back to `<model_email>`); otherwise uses `<model_email>` directly (legacy template).
- Builds the commit message `docs(plan): add implementation plan (issue #<id>)`, followed by a blank line, the model's own `Co-Authored-By` trailer (unless `omit_model_coauthor` is set), and a fixed `Co-Authored-By: architect agent <agent_email>` trailer — the agent is always `"architect"` for this script, never caller-supplied.
- Runs `git commit -F -` with that message, then `push_current_branch` (`git push -u origin <branch>:<branch>`).
- Relays both `git commit`'s and `git push`'s own stdout verbatim.

## What needs to be done

Follow `docs/agents/architecture/script-engine.md`. `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` (migrated in #427's batch) is the closest precedent — same git-add / template-detection / agent-email-resolution / co-author-trailer / commit / push shape, just with the agent fixed to `"architect"` instead of caller-supplied, and this script does its own `git add` (unlike `commit_change.sh`, whose caller stages beforehand).

- Read `auto-plan-issue/scripts/commit_plan.sh` in full for its exact contract, and `AutoFixIssueCommitChange.js` for the native pattern to reuse (its `_commitTemplateEngineGet`/`_agentEmailGet`/`_modelCoauthorOmitted` re-derivations of `commit_template.sh`/`agent_email.sh`, and its `defaultExecFileAsync` stdin-capable `execFile` wrapper for `git commit -F -`).
- Create `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js` (zero runtime deps, built-in Node APIs only), reusing `core/lib/utils/file/RepoPath.js` for path validation/entry rather than re-deriving `repo_path.sh`.
- Register the command in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-plan-issue-commit-plan': { module: 'commands/auto-plan-issue/AutoPlanIssueCommitPlan.js', method: 'run', context: 'repo' }`.
- Add `"auto-plan-issue-commit-plan": true` to `arcanum/_lib/migration-status.json`.
- Write native unit tests in `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`, covering: missing `plan_dir`, both commit-template shapes (new/old), `omit_model_coauthor` set/unset, and the assembled commit message/`git add`/`git push` call sequence.
- Write a parity test at `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js` (shell vs. native, identical stdout/exit code), following `autoFixIssueCommitChangeParity_spec.js`'s approach for a git-mutating parity test (temp repo fixture, real `git`, no network).
- Extract the current logic to `auto-plan-issue/scripts/commit_plan_shell.sh`, replace `auto-plan-issue/scripts/commit_plan.sh` with a thin `engine_dispatch.sh` shim, and verify it routes correctly for both `engine.mode=native` and `engine.mode=shell`.

Dependencies and external calls:

- `git add`, `git commit -F -`, `git push -u origin <branch>:<branch>` — real git mutation, no GitHub API calls.
- Sources `arcanum/_lib/push.sh`, `repo_path.sh`, `commit_template.sh`, and `agent_email.sh` (→ `config_chain.sh`) in shell form. Per the script-engine's "no standalone, wholesale `_lib` migration" rule, inline the needed logic natively rather than importing a shared migrated `_lib` module — reuse `core/lib/utils/config/ConfigChain.js` (already the native counterpart of `config_chain_read`, used as-is by `AutoFixIssueCommitChange.js`) for the agent-email config lookup.
- No dependencies on other sub-issues in this batch — independent of `discuss-issue-confirm`, `discuss-issue-render-issue`, and `auto-new-issue-commit-issue`. Shares its "commit + push" shape with `auto-new-issue-commit-issue` (near-identical script) but neither depends on the other.

## Acceptance criteria

- [ ] `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js` implements the same contract as `commit_plan.sh` (git add, commit-template-aware agent-email resolution, commit message/trailers, commit, push, relayed stdout).
- [ ] The command is registered in `core/lib/core/commands.js` as `auto-plan-issue-commit-plan` and enabled via `"auto-plan-issue-commit-plan": true` in `arcanum/_lib/migration-status.json`.
- [ ] Native unit tests exist in `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js` covering missing `plan_dir`, both commit-template shapes, and `omit_model_coauthor` on/off.
- [ ] A shell-vs-native parity test exists at `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js` with identical stdout/exit code between implementations.
- [ ] `auto-plan-issue/scripts/commit_plan.sh` is a thin `engine_dispatch.sh` shim over the extracted `commit_plan_shell.sh`, routing correctly for both `engine.mode=native` and `engine.mode=shell`.

## Description

Sub-issue of #446 (batch overview). Part of the `auto-new-issue` family — migrating `auto-new-issue/scripts/commit_issue.sh` (49 lines) to a native Node.js implementation, per the [Script Engine migration](docs/agents/architecture/script-engine.md).

### Source script

`auto-new-issue/scripts/commit_issue.sh` — commits an issue file created by the `auto-new-issue` skill, then pushes. Usage: `commit_issue.sh <repo_path> <file_path> <id> <model_name> <model_email>`.

- Enters `<repo_path>` (`repo_path_enter`), errors if `<file_path>` doesn't exist.
- `git add <file_path>`.
- Same commit-template-engine-driven agent-email resolution as `commit_plan.sh`, agent fixed to `"architect"`.
- Builds the commit message: `docs(issue): add issue file (issue #<id>)`, blank line, the model's own `Co-Authored-By` trailer (unless `omit_model_coauthor` is set), then `Co-Authored-By: architect agent <agent_email>`.
- `git commit -F -`, then `push_current_branch`.
- Relays both `git commit` and `git push`'s own stdout verbatim.

This script is structurally near-identical to `auto-plan-issue/scripts/commit_plan.sh` (sub-issue for that script is also in this batch) — the only differences are the commit `type(scope)` (`docs(issue)` vs `docs(plan)`), the subject text, and committing a single file vs. a directory.

## Solution

Follow `docs/agents/architecture/script-engine.md`. `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` (migrated in #427's batch) is the closest precedent — see the `auto-plan-issue-commit-plan` sub-issue for the detailed shape shared with this script.

1. Read `auto-new-issue/scripts/commit_issue.sh` in full for its exact contract.
2. Create `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js` (zero runtime deps, built-in Node APIs only). Reuse `core/lib/utils/file/RepoPath.js` for path validation/entry.
3. Register in `core/lib/core/commands.js`'s `COMMANDS` map: `'auto-new-issue-commit-issue': { module: 'commands/auto-new-issue/AutoNewIssueCommitIssue.js', method: 'run', context: 'repo' }`.
4. Add `"auto-new-issue-commit-issue": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js`, covering: missing `file_path`, both commit-template shapes, `omit_model_coauthor` set/unset, and the assembled commit message/`git add`/`git push` call sequence.
6. Write a parity test at `core/spec/bin/autoNewIssueCommitIssueParity_spec.js` (shell vs. native, identical stdout/exit code).
7. Extract the current logic to `auto-new-issue/scripts/commit_issue_shell.sh`, replace `auto-new-issue/scripts/commit_issue.sh` with a thin `engine_dispatch.sh` shim, and verify it routes correctly for `engine.mode=native` and `engine.mode=shell`.

### External dependencies

Same as `auto-plan-issue-commit-plan`: `git add`/`commit -F -`/`push -u`, and the same `push.sh`/`repo_path.sh`/`commit_template.sh`/`agent_email.sh` shell helpers to inline natively (reuse `core/lib/utils/config/ConfigChain.js` for the agent-email lookup).

### Dependencies on other sub-issues

None in this batch — independent of `discuss-issue-confirm`, `discuss-issue-render-issue`, and `auto-plan-issue-commit-plan`. If `auto-plan-issue-commit-plan` is implemented first, its native module may be worth glancing at for consistency (same shape, different commit type/subject), but there's no hard ordering dependency — both can proceed in parallel.

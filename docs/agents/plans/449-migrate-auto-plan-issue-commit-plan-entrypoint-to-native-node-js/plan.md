# Plan: Migrate auto-plan-issue-commit-plan entrypoint to native Node.js

Issue: [449-migrate-auto-plan-issue-commit-plan-entrypoint-to-native-node-js.md](../issues/449-migrate-auto-plan-issue-commit-plan-entrypoint-to-native-node-js.md)

## Overview

Migrate `auto-plan-issue/scripts/commit_plan.sh` to a native Node.js command under the Script Engine, following the same shape already established by `AutoFixIssueCommitChange.js` (commit-template-aware agent-email resolution, commit message/trailers, commit, push). The `node` agent implements the native command, registers it, and writes native unit + parity tests; the `scripter` agent extracts the existing shell logic into `commit_plan_shell.sh` and reduces `commit_plan.sh` to a thin `engine_dispatch.sh` shim, flipping the migration-status flag once both sides are in place.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **CLI contract** (unchanged from today): `commit_plan.sh <repo_path> <plan_dir> <id> <model_name> <model_email>`. Errors with a usage message on any missing/empty argument, or `Error: directory not found: <plan_dir>` if `<plan_dir>` doesn't exist.
- **Behavior contract**, identical between `commit_plan_shell.sh` (scripter) and `AutoPlanIssueCommitPlan.js` (node):
  - Runs `git add <plan_dir>` itself (unlike `commit_change`, whose caller stages beforehand).
  - Resolves the commit-author email: when the repo's commit-template engine is `"new"` (`.github/commit_message_template-2.0.md` exists), resolves the `"architect"` agent's email via the 3-tier config chain (`git.agents.architect.email`), falling back to `<model_email>`; otherwise (`"old"` template, or neither file present defaults to `"new"`) uses `<model_email>` directly.
  - Commit message: `docs(plan): add implementation plan (issue #<id>)`, blank line, the model's own `Co-Authored-By: <model_name> <model_email>` trailer (omitted when `git.omit_model_coauthor` resolves truthy), then a fixed `Co-Authored-By: architect agent <agent_email>` trailer — the agent is always the literal string `"architect"`, never caller-supplied.
  - Runs `git commit -F -` with that message, then pushes the current branch with `git push -u origin <branch>:<branch>`.
  - Relays both `git commit`'s and `git push`'s own stdout verbatim, concatenated in that order.
- **Registration key**: the migrated entrypoint name is the literal string `auto-plan-issue-commit-plan` — used identically as the `engine_dispatch` dispatch key (scripter, in the `commit_plan.sh` shim), the `arcanum/_lib/migration-status.json` flag name (scripter), and the `core/lib/core/commands.js` `COMMANDS` map key (node, module `commands/auto-plan-issue/AutoPlanIssueCommitPlan.js`, method `run`, context `repo`).

## CI Checks

- `core/`: `yarn test` (CI job: `test`)
- `core/`: `yarn lint` (CI job: `checks`)

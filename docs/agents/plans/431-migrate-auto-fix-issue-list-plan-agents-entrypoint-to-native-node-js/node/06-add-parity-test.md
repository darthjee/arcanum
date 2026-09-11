# Add shell/native parity test

Run `list_plan_agents_shell.sh` directly (not through the `list_plan_agents.sh` `engine_dispatch` shim) alongside `core/bin/arcanum auto-fix-issue-list-plan-agents` against equivalent fixture `plan_dir` inputs, asserting byte-identical stdout and exit code for at least:
- A plan dir with several agent `.md` files plus `plan.md`.
- A plan dir with only `plan.md` (no agent files).
- A plan dir that does not exist.

Follow the same fixture-repo/plan-dir parity-test structure already used for `auto-fix-issue-create-branch` (`core/spec/bin/autoFixIssueCreateBranchParity_spec.js`, #429) and `auto-fix-issue-commit-change` (#428).

## Files to Change
- `core/spec/bin/autoFixIssueListPlanAgentsParity_spec.js` — new file, shell/native parity coverage per the scenarios above (camelCase name + `Parity_spec.js` suffix, alongside the sibling specs in `core/spec/bin/`).

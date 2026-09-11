# Add shell/native parity test

Add a parity spec asserting byte-identical stdout and exit code between `list_plan_steps_shell.sh` (run directly, not through the `list_plan_steps.sh` engine_dispatch shim) and `core/bin/arcanum auto-fix-issue-list-plan-steps` against equivalent fixture plan-dir inputs. Mirror the existing parity-test pattern used for the other migrated `auto-fix-issue-*` entrypoints (e.g. `autoFixIssueCreateBranchParity_spec.js` / the list-plan-agents parity spec, if one exists — otherwise `AutoFixIssueCreateBranch`'s is the closest template). Cover:

- An agent dir with several step `.md` files (ordering + full-path formatting match).
- An agent dir that doesn't exist under the plan dir (both exit 0 with empty stdout).
- An agent dir that exists but is empty.

## Files to Change
- `core/spec/bin/autoFixIssueListPlanStepsParity_spec.js` — new file.

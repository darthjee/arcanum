# Add shell/native parity test for auto-fix-issue-run-checks

Add a parity spec (following the existing `core/spec/bin/autoFixIssue*Parity_spec.js` structure, e.g. `autoFixIssueListPlanAgentsParity_spec.js`) that runs `run_checks_shell.sh` directly alongside `core/bin/arcanum auto-fix-issue-run-checks` against equivalent fixture inputs, asserting byte-identical stdout and exit code for:

- An agent with no `.claude/scripts/check_<agent>.sh` present (the "no checks configured" message + exit 0 case).
- An agent whose check script exits `0` (with some stdout output, to confirm both paths pass it through identically).
- An agent whose check script exits nonzero (e.g. `1`) — the exit-code-propagation case this migration's "External dependencies" note flags as the whole point of the streaming/`DispatchFailure` design in [node.md](../node.md).

## Files to Change
- `core/spec/bin/autoFixIssueRunChecksParity_spec.js` — new file.

# Node Plan: Migrate auto-fix-issue-list-plan-agents entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Steps

- [01 — Split list_plan_agents.sh into shell impl plus engine_dispatch shim](node/01-split-shim.md)
- [02 — Add native AutoFixIssueListPlanAgents command](node/02-add-native-command.md)
- [03 — Register auto-fix-issue-list-plan-agents in the command registry](node/03-register-command.md)
- [04 — Flip the migration-status flag to true](node/04-flip-migration-flag.md)
- [05 — Add native unit tests for AutoFixIssueListPlanAgents](node/05-add-unit-tests.md)
- [06 — Add shell/native parity test](node/06-add-parity-test.md)

## CI Checks
- `core`: `yarn test` (CI job: `test`)
- `core`: `yarn lint` (CI job: `checks`)

## Notes
- `list_plan_agents.sh` has no external dependencies (no git/GitHub calls) — pure filesystem read, so the native command is a straightforward `fs.readdir`-based re-derivation with no env-var allowlist needed in the shim (same as `create_branch.sh`'s shim, which also forwards none).
- Sort order matters for parity: the shell impl sorts full paths with `sort` (`printf '%s\n' "${FILES[@]}" | sort`) before stripping directory and `.md` extension — the native implementation must replicate byte-order sorting of the full relative/absolute paths, not just the basenames, to stay byte-identical when filenames could sort differently either way (in practice they won't since all files share the same directory prefix, but implement it against the actual sorted-paths contract to be safe).
- No in-batch script calls `list_plan_agents.sh` or is called by it, so this step has no ordering dependency on other #427 sub-issues.

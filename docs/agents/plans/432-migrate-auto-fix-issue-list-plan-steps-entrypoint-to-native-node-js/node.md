# Node Plan: Migrate auto-fix-issue-list-plan-steps entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Context
`auto-fix-issue/scripts/list_plan_steps.sh <plan_dir> <agent_name>` lists a specialist agent's ordered step files inside a plan dir: every `*.md` file directly inside `<plan_dir>/<agent_name>` (no recursion), one path per line formatted as `<plan_dir>/<agent_name>/<file>`, sorted alphabetically by filename. It prints nothing and exits 0 when `<plan_dir>/<agent_name>` doesn't exist or is empty. It is a pure filesystem read — no git or GitHub API calls, no `repo_path` argument of its own.

`auto-fix-issue-list-plan-agents` (#431) is the direct precedent for this exact shape: same plan-dir convention, same "no `repo_path` argument, derive one from the ambient git checkout only for `engine_dispatch`'s `config_chain_read`" pattern, `context: 'none'` in the command registry (no leading `repoPath` to strip). Mirror it file-for-file.

## Steps

- [01 — Split list_plan_steps.sh into shell impl + engine_dispatch shim](node/01-split-shell-script-and-add-dispatch-shim.md)
- [02 — Add native AutoFixIssueListPlanSteps command](node/02-add-native-list-plan-steps-command.md)
- [03 — Register the command in the registry](node/03-register-command-in-registry.md)
- [04 — Flip the migration-status flag](node/04-flip-migration-status-flag.md)
- [05 — Add native unit tests](node/05-add-native-unit-tests.md)
- [06 — Add shell/native parity test](node/06-add-shell-native-parity-test.md)

## CI Checks
- `core`: `make core-test` (CI job: `test`) — runs `yarn test` (Jasmine + c8 coverage)
- `core`: `make core-lint` (CI job: `checks`) — runs `yarn lint`

## Notes
- No git/GitHub API involved anywhere in this migration — purely a filesystem read, so no env vars need forwarding through `engine_dispatch`'s allowlist (same as `list_plan_agents.sh`).
- Keep `AutoFixIssueListPlanSteps.js`'s output byte-identical to the shell version, including the trailing newline behavior and the exact `<plan_dir>/<agent_name>/<file>` path formatting (not just the bare filename) — this differs from `AutoFixIssueListPlanAgents.js`, which strips to bare agent names; do not copy that stripping behavior here.

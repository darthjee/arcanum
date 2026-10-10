# Docker callbacks in the shim routing specs

Every batch-1 command except `dispatch-fixture-crash` needs a shim-level routing case, built with `itRoutesEngineDispatch`, that passes a `docker` callback. The callback asserts that the real shim reaches `docker run` (passthrough fake) with only the repo mount, no extra `-e` names, `<command> <args...>` after the image, and the same stdout/exit code as native.

Most batch-1 shims have only shell-vs-native parity specs that bypass the shim, so add routing specs where none exist:

- `auto-fix-all/scripts/config.sh` (4 subcommands) and `auto-fix-all/scripts/queue.sh` (5 subcommands; seed the queue for `wait-next` so it returns at once).
- `auto-fix-issue/scripts/github.sh info`: extend the existing `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js` if it already covers `info`, otherwise add a case there.
- `auto-fix-issue/scripts/list_plan_agents.sh`, `list_plan_steps.sh`, `discuss-issue/scripts/confirm.sh`, `arcanum/_lib/{finish_report,issue_state,list_agents,resolve_id_and_file,resolve_plan_paths}.sh`, `init-claude/scripts/{set_ci_ignored_patterns,setup_docs_structure,setup_templates}.sh`.
- `monitor-issues/scripts/config.sh` and `rewrite_queue.sh`: extend `core/spec/bin/monitorIssuesEngineDispatch_spec.js` with a docker callback on the existing `config.sh`/`rewrite_queue.sh` cases, and add cases for the remaining subcommands.

Group the new cases per shim file, e.g. `core/spec/bin/autoFixAllEngineDispatch_spec.js`, `core/spec/bin/sharedLibEngineDispatch_spec.js` and `core/spec/bin/initClaudeEngineDispatch_spec.js`. Give each case a scenario whose shell and native outcomes differ, as in the existing routing specs, so the `shell`/`native` callbacks prove the routing too.

## Files to Change

- `core/spec/support/factories/engineDispatchDockerSetup.js`: shared "repo mount only" docker assertion helper.
- `core/spec/bin/monitorIssuesEngineDispatch_spec.js`, `core/spec/bin/autoFixIssueGithubParity/engine_dispatch_spec.js`: docker callbacks and new cases.
- New routing spec files under `core/spec/bin/` for the auto-fix-all, auto-fix-issue (list-plan-*), discuss-issue, `arcanum/_lib` and init-claude shims.

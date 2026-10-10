# Update shim headers and the smoke script

Each batch-1 shim's header describes the engines it routes to. Add a short paragraph, as in the pilot's `check_config.sh`, saying that under `engine.mode=docker` the command now runs `core/bin/arcanum` in the container (#745), with only the repo mount (no `--needs`), and that it falls back to native on the host with a warning when Docker is unavailable. Native-only `set_next_step_auto.sh` should drop its "except engine.mode=docker, which errors out"-style wording and match the pilot. The `engine_dispatch` lines themselves don't change.

`arcanum/_lib/test_engine_dispatch.sh` comments say the real map has `auto-fix-all-config-get: "native"`. Update those comments, and any assertion that depends on that value, so the smoke script still passes. Under `engine.mode=native`, a `"docker"` status still runs native on the host per dispatch.md's mode table. Check this by running the script.

## Files to Change

- `auto-fix-all/scripts/config.sh`, `auto-fix-all/scripts/queue.sh` (only the batch-1 subcommands' wording; `save`/`push` are not in this batch)
- `auto-fix-issue/scripts/github.sh` (`info` only), `auto-fix-issue/scripts/list_plan_agents.sh`, `auto-fix-issue/scripts/list_plan_steps.sh`
- `discuss-issue/scripts/confirm.sh`
- `arcanum/_lib/finish_report.sh`, `arcanum/_lib/issue_state.sh`, `arcanum/_lib/list_agents.sh`, `arcanum/_lib/resolve_id_and_file.sh`, `arcanum/_lib/resolve_plan_paths.sh`
- `init-claude/scripts/set_ci_ignored_patterns.sh`, `init-claude/scripts/set_next_step_auto.sh`, `init-claude/scripts/setup_docs_structure.sh`, `init-claude/scripts/setup_templates.sh`
- `monitor-issues/scripts/config.sh`, `monitor-issues/scripts/rewrite_queue.sh`
- `arcanum/_lib/test_engine_dispatch.sh`: comments and expectations about `auto-fix-all-config-get`'s real status.

# Issue: Migrate monitor-issues entrypoints to native Node.js

## Description

Part of the remaining shell → Node.js migration (see `docs/agents/architecture/entrypoint-migration-status.md`). All 4 `monitor-issues` entrypoints are still `false` in `arcanum/_lib/migration-status.json`:

| Current key | Script | Lines | Notes |
| --- | --- | --- | --- |
| `monitor-issues-config` | `monitor-issues/scripts/config.sh` | 105 | `get`/`is-enabled`/`set`/`toggle`, lock-guarded; cwd-relative (no `repo_path` arg); `clear_context` lives in `.claude/state/monitor-issues-config.json`, every other key in `.claude/configuration/monitor-issues.json` (does **not** use `repo_config.sh`'s new/legacy split, unlike `auto-fix-all/scripts/config.sh`) |
| `monitor-issues-github` | `monitor-issues/scripts/github.sh` | 40 | single `remove-tag <repo_path> <id> <tag>` subcommand via `tags.sh`/`tag_mutate.sh` |
| `monitor-issues-monitor-issues` | `monitor-issues/scripts/monitor_issues.sh` | 195 | long-running 5s poll loop: `gh issue list --search "updated:>SINCE"` (author-filtered), per-issue `updated_at` guard via `issue_state.sh`, dispatches actionable tags (`created` → rewrite queue, `ready_for_work` → auto-fix-all queue, `question` → log only), records `updated_at`/`tags` only when all dispatches succeed |
| `monitor-issues-rewrite-queue` | `monitor-issues/scripts/rewrite_queue.sh` | 86 | `push <id>`/`pop`, lock-guarded; cwd-relative; same `[{"id": ...}]` schema as the auto-fix-all queue |

Callers: `monitor-issues/SKILL.md` (`monitor_issues.sh`, `config.sh is-enabled`), `toggle-monitor-clear-context/SKILL.md` (`config.sh toggle`), `auto-rewrite-issue/steps/run.md` (`rewrite_queue.sh pop`), plus `monitor_issues.sh` itself (`rewrite_queue.sh push`, `auto-fix-all/scripts/queue.sh push`, `auto-fix-issue/scripts/issue_state.sh`).

## Decisions

- **Single issue**: all 4 scripts, including the poll loop, are migrated here, not split into sub-issues.
- **CLI interface unchanged**: `config.sh` and `rewrite_queue.sh` keep their cwd-relative, no-`repo_path` interface. The `engine_dispatch` shim passes the current working directory to the native command as `repoPath`, so no caller changes.
- **Generalize, don't duplicate**: `utils/queue/QueueStore.js` takes its queue/lock file names as parameters instead of hardcoding the auto-fix-all ones. The two-file (committed config vs gitignored state) boolean-config logic moves out of `AutoFixAllConfig.js` into a shared helper, used by both `auto-fix-all-config-*` and `monitor-issues-config-*`, while each keeps its own file layout (`monitor-issues` does not use the `repo_config.sh` new/legacy split). The existing auto-fix-all specs must keep passing.
- **In-process dispatch**: the native poll loop calls the issue-state service, the native auto-fix-all queue push and the native rewrite-queue push directly, not by spawning subprocesses.

## Solution

Follow `docs/agents/architecture/script-engine.md` and the precedent of earlier batch migrations (#252 sub-issues; #261 `auto-fix-all-config-*` and #264 `auto-fix-all-queue-*` for multi-subcommand scripts):

1. Read each source script for its exact stdout/stderr/exit-code contract.
2. Split into `*_shell.sh` implementation(s) + a thin `engine_dispatch` shim, one command name per subcommand (`monitor-issues-config-get`/`-is-enabled`/`-set`/`-toggle`, `monitor-issues-rewrite-queue-push`/`-pop`, `monitor-issues-github` (single `remove-tag` subcommand), `monitor-issues-monitor-issues`), each with a minimal env-var allowlist (`HOME` only where a GitHub token is needed).
3. Implement native commands under `core/lib/commands/monitor-issues/` (zero runtime deps), reusing rather than re-deriving:
   - `utils/file/Lock.js` for the config and rewrite-queue locks;
   - `utils/queue/QueueStore.js` for the rewrite queue, parameterized by file name (see Decisions);
   - a shared two-file config helper extracted from `AutoFixAllConfig.js` (see Decisions);
   - `services/TagMutationService.js` / `utils/issue/Tags.js` for `remove-tag` and tag extraction; port `arcanum/_lib/tag_actions.sh`'s `actionable_tags` (fixed order: `question`, `created`, `ready_for_work`) next to `Tags.extractTags`;
   - `services/IssueStateService.js` and the native auto-fix-all queue push in-process, instead of shelling out to `issue_state.sh`/`queue.sh`;
   - the GitHub client stack for the issue listing — add an issue-search/list call equivalent to `gh issue list -R <repo> [--author <user>] --state open --search "updated:>SINCE" --limit 100` (issues only, no PRs).
4. `monitor-issues-monitor-issues`: inject the sleep (same precedent as `Lock.js` `sleepMs` / `AutoFixAllWaitCi.js` `sleepFn`) and the clock so specs can bound the loop and pin timestamps; preserve the `issue-monitor-last-checked.txt` “now − 1s” cursor semantics, the log line format, per-cycle error recovery (log and keep looping), lock release on exit, and SIGTERM/Ctrl-C shutdown.
5. Register each command in `core/bin/arcanum`'s dispatch table.
6. Replace the 4 `false` keys in `arcanum/_lib/migration-status.json` with one `true` key per dispatched command name, then regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`.
7. Native unit specs mirroring `core/lib/` 1:1, plus a shell-vs-native parity spec per command.
8. Verify `engine_dispatch.sh` routing for `engine.mode=native` and `shell`.

## Benefits

- Finishes the `monitor-issues` slice of the shell → Node.js migration, removing its `jq`/`gh`/`date` platform branching (`date -v` vs `date -d`).
- The poll loop calls issue-state and queue logic in-process instead of spawning three shell scripts per issue.

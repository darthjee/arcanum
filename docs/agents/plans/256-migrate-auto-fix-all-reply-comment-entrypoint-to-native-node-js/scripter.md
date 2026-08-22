# scripter Plan: Migrate auto-fix-all-reply-comment entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The rewritten `reply_comment.sh` shim must keep the exact CLI contract documented in `plan.md`'s "Shared contracts" section — same positional args, same exit codes, same stderr usage message — since every skill `.md` step calling it stays engine-agnostic.
- Command name `auto-fix-all-reply-comment` is what both `engine_dispatch` and `migration-status.json` key on; it must match exactly what the `node` agent registers in `core/bin/arcanum`'s `COMMANDS` map.
- Flip `arcanum/_lib/migration-status.json`'s `"auto-fix-all-reply-comment"` entry to `true` only once the `node` agent's module is in place — both sides land in the same PR.

## Implementation Steps

### Step 1 — Split `reply_comment.sh` into a shim + `reply_comment_shell.sh`

Follow the exact pattern already used by `auto-fix-all/scripts/cleanup_artifacts.sh` / `cleanup_artifacts_shell.sh` (the closest precedent — same skill, same `scripts/` folder):

1. Copy the current body of `auto-fix-all/scripts/reply_comment.sh` (usage parsing, sourcing `origin.sh`/`push.sh`/`repo_path.sh`, template rendering, `gh pr comment`, `push_current_branch`) verbatim into a new `auto-fix-all/scripts/reply_comment_shell.sh`, unchanged in behavior.
2. Rewrite `auto-fix-all/scripts/reply_comment.sh` into a thin shim: parse/validate the same required positional args (`repo_path`, `id`, `agent`, `model_name`, `model_email`, `reply_body`) for the usage error path, then `source engine_dispatch.sh` and call `engine_dispatch "$REPO_PATH" auto-fix-all-reply-comment "${SCRIPT_DIR}/reply_comment_shell.sh" HOME -- "$@"`.
3. Add a header comment on the shim referencing `docs/agents/architecture/script-engine.md` and this plan's directory, and explaining the `HOME` forward (needed for `gh auth token`/`gh auth switch` once native's `env -i` strips the ambient environment) — same shape as the `cleanup_artifacts.sh` header.

### Step 2 — Flip the migration-status flag

Once the `node` agent's `core/lib/AutoFixAllReplyComment.js` and `COMMANDS` registration are in place, set `arcanum/_lib/migration-status.json`'s `"auto-fix-all-reply-comment"` key from `false` to `true`. Manually sanity-check both routes locally: `engine.mode=shell` (default) still calls `reply_comment_shell.sh`; `engine.mode=native` routes to `core/bin/arcanum auto-fix-all-reply-comment`.

## Files to Change

- `auto-fix-all/scripts/reply_comment.sh` — rewritten as a thin `engine_dispatch` shim.
- `auto-fix-all/scripts/reply_comment_shell.sh` — new file, the original shell logic moved here unchanged.
- `arcanum/_lib/migration-status.json` — `"auto-fix-all-reply-comment"` flipped to `true`.

## Notes

- Do not touch `auto-monitor-issue-pr/scripts/resolve_pr_number.sh` or `arcanum/_lib/push.sh` — both are out-of-batch per the issue and stay shelled-out-to as-is from `reply_comment_shell.sh`.
- No CI job runs shell-script tests directly for this folder (no shellcheck/bats job in `.circleci/config.yml`); rely on the `node` agent's parity test to catch behavioral drift between `reply_comment_shell.sh` and the native module.

# Plan: Migrate auto-fix-all-wait-ci-and-merge entrypoint to native Node.js

Issue: [266-migrate-auto-fix-all-wait-ci-and-merge-entrypoint-to-native-node-js.md](../issues/266-migrate-auto-fix-all-wait-ci-and-merge-entrypoint-to-native-node-js.md)

## Overview

`auto-fix-all/scripts/wait_ci_and_merge.sh` is a thin orchestrator: it waits for CI via `wait_ci.sh`, and on `passed`, immediately merges via `github.sh pr-merge`. Both dependencies (`auto-fix-all-wait-ci` and `auto-fix-all-github`) have already been migrated to native Node.js (`core/lib/AutoFixAllWaitCi.js`, `core/lib/AutoFixAllGithub.js`), so this migration is a thin native orchestrator over the two existing native classes — no new CI-polling or merge logic, and no new shell logic beyond turning the existing script into an `engine_dispatch` shim, matching the pattern already established by `auto-fix-all-wait-ci` (#262) and `auto-fix-all-queue` (#264).

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **`migration-status.json` key**: `"auto-fix-all-wait-ci-and-merge"` — flipped from `false` to `true` by scripter once node's module lands. This is the same key `node` registers in `core/bin/arcanum`'s `COMMANDS` map and `scripter`'s shim passes to `engine_dispatch` as `<command>`.
- **`core/bin/arcanum` command surface**: `auto-fix-all-wait-ci-and-merge <repo_path> [model_email]` → routes to `core/lib/AutoFixAllWaitCiAndMerge.js`'s `run(repoPath, modelEmail)`, mirroring exactly the two positional args `wait_ci_and_merge.sh` itself takes.
- **Output/exit contract** (unchanged from the shell script, both implementations must match it byte-for-byte):
  - CI passed and merge succeeded: stdout is `passed\n<url>\n` (line 1 `passed`, line 2 the merged PR's URL — exactly what `AutoFixAllGithub#prMerge` itself returns), exit 0.
  - CI failed: stdout is `failed\n<name>\n...` (one failed/cancelled/timed-out check-run name per line, exactly what `AutoFixAllWaitCi#run` itself returns when it doesn't resolve to `passed`), exit 0, merge never attempted.
  - A hard failure of either underlying call (e.g. no open PR, merge API error) is not folded into the `passed`/`failed` contract — it propagates as a thrown `Error` (native) / non-zero exit (shell), same as any other unexpected failure.
- **`scripter`'s shim → native routing**: the rewritten `auto-fix-all/scripts/wait_ci_and_merge.sh` calls `engine_dispatch "$REPO_PATH" auto-fix-all-wait-ci-and-merge "${SCRIPT_DIR}/wait_ci_and_merge_shell.sh" HOME -- "$REPO_PATH" "$MODEL_EMAIL"` — forwarding `HOME`, matching `wait_ci.sh`'s own forwarding, since the orchestrated calls resolve GitHub credentials via `gh auth token` under the hood (`GithubToken.js`).

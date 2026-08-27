# scripter Plan: Command SpawnIssue has too many responsibilities

Main plan: [plan.md](plan.md)

## Shared contracts

`spawn_issue_shell.sh` must read `plan-issues.max-retry-count` and `plan-issues.error-sleep-time` via the config-chain-equivalent shell helper, with the same `5`/`5` fallback the native `SpawnIssue` uses — so a given repo's retry/sleep behavior is identical whether `engine_dispatch` routes it to the shell path or the native path.

## Implementation Steps

### Step 1 — Migrate spawn_issue_shell.sh's config reads to config_chain_read

`arcanum/_lib/spawn_issue_shell.sh` currently reads `plan-issues.max-retry-count`/`plan-issues.error-sleep-time` single-tier, via `repo_config.sh`'s `repo_config_read ".claude/state/arcanum-config.json" "" "plan-issues" "max-retry-count"` (and the `error-sleep-time` equivalent) — no repo/global fallback. Replace both reads with `arcanum/_lib/config_chain.sh`'s `config_chain_read "$REPO_PATH" "plan-issues" "max-retry-count"` / `... "error-sleep-time"`, which resolves the full 3-tier chain (local state → repo config → global config) matching `ConfigChain.read`'s native behavior.

- Source `config_chain.sh` (alongside the existing `repo_path.sh`/`origin.sh`/`repo_config.sh`/`tags.sh` sources) — keep sourcing `repo_config.sh` too if any other read in this script still needs it (currently none does, but double-check before removing the source).
- Keep the existing `[[ -n "$max_retry" ]] || max_retry=5` / `[[ -n "$error_sleep" ]] || error_sleep=5` default-fallback lines as-is — `config_chain_read` returns empty the same way `repo_config_read` does when nothing resolves, so the existing fallback logic works unchanged against the new read.
- Verify `config_chain_read`'s output shape matches what the script's `//\"//}"` quote-stripping expects (same `jq -c` raw-ish output as `repo_config_read`) — adjust the stripping if `config_chain_read`'s output format differs.

## Files to Change

- `arcanum/_lib/spawn_issue_shell.sh` — replace the two `repo_config_read` calls for `plan-issues.max-retry-count`/`plan-issues.error-sleep-time` with `config_chain_read` calls; source `config_chain.sh`.

## Notes

- This is the shell-side half of node.md's shared contract — verify against node/04's final `RepoContext.readConfig` defaulting behavior once that lands, to make sure both sides genuinely produce identical output for the same config file states (absent, set at each of the 3 tiers, malformed JSON).

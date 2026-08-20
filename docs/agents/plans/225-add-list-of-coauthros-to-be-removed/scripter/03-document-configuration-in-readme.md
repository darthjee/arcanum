# Document all configurations in README.md

Add a new `## Configuration` section to `README.md`, placed immediately after the existing `## Skill structure` section. Contents, in order:

1. A short paragraph explaining the 3-tier config resolution: local (`.claude/state/arcanum-config.json`, gitignored) -> repo (`.claude/configuration/arcanum-repo-config.json`, committed) -> global (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`), first non-null value wins — mirroring git's own `--local` > `--global` > `--system` precedence. See `docs/agents/architecture/shared-state-and-configuration.md` for the authoritative per-file breakdown if more detail is needed.
2. A Markdown table of every configuration key currently read anywhere in the repo (verified against source, not just the issue's draft table — the issue's own table omitted two real keys, added back here):

   | Key | Description |
   |-----|-------------|
   | `git.merge_body_mode` | Controls the squash-merge commit body (`empty`, `full`, or `coauthors`). |
   | `git.omit_model_coauthor` | When `true`, removes the model's email from the coauthors list during merge. |
   | `git.remove_coauthors` | List of emails to remove from the coauthors list during merge. |
   | `git.agents.<agent>.email` | Commit author email per agent, supports the `{agent}` placeholder. |
   | `git.email` | Global fallback email for agents without a specific email configured. |
   | `git.safe_branch` | Reference branch for safe fetch/merge operations (default: `origin/main`). |
   | `engine.mode` | Defines which implementation to run for migrated entrypoints (`shell`, `native`, or `docker`). |
   | `auto-fix-all.clear_context` | Clears context between issues processed in the `auto-fix-all` pipeline. |
   | `auto-fix-all.finish_on_empty_queue` | Finishes the pipeline when the issue queue is empty. |
   | `auto-fix-all.ignored_check_patterns` | CI check name patterns to ignore when deciding pass/fail. |
   | `monitor-issues.clear_context` | Clears context between `monitor-issues` cycles. |
   | `plan-issues.max-retry-count` | Max retries for GitHub issue creation in `arcanum/_lib/spawn_issue.sh` (default: 5). |
   | `plan-issues.error-sleep-time` | Seconds to sleep between retries in `arcanum/_lib/spawn_issue.sh` (default: 5). |

3. A single JSON example showing every key from the table together (see the issue file's "Solution" section for the exact example to reuse/adapt).

Before writing, re-grep the repo for `config_chain_read`/`repo_config_read`/`global_config_read`/`repo_config_write` call sites to make sure no newer key landed between planning and implementation — this table must stay exhaustive.

## Files to Change

- `README.md` — add `## Configuration` section (resolution explanation + table + JSON example) after `## Skill structure`.

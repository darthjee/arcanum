# Issue: Add list of coauthors to be removed

## Description

Add a new configuration key `git.remove_coauthors` — an array of email strings — that filters specific emails out of the coauthors list used to build the squash-merge commit body. Additionally, add a "Configuration" section to `README.md` documenting all of arcanum's configuration keys.

## Problem

When merging a PR with `git.merge_body_mode` set to `coauthors`, `merge_body_coauthors_list()` (`arcanum/_lib/merge_body.sh`) collects every co-author from the PR's commits, dedupes them by email, and builds the `Co-authored-by:` block. The only existing filter is `git.omit_model_coauthor`, which removes a single hardcoded model email (via `model_coauthor_omitted()` in `arcanum/_lib/agent_email.sh`) — there is no way to exclude any other unwanted email (e.g. `noreply@anthropic.com`) from that list.

Separately, `README.md` documents installation and updating but has no section describing arcanum's configuration keys, making them hard for users to discover.

## Expected Behavior

- Setting `git.remove_coauthors` to an array of emails (e.g. `["noreply@anthropic.com"]`) removes any matching entries from the deduped coauthors list before the `Co-authored-by:` block is built.
- The key is resolved via `config_chain_read(".", "git", "remove_coauthors")` (local -> repo -> global), the same convention as `omit_model_coauthor`.
- When the key is absent, the array defaults to `[]` — no filtering — purely opt-in.
- `README.md` gains a new "Configuration" section (placed after "Skill structure") that explains the 3-tier config resolution, lists every configuration key in a table, and shows a full JSON example.

## Solution

### 1. Implement the `git.remove_coauthors` filter

- Add a function to read `git.remove_coauthors` via `config_chain_read(".", "git", "remove_coauthors")`, following the pattern of `model_coauthor_omitted()` in `arcanum/_lib/agent_email.sh`.
- In `merge_body_coauthors_list()` (`arcanum/_lib/merge_body.sh`), inject the resulting array into the jq pipeline as `--argjson` and add a filter step after `unique_by(.email)`:
  ```jq
  map(select(.email as $e | $remove_list | index($e) | not))
  ```
- When the key is absent, the array defaults to `[]` (no filtering) — purely opt-in, same convention as `omit_model_coauthor`.

**Example configuration:**

```json
{
  "git": {
    "remove_coauthors": ["noreply@anthropic.com"]
  }
}
```

### 2. Document all configurations in README.md

Add a **"Configuration"** section after "Skill structure" in `README.md`, containing:

- A brief explanation of the 3-tier config resolution (local -> repo -> global)
- A table with all configuration keys and a one-sentence description
- A JSON example showing all keys

**Configuration table:**

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

**JSON example:**

```json
{
  "git": {
    "merge_body_mode": "coauthors",
    "omit_model_coauthor": true,
    "remove_coauthors": ["noreply@anthropic.com"],
    "agents": {
      "architect": { "email": "you+architect@example.com" }
    },
    "email": "you+{agent}@example.com",
    "safe_branch": "origin/main"
  },
  "engine": {
    "mode": "shell"
  },
  "auto-fix-all": {
    "clear_context": false,
    "finish_on_empty_queue": false,
    "ignored_check_patterns": []
  },
  "monitor-issues": {
    "clear_context": false
  },
  "plan-issues": {
    "max-retry-count": 5,
    "error-sleep-time": 5
  }
}
```

**Files affected:**

- `arcanum/_lib/merge_body.sh` — add filter step in `merge_body_coauthors_list()` jq pipeline
- `arcanum/_lib/agent_email.sh` — (optional) add helper function following `model_coauthor_omitted()` pattern
- `README.md` — add "Configuration" section with table + JSON example

**Configuration resolution:**

All keys are read via `config_chain_read` in 3 tiers, in order of precedence:

1. `.claude/state/arcanum-config.json` (local, gitignored)
2. `.claude/configuration/arcanum-repo-config.json` (committed, shared)
3. `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` (global, cross-project)

The first non-null value found wins — mirroring git's own `--local` > `--global` > `--system` precedence.

## Benefits

- Lets users trim unwanted coauthors (e.g. bot/no-reply emails) from squash-merge commit messages, without being limited to the single `omit_model_coauthor` case.
- Documents all configuration keys in one place, making arcanum's configuration surface discoverable without reading source.

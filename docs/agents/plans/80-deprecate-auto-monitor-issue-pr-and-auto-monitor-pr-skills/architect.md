# Architect Plan: Deprecate auto-monitor-issue-pr and auto-monitor-pr skills

Main plan: [plan.md](plan.md)

## Shared contracts

- `auto-fix-all/scripts/monitor_pr.sh` is created by the scripter — wait for that before updating `process_one_issue.md`.
- PR number is resolved via `scripts/github.sh pr-number` (no arguments, current branch).
- `reply_comment.sh` is updated by the scripter.

## Implementation Steps

### Step 1 — Update process_one_issue.md

In `auto-fix-all/steps/process_one_issue.md`, replace the "Monitor the PR" block opener:

> Read `[../../auto-monitor-issue-pr/steps/run.md](../../auto-monitor-issue-pr/steps/run.md)` and follow it for `<id>`. It resolves the PR for the current branch and **blocks** — looping internally (5s sleep, retries silently on transient errors) until the PR is merged, closed, approved, or the owner posts a new comment — then reports the outcome. The first output line is `merged`, `closed`, `approved`, or `commented`.

with the two inlined steps:

```
Resolve the PR number for the current branch:

\`\`\`bash
scripts/github.sh pr-number
\`\`\`

Call the result `<pr_number>`, then block on the monitor script:

\`\`\`bash
scripts/monitor_pr.sh --pr-number <pr_number> --issue-id <id>
\`\`\`

This blocks until the PR is merged, closed, approved, or the owner posts a new comment. The first output line is `merged`, `closed`, `approved`, or `commented`; when `commented`, subsequent lines are the new comments (one per `---`-separated block, each block starting with `id: <node id>` and `url: <html url>`, followed by the comment body).
```

Also port the permission-rule gotcha note from `auto-monitor-issue-pr/steps/run.md` into `process_one_issue.md` (right after the `scripts/monitor_pr.sh` invocation block), updating script names to the new paths:

> **Permission-rule gotcha:** `scripts/github.sh pr-number` and `scripts/monitor_pr.sh` are invoked with variable arguments. If a local `.claude/settings.local.json` ever grants these scripts permission with a number baked in (e.g. `Bash(auto-fix-all/scripts/monitor_pr.sh --pr-number 21 *)`), the rule will never match a future issue's number, and Claude Code will prompt for permission again on every new issue — silently breaking the "no confirmation loop" contract. Always keep (or rewrite) these two rules as number-agnostic wildcards, e.g. `Bash(auto-fix-all/scripts/monitor_pr.sh --pr-number *)`, covering every path form (relative and absolute) under which they get invoked.

### Step 2 — Update README.md

Remove the two table rows for `auto-monitor-pr` and `auto-monitor-issue-pr` from `README.md`.

### Step 3 — Update docs/agents/architecture.md

In the "Shared State & Configuration Files" table:
- In the `.claude/state/issue-<id>.json` row, replace the phrase "`auto-fix-issue`, `monitor-issues`, and `auto-monitor-pr`" with "`auto-fix-issue`, `monitor-issues`, and `auto-fix-all`".
- In the `.claude/state/auto-monitor-pr-<pr_number>-comments.json` row, replace "used by `auto-monitor-pr`" with "used by `auto-fix-all/scripts/monitor_pr.sh`".

### Step 4 — Delete both skill directories

Run:
```bash
rm -rf auto-monitor-issue-pr/ auto-monitor-pr/
```
(from the skills root: `/Users/darthjee/.claude-favini/skills/`)

## Files to Change

- `auto-fix-all/steps/process_one_issue.md` — inline the two monitor steps; port permission-rule gotcha note
- `README.md` — remove two rows
- `docs/agents/architecture.md` — update two references to `auto-monitor-pr`
- `auto-monitor-issue-pr/` — delete directory
- `auto-monitor-pr/` — delete directory

## Notes

- The architect waits for the scripter to confirm `auto-fix-all/scripts/monitor_pr.sh` exists before deleting `auto-monitor-pr/`. In practice both agents work in parallel on separate files, but the directory deletion must happen after the scripter's commit.
- No CI checks configured for this project.

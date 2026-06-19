# Monitor the PR

All commands below run from the issue's branch (`issue-<id>`), already checked out by [process_next.md](process_next.md).

## Block on the monitor script

```bash
scripts/monitor_pr.sh monitor <id>
```

This resolves the PR number for the current branch and the configured GitHub user (`git config user.ghuser`) internally, derives the since-file path (`.claude/state/auto-fix-all-<id>-since.txt`), and then **blocks** — it loops internally (5s sleep, retries silently on transient errors) until the PR is merged, closed, approved, or the owner posts a new comment. The since-file tracks the last-seen comment timestamp for this issue across loop iterations; it is plain text, not JSON, and lives under `.claude/state/`. The first output line is `merged`, `closed`, `approved`, or `commented`.

---

### If `merged`

```bash
scripts/queue.sh pop
```

Go back to Step 2 of `SKILL.md` to process the next issue.

---

### If `closed`

The PR was closed without merging. This is the one point in the whole pipeline where you ask the user something. Resolve `<pr_number>` first:

```bash
scripts/github.sh pr-number
```

> PR #<pr_number> for issue <id> was closed without merging. What would you like to do?
> 1. Reimplement from scratch (start over from a clean `main` for this issue)
> 2. Skip this issue and move on to the next one

- **Reimplement** — go back to Step 2 of `SKILL.md` (the ID stays at the front of the queue; [process_next.md](process_next.md) will check out a fresh branch from `main` again).
- **Skip** — `scripts/queue.sh pop`, then go back to Step 2 of `SKILL.md`.

---

### If `approved` (also reached directly from `process_next.md` step 6 when the issue has the `shipit` label)

1. Remove planning artifacts and commit (never commit this by hand):
   ```bash
   scripts/cleanup_artifacts.sh <issue_file> <plan_dir> <id> "<your AI model name>" "<your AI model noreply email>"
   ```
   `<issue_file>` and `<plan_dir>` are the same paths resolved by `../../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>` (re-run it here, resolved relative to the `auto-plan-issue` skill folder, if you no longer have them at hand).
2. Push:
   ```bash
   git push
   ```
3. Resolve `<pr_number>` and wait for CI:
   ```bash
   scripts/github.sh pr-number
   scripts/wait_ci.sh <pr_number>
   ```
   This blocks until every check-run registered on the PR's head commit completes, regardless of which CI provider runs them (no provider-specific filtering). The first output line is `passed` or `failed`; on `failed`, subsequent lines are the names of the failed check-runs.

#### If CI `passed`

```bash
scripts/github.sh pr-merge
```

Then `scripts/queue.sh pop` and go back to Step 2 of `SKILL.md`.

#### If CI `failed`

Read [handle_comment.md](handle_comment.md)'s **"Choosing the responsible agent(s)"** section and apply the same agent-selection approach to the failed check-run names: dispatch the responsible specialist agent(s) (or yourself, as architect, if none seem responsible) in parallel with the instruction to investigate the CI failure, fix it, run the full dev cycle locally, and commit via `../../auto-fix-issue/scripts/commit_change.sh` (resolved relative to the `auto-fix-issue` skill folder).

After all agents commit, `git push`, then go back to step 3 above (`wait_ci.sh`) to re-check.

---

### If `commented`

The lines after the first are the new comment bodies, one per `---`-separated block — only comments from `<pr_owner>` are included.

Read [handle_comment.md](handle_comment.md) and follow its instructions to dispatch each comment to the right agent(s) and apply the feedback.

After all comments are handled and pushed, go back to the top of this file (block on `monitor_pr.sh` again) to resume monitoring.

> **Note:** only a merge advances the queue. Approval triggers cleanup + CI wait + merge (which then also advances the queue). Comments always loop back to monitoring.

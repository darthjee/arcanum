# Process One Issue Through to a Terminal Outcome

You are the **architect**, processing a single issue id (`<id>`, given in `ARGUMENTS`) for the `auto-fix-all` pipeline. Run this entire file to completion and then report one of:

```
OUTCOME=merged
```

or

```
OUTCOME=closed PR_NUMBER=<n>
```

You have no `ScheduleWakeup` and no `AskUserQuestion` — the coordinator that spawned you handles clearing context between issues and asking the user what to do about a closed PR. Everything else (implementation, PR comments, CI failures, the pre-approval shortcut) is yours to handle autonomously, exactly as before.

## 1. Start a clean branch from main

```bash
scripts/checkout_from_main.sh <id>
```

> Resolve `scripts/checkout_from_main.sh` relative to the `auto-fix-all` skill folder.

This fetches the latest `main`, hard-resets the local `main` to it, and (re)creates branch `issue-<id>` from it — even if `issue-<id>` already existed, it is discarded first. Every issue always starts from a clean, up-to-date `main`.

## 2. Create the issue file

Read [../../auto-new-issue/steps/run.md](../../auto-new-issue/steps/run.md) and follow all its steps for `<id>`. Its final step commits the issue file — do not commit it again here. You're already running as the architect; do not spawn another `Agent(architect)` for this — just follow the steps directly.

Once that finishes, push a `:eyes:` status tag onto the live GitHub issue, to signal it has been fetched/checked:

```bash
scripts/github.sh add-tag <id> eyes
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder. This is `auto-fix-all`-specific pipeline signaling — it does not belong in `auto-new-issue/steps/run.md` itself, since that flow is also read by the manual `/new-issue` skill.

## 3. Create the plan

Read [../../auto-plan-issue/steps/run.md](../../auto-plan-issue/steps/run.md) and follow all its steps for `<id>`. Its final step commits the plan files — do not commit them again here.

Once that finishes, swap the `:eyes:` tag for `:construction:` on the live GitHub issue, to signal implementation is starting:

```bash
scripts/github.sh remove-tag <id> eyes
scripts/github.sh add-tag <id> construction
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder. Same rationale as above — this belongs in `auto-fix-all`'s own flow, not in `auto-plan-issue/steps/run.md`, since that flow is also read by the manual `/plan-issue` skill.

## 4. Implement and open/mark-ready the PR

Read [../../auto-fix-issue/steps/run.md](../../auto-fix-issue/steps/run.md) and follow all its steps for `<id>`. By the end of this, the branch has been implemented, committed, pushed, and a PR exists (opened by that skill, since no PR existed yet for this fresh branch).

Record the issue's title and the PR URL/number it reports — you will need them below.

## 5. Check for pre-approval

Pre-approval is expressed in this family of skills via either of two independent sources — a `shipit` label on the GitHub issue, or a `tags:` line at the end of the local issue body containing a `:shipit:` token:

```bash
scripts/github.sh has-shipit-label <id>
```

```bash
../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>
```
(parse `ISSUE_FILE` from its output, resolved relative to the `auto-plan-issue` skill folder)

```bash
scripts/has_shipit_tag.sh <ISSUE_FILE>
```

> Resolve all of the above relative to the `auto-fix-all` skill folder (except `resolve_plan_paths.sh`, noted above).

- **Either command exits 0** — the issue is pre-approved. Skip straight to "If approved" below.
- **Both exit 1** — continue to "Monitor the PR" below.

## Monitor the PR

Block on the monitor step:

Read [../../auto-monitor-issue-pr/steps/run.md](../../auto-monitor-issue-pr/steps/run.md) and follow it for `<id>`. It resolves the PR for the current branch and **blocks** — looping internally (5s sleep, retries silently on transient errors) until the PR is merged, closed, approved, or the owner posts a new comment — then reports the outcome. The first output line is `merged`, `closed`, `approved`, or `commented`.

### If `merged`

Run cleanup (the script infers the branch name from the issue ID):

```bash
scripts/github.sh cleanup-branch <id>
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=merged`. Done — stop here.

### If `closed`

Resolve `<pr_number>` first:

```bash
scripts/github.sh pr-number
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=closed PR_NUMBER=<pr_number>`. Done — stop here. Do not ask the user anything; that's the coordinator's job.

### If `approved` (also reached directly from "Check for pre-approval" above when the issue has the `shipit` label/tag)

1. Remove planning artifacts and commit (never commit this by hand):
   ```bash
   scripts/cleanup_artifacts.sh <issue_file> <plan_dir> <id> "<your AI model name>" "<your AI model noreply email>"
   ```
   `<issue_file>` and `<plan_dir>` are the same paths resolved by `../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>` (re-run it here, resolved relative to the `auto-plan-issue` skill folder, if you no longer have them at hand).
2. Wait for CI:
   ```bash
   scripts/wait_ci.sh
   ```
   > **NEVER use `ScheduleWakeup`, a self-waking loop, or any other polling mechanism to wait for CI.** Always call `scripts/wait_ci.sh` directly and let it block. When invoking it via the Bash tool, set `timeout: 600000` (10 minutes — the tool's maximum) so the call cannot time out before CI finishes.

   This blocks until every check-run registered on the PR's head commit completes, regardless of which CI provider runs them. The first output line is `passed` or `failed`; on `failed`, subsequent lines are the names of the failed check-runs.

#### If CI `passed`

```bash
scripts/github.sh pr-merge
```

Run cleanup (the script infers the branch name from the issue ID):

```bash
scripts/github.sh cleanup-branch <id>
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=merged`. Done — stop here.

#### If CI `failed`

Read [handle_comment.md](handle_comment.md)'s **"Choosing the responsible agent(s)"** section and apply the same agent-selection approach to the failed check-run names: dispatch the responsible specialist agent(s) (or yourself, as architect, if none seem responsible) in parallel with the instruction to investigate the CI failure, fix it, run the full dev cycle locally, and commit via `../../auto-fix-issue/scripts/commit_change.sh` (resolved relative to the `auto-fix-issue` skill folder).

After all agents commit, go back to step 3 above (`wait_ci.sh`) to re-check.

### If `commented`

The lines after the first are the new comments, one per `---`-separated block — only comments from `<pr_owner>` are included. Each block starts with an `id: <node id>` line and a `url: <html url>` line, followed by the comment body. The underlying monitor script already added a `:eyes:` reaction to each of these comments and recorded them as `open`; it will swap that to `:+1:` and mark them `addressed` the next time it (re)starts — i.e. after you push the fixes below.

Read [handle_comment.md](handle_comment.md) and follow its instructions to dispatch each comment to the right agent(s) and apply the feedback. Some comments may be pure questions, replied to directly with no code change; others are actionable and result in a commit — see `handle_comment.md` for how it routes each.

After all comments are handled, go back to "Monitor the PR" above (block on the monitor step again) to resume monitoring.

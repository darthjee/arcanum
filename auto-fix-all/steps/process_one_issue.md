# Process One Issue Through to a Terminal Outcome

You are the **architect**, processing a single issue id (`<id>`, given in `ARGUMENTS`) for the `auto-fix-all` pipeline. Run this entire file to completion and then report one of:

```
OUTCOME=merged
```

or

```
OUTCOME=closed PR_NUMBER=<n>
```

or

```
OUTCOME=blocked AGENT=<agent-name> ACTION=<description>
```

or

```
OUTCOME=pending PR_NUMBER=<n>
```

You have no `ScheduleWakeup` and no `AskUserQuestion` — the coordinator that spawned you handles clearing context between issues, asking the user what to do about a closed PR, asking the user what to do about a blocked specialist dispatch, and rescheduling itself when the PR is still pending a terminal state. Everything else (implementation, PR comments, CI failures, the pre-approval shortcut) is yours to handle autonomously, exactly as before.

Your invocation prompt also carries `REPO_PATH` (the target project's root, resolved once by the coordinator before spawning you) — thread it through explicitly as the leading argument to every script call below that resolves the GitHub repo, and pass it along unchanged into every nested `steps/run.md` you read directly (never re-resolve it from `pwd`).

## 1. Bootstrap the issue branch, merged up to date with main

```bash
scripts/checkout_from_main.sh "$REPO_PATH" <id>
```

> Resolve `scripts/checkout_from_main.sh` relative to the `auto-fix-all` skill folder.

This fetches `origin`, then either reuses branch `issue-<id>` — merging `origin/main` into it (`--no-edit`) if it already exists locally or remotely, e.g. because `discuss-issue` already prepared it — or creates it fresh from `origin/main` if it doesn't exist at all. Every issue always starts from a branch merged up to date with `main`, without discarding planning/discussion work already committed to it. Parse `STATUS` from its output:

- **`STATUS=ok`**: continue to Step 2 below.
- **`STATUS=conflict`**: apply the same responsible-agent-selection approach as [handle_comment.md](handle_comment.md)'s "Choosing the responsible agent(s)" section, treating each conflicted path the script printed like a failed check-run name — dispatch the responsible specialist(s) (or resolve it yourself, as architect, if none seem responsible) to fix the conflict, then run `git -C "$REPO_PATH" add` on the resolved paths and `git -C "$REPO_PATH" commit` with no message argument (the merge-commit message `git merge --no-edit` already prepared is reused as-is) — never bare `git add`/`git commit`, which would operate against the Bash tool's ambient cwd instead of the target repo. No user interaction. If a dispatch is blocked (see [handle_comment.md](handle_comment.md)'s "Dispatching" → "If a dispatch is blocked"), stop immediately and report that same `OUTCOME=blocked AGENT=<agent-name> ACTION="<description>"` at the top level — do not continue to Step 2. Otherwise, continue to Step 2.

## 2. Create the issue file

Read [../../auto-new-issue/steps/run.md](../../auto-new-issue/steps/run.md) and follow all its steps for `<id>`, carrying `REPO_PATH` forward unchanged. Its final step commits the issue file — do not commit it again here. You're already running as the architect; do not spawn another `Agent(architect)` for this — just follow the steps directly.

Once that finishes, push a `fetched` status tag onto the live GitHub issue, to signal it has been fetched/checked:

```bash
scripts/github.sh add-tag "$REPO_PATH" <id> fetched
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder. This is `auto-fix-all`-specific pipeline signaling — it does not belong in `auto-new-issue/steps/run.md` itself, since that flow is also read by the manual `/new-issue` skill.

## 3. Create the plan

Read [../../auto-plan-issue/steps/run.md](../../auto-plan-issue/steps/run.md) and follow all its steps for `<id>`, carrying `REPO_PATH` forward unchanged. Its final step commits the plan files — do not commit them again here.

Once that finishes, swap the `fetched` tag for `working` on the live GitHub issue, to signal implementation is starting:

```bash
scripts/github.sh remove-tag "$REPO_PATH" <id> fetched
scripts/github.sh add-tag "$REPO_PATH" <id> working
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder. Same rationale as above — this belongs in `auto-fix-all`'s own flow, not in `auto-plan-issue/steps/run.md`, since that flow is also read by the manual `/plan-issue` skill.

## 4. Implement and open/mark-ready the PR

Read [../../auto-fix-issue/steps/run.md](../../auto-fix-issue/steps/run.md) and follow all its steps for `<id>`, carrying `REPO_PATH` forward unchanged. By the end of this, the branch has been implemented, committed, pushed, and a PR exists (opened by that skill, since no PR existed yet for this fresh branch).

Record the issue's title and the PR URL/number it reports — you will need them below.

## 5. Check for pre-approval

Pre-approval is expressed via a `shipit` label on the GitHub issue — `shipit` is human-only, so this is the sole source (no script ever adds or removes it):

```bash
scripts/github.sh has-shipit-label "$REPO_PATH" <id>
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

- **Exits 0** — the issue is pre-approved. Skip straight to "If pre-approved via shipit" below.
- **Exits 1** — continue to "Monitor the PR" below.

## Monitor the PR

Run one bounded check:

Read [../../auto-monitor-issue-pr/steps/run.md](../../auto-monitor-issue-pr/steps/run.md) and follow it for `<id>`, carrying `REPO_PATH` forward unchanged. It resolves the PR for the current branch and performs exactly one bounded check — no blocking, no internal loop — then reports the outcome. The first output line is `pending`, `merged`, `closed`, `approved`, or `commented`.

### If `pending`

Nothing terminal happened this pass, and you (the architect) have no `ScheduleWakeup` to reschedule yourself. Resolve `<pr_number>` first:

```bash
scripts/github.sh pr-number "$REPO_PATH"
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Stop processing this issue immediately and report `OUTCOME=pending PR_NUMBER=<pr_number>` at the top level — do not loop or retry internally, and do not go back to "Monitor the PR" yourself. The coordinator that spawned you owns rescheduling.

### If `merged`

Run cleanup (the script infers the branch name from the issue ID):

```bash
scripts/github.sh cleanup-branch "$REPO_PATH" <id>
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=merged`. Done — stop here.

### If `closed`

Resolve `<pr_number>` first:

```bash
scripts/github.sh pr-number "$REPO_PATH"
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=closed PR_NUMBER=<pr_number>`. Done — stop here. Do not ask the user anything; that's the coordinator's job.

### If approved via review

Reached only from "Monitor the PR" → `approved` — a human approved the PR via GitHub review. Claude Code's own permission classifier still confirms the merge call below; that confirmation is a separate, deliberate gate from GitHub review and is untouched by `shipit` (see "If pre-approved via shipit" below for the pre-approved path).

1. Remove planning artifacts and commit (never commit this by hand):
   ```bash
   scripts/cleanup_artifacts.sh "$REPO_PATH" <issue_file> <plan_dir> <id> "<your AI model name>" "<your AI model noreply email>"
   ```
   `<issue_file>` and `<plan_dir>` are the same paths resolved by `../auto-plan-issue/scripts/resolve_plan_paths.sh "$REPO_PATH" docs/agents/issues docs/agents/plans <id>` (re-run it here, resolved relative to the `auto-plan-issue` skill folder, if you no longer have them at hand).
2. Wait for CI:
   ```bash
   scripts/wait_ci.sh "$REPO_PATH"
   ```
   > **NEVER use `ScheduleWakeup`, a self-waking loop, or any other polling mechanism to wait for CI.** Always call `scripts/wait_ci.sh` directly and let it block. When invoking it via the Bash tool, set `timeout: 600000` (10 minutes — the tool's maximum) so the call cannot time out before CI finishes.

   This blocks until every check-run registered on the PR's head commit completes, regardless of which CI provider runs them. The first output line is `passed` or `failed`; on `failed`, subsequent lines are the names of the failed check-runs.

#### If CI `passed`

```bash
scripts/github.sh pr-merge "$REPO_PATH" "<your AI model noreply email>"
```

> The trailing `<your AI model noreply email>` argument is optional — `pr-merge` only uses it to exclude your own `Co-Authored-By` line from the generated body when `git.merge_body_mode` is `coauthors` and `git.omit_model_coauthor` is `true` (see `arcanum/_lib/merge_body.sh`). Passing it is harmless in every other mode.

Run cleanup (the script infers the branch name from the issue ID):

```bash
scripts/github.sh cleanup-branch "$REPO_PATH" <id>
```

> Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

Report `OUTCOME=merged`. Done — stop here.

#### If CI `failed`

Read [handle_comment.md](handle_comment.md)'s **"Choosing the responsible agent(s)"** section and apply the same agent-selection approach to the failed check-run names: dispatch the responsible specialist agent(s) (or yourself, as architect, if none seem responsible) in parallel with the instruction to investigate the CI failure, fix it, run the full dev cycle locally, and commit via `../../auto-fix-issue/scripts/commit_change.sh` (resolved relative to the `auto-fix-issue` skill folder).

If a dispatch is blocked (see [handle_comment.md](handle_comment.md)'s "Dispatching" → "If a dispatch is blocked"), stop immediately and report that same `OUTCOME=blocked AGENT=<agent-name> ACTION="<description>"` at the top level.

After all agents commit, go back to step 3 above (`wait_ci.sh`) to re-check.

### If pre-approved via shipit

Reached only from "Check for pre-approval" above, when `has-shipit-label` exits 0. Unlike the review-approved path above, the wait-then-merge call below is a single, distinctly-named Bash invocation (`wait_ci_and_merge.sh`) that Claude Code's own permission classifier can be allowlisted to run without confirmation — see `docs/agents/architecture/issue-tags.md`'s `shipit` paragraph and `arcanum/migrations/repos/0.16.0/001.sh`/`002.sh`/`003.sh` (the release that shipped them — no longer under `repos/next/`, which now holds unrelated, later migrations) for how that allowlist entry gets provisioned. It never touches `wait_ci.sh`/`scripts/github.sh pr-merge` directly, and the review-approved path above stays exactly as it was, still classifier-confirmed either way.

1. Remove planning artifacts and commit (never commit this by hand):
   ```bash
   scripts/cleanup_artifacts.sh "$REPO_PATH" <issue_file> <plan_dir> <id> "<your AI model name>" "<your AI model noreply email>"
   ```
   `<issue_file>` and `<plan_dir>` are the same paths resolved by `../auto-plan-issue/scripts/resolve_plan_paths.sh "$REPO_PATH" docs/agents/issues docs/agents/plans <id>` (re-run it here, resolved relative to the `auto-plan-issue` skill folder, if you no longer have them at hand).
2. Wait for CI, then merge if it passes — one combined call:
   ```bash
   scripts/wait_ci_and_merge.sh "$REPO_PATH" "<your AI model noreply email>"
   ```
   > Resolve `scripts/wait_ci_and_merge.sh` relative to the `auto-fix-all` skill folder. Same **NEVER poll** rule as `wait_ci.sh` above — call it directly and let it block, with `timeout: 600000` when invoking it via the Bash tool. The trailing `<your AI model noreply email>` argument is optional and passed straight through to `github.sh pr-merge` — see the note on that call above.

   First output line `passed`: the merge already happened internally (second line is the merged PR's URL) — nothing left to call. Run cleanup (the script infers the branch name from the issue ID):
   ```bash
   scripts/github.sh cleanup-branch "$REPO_PATH" <id>
   ```
   > Resolve `scripts/github.sh` relative to the `auto-fix-all` skill folder.

   Report `OUTCOME=merged`. Done — stop here.

   First output line `failed`: subsequent lines are the failed check-run names, CI never reached a merge attempt. Read [handle_comment.md](handle_comment.md)'s **"Choosing the responsible agent(s)"** section and apply the same agent-selection approach to the failed check-run names: dispatch the responsible specialist agent(s) (or yourself, as architect, if none seem responsible) in parallel with the instruction to investigate the CI failure, fix it, run the full dev cycle locally, and commit via `../../auto-fix-issue/scripts/commit_change.sh` (resolved relative to the `auto-fix-issue` skill folder). If a dispatch is blocked (see [handle_comment.md](handle_comment.md)'s "Dispatching" → "If a dispatch is blocked"), stop immediately and report that same `OUTCOME=blocked AGENT=<agent-name> ACTION="<description>"` at the top level. After all agents commit, go back to step 2 above (`wait_ci_and_merge.sh`, not `wait_ci.sh`) to re-check.

### If `commented`

The lines after the first are the new comments, one per `---`-separated block — only comments from `<pr_owner>` are included. Each block starts with an `id: <node id>` line and a `url: <html url>` line, followed by the comment body. The underlying monitor script already added a `:eyes:` reaction to each of these comments and recorded them as `open`; it will swap that to `:+1:` and mark them `addressed` the next time it (re)starts — i.e. after you push the fixes below.

Read [handle_comment.md](handle_comment.md) and follow its instructions, carrying `REPO_PATH` forward unchanged, to dispatch each comment to the right agent(s) and apply the feedback. Some comments may be pure questions, replied to directly with no code change; others are actionable and result in a commit — see `handle_comment.md` for how it routes each.

If `handle_comment.md` reports `OUTCOME=blocked AGENT=<agent-name> ACTION="<description>"` instead of completing normally, stop processing this issue immediately and report that same outcome at the top level — do not return to "Monitor the PR".

After all comments are handled, go back to "Monitor the PR" above (block on the monitor step again) to resume monitoring.

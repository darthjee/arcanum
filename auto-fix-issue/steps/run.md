# Autonomously Implement a Planned Issue

You are the **architect**. Your job is to autonomously coordinate the implementation of a planned issue — no questions to the user, no confirmation loop, unlike the interactive `fix-issue` skill. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`. `REPO_PATH` (the target project's root) is carried in from your invocation prompt or from whichever nested caller read this file directly — thread it through to every script call below that resolves the GitHub repo or performs a git operation (Step 2's `create_branch.sh`, Step 3/5's `commit_change.sh` fallback, and [open_pr.md](open_pr.md)'s Step 6), as well as to every `scripts/issue_state.sh` call throughout this file.

The invocation prompt may also carry `NESTED=true`, set by a nested caller such as `auto-fix-all`. Its absence means this is a top-level run. When present, pass `NESTED=true` on to any run this skill nests in turn (currently none). It changes how every exit ends: see [Closing report](#closing-report) below, which defines the report for every exit path.

## Step 0 — Resume check

Run:

```bash
scripts/issue_state.sh "$REPO_PATH" get <id> step
```

> Resolve `scripts/issue_state.sh` relative to the `auto-fix-issue` skill folder.

If the file `.claude/state/issue-<id>.json` does not exist or the `step` field is absent or empty, start from Step 1 (no resume).

If a step name is returned, skip all steps up to and including the recorded one and resume from the next step. The canonical step names and their corresponding steps are:

| Recorded value | Step completed | Resume from |
| --- | --- | --- |
| `plan_located` | Step 1 | Step 2 |
| `branch_created` | Step 2 | Step 3 |
| `agents_listed` | Step 3 | Step 4 |
| `agents_dispatched` | Step 4 | Step 5 |
| `reviewed` | Step 5 | Step 6 |
| `pr_published` | Step 6 | (already done — end with the `success` report below) |

If the recorded value is `pr_published`, the PR is already published: do nothing else. Read the PR number with:

```bash
scripts/issue_state.sh "$REPO_PATH" get <id> pr_id
```

and end with the `success` report (see [Closing report](#closing-report)). No `pr-create` or `pr-ready` ran in this run, so `--label-change` is not passed:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-fix-issue --status success --issue <id> --pr <pr_id> \
  --summary "PR for #<id> already published; nothing to do." --next "/auto-monitor-issue-pr <id>"
```

> With `NESTED=true`, drop `--next` and add `--nested`, then relay the `FINISH_*` block to your caller (see [Nested runs](#nested-runs)).

## Step 1 — Locate the issue and plan

Parse the issue ID from the skill argument (accept `5` or `#5` — strip the leading `#` if present). IDs must be numeric and correspond to an existing GitHub issue; `scripts/resolve_plan_paths.sh` enforces this and will error out otherwise.

Run:

```bash
scripts/resolve_plan_paths.sh "$REPO_PATH" docs/agents/issues docs/agents/plans <id>
```

> Resolve `scripts/resolve_plan_paths.sh` relative to the `auto-fix-issue` skill folder. This is the same resolver script used by `auto-plan-issue`.

If no numeric id can be parsed, or the script exits non-zero (e.g. no issue file found for `<id>`), **fail with** `resolve_plan_paths.sh` (see [Failed exits](#failed-exits)). Pass `--issue <id>` only if a numeric id was parsed; otherwise omit it. With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Otherwise, parse the key=value output to obtain `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, and `PLAN_EXISTS`.

- If `PLAN_EXISTS=false`, **fail with** `locate plan`, with `--issue <id>` (see [Failed exits](#failed-exits)) — this skill never invents a plan. The summary says no plan exists, e.g. `"locate plan failed: no plan for #<id>; run /auto-plan-issue <id> first."`. This command belongs in the summary text only: a `failed` report never carries `--next`. With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Read `ISSUE_FILE` and `PLAN_FILE`.

Once the above completes successfully, record the step:

```bash
scripts/issue_state.sh "$REPO_PATH" set <id> step plan_located
```

## Step 2 — Create the branch

Run:

```bash
scripts/create_branch.sh "$REPO_PATH" <PLAN_DIR> <id>
```

> Resolve `scripts/create_branch.sh` relative to the `auto-fix-issue` skill folder.

If it exits non-zero, **fail with** `create_branch.sh`, with `--issue <id>` (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

This reads the branch name from `## Branch` in `plan.md`, falling back to `issue-<id>`, and checks out (creating if needed) that branch. All subsequent work happens here.

Then bring the branch up to date with `main` before any agent is dispatched:

```bash
scripts/merge_main.sh "$REPO_PATH"
```

> Resolve `scripts/merge_main.sh` relative to the `auto-fix-issue` skill folder.

- **`STATUS=ok`**: continue below.
- **`STATUS=conflict`**: apply the same responsible-agent-selection approach as [../auto-fix-all/steps/handle_comment.md](../auto-fix-all/steps/handle_comment.md)'s "Choosing the responsible agent(s)" section, treating each conflicted path it printed like a failed check-run name — dispatch the responsible specialist(s) (or resolve it yourself, as architect, if none seem responsible) to fix the conflict, then run `git -C "$REPO_PATH" add` on the resolved paths and `git -C "$REPO_PATH" commit` with no message argument (the merge-commit message `git merge --no-edit` already prepared is reused as-is) — never bare `git add`/`git commit`, which would operate against the Bash tool's ambient cwd instead of the target repo. No user interaction.

If `merge_main.sh` exits non-zero, or the conflict cannot be resolved, **fail with** `merge_main.sh`, with `--issue <id>`, naming the conflicted paths in the summary when there are any (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Once the branch is checked out and merged up to date with `main` (conflict resolved, if any), record the step:

```bash
scripts/issue_state.sh "$REPO_PATH" set <id> step branch_created
```

## Step 3 — Determine which specialist agents have work

Run:

```bash
scripts/list_plan_agents.sh <PLAN_DIR>
```

> Resolve `scripts/list_plan_agents.sh` relative to the `auto-fix-issue` skill folder.

If it exits non-zero, **fail with** `list_plan_agents.sh`, with `--issue <id>` (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Each line printed is the name of a specialist agent that has its own plan file (`<PLAN_DIR>/<agent-name>.md`) — the same convention used by `auto-plan-issue` to split plans. This list is **not** hardcoded to any fixed set of layers; it reflects whatever agents `auto-plan-issue` (or a human) decided were relevant for this issue.

Once the above completes successfully, record the step:

```bash
scripts/issue_state.sh "$REPO_PATH" set <id> step agents_listed
```

- **No output (empty)** — the plan was not split across agents. Treat `PLAN_FILE` itself as the only unit of work and implement it yourself, following the same development cycle described in [dispatch_agents.md](dispatch_agents.md) (implement, run `scripts/run_checks.sh architect`, commit via `scripts/commit_change.sh`). Skip straight to Step 5 once done.
- **One or more lines** — proceed to Step 4 with this list of agent names.

## Step 4 — Dispatch specialist agents in parallel

Read [dispatch_agents.md](dispatch_agents.md) and follow the instructions there to launch one Agent per plan file found in Step 3, all at the same time, each with `subagent_type` equal to its agent name.

If a dispatched specialist reports that it is blocked and cannot complete its plan (or, for an unsplit plan, you cannot complete it yourself), **fail with** `dispatch agents`, with `--issue <id>`, naming the agent in the summary (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Once all dispatched agents have completed, record the step:

```bash
scripts/issue_state.sh "$REPO_PATH" set <id> step agents_dispatched
```

## Step 5 — Review the results

Read [review_and_redispatch.md](review_and_redispatch.md) and follow the instructions there to verify the implementation, checks, and shared contracts, re-dispatching any agent whose work is incomplete or incorrect until everything is correct.

If an agent's work is still incomplete or incorrect after re-dispatch (e.g. checks keep failing), **fail with** `review`, with `--issue <id>`, naming the agent in the summary (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Once the review passes and all work is confirmed correct, record the step:

```bash
scripts/issue_state.sh "$REPO_PATH" set <id> step reviewed
```

## Step 6 — Publish the PR

Once every agent has committed correct, complete work, read [open_pr.md](open_pr.md) and follow the instructions there (carrying `REPO_PATH` forward unchanged) to push the branch and open or mark ready the pull request.

If any step inside [open_pr.md](open_pr.md) fails (e.g. a `gh` error from `scripts/github.sh`), **fail with** `open PR`, with `--issue <id>` (see [Failed exits](#failed-exits)). With `NESTED=true`, add `--nested` (see [Nested runs](#nested-runs)).

Once the PR is published (opened or marked ready), record the step:

```bash
scripts/issue_state.sh "$REPO_PATH" set <id> step pr_published
```

Do not ask for confirmation at any point in this flow. Then end with the `success` report defined in [open_pr.md](open_pr.md)'s "Report" section, relayed verbatim as the last thing you print (see [Closing report](#closing-report)).

## Closing report

Every exit of this skill ends with exactly one report printed by the shared script:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-fix-issue --status success|failed \
  --summary "<one line>" [--issue <id>] [--pr <n>] [--label-change :pr] \
  [--next "/auto-monitor-issue-pr <id>"] [--nested]
```

> Resolve `../arcanum/_lib/finish_report.sh` relative to the `auto-fix-issue` skill folder, the same folder the `scripts/...` calls in these steps resolve against. This skill never asks the user anything, so there is no `declined` status.

- Relay its stdout **verbatim** as the last thing you print. Never hand-format, extend, or paraphrase it.
- Pass only what actually happened: `--issue <id>` only once an id is known, `--pr <n>` only once a PR exists, and `--label-change :pr` only when `pr-create` or `pr-ready` ran in this run.
- `failed` reports never carry `--next`.
- If the script itself exits non-zero (usage error), say in one line that the closing report could not be rendered, and end.

### Nested runs

When your invocation carried `NESTED=true`, make every `finish_report.sh` call in this file (and in [open_pr.md](open_pr.md)) with the same flags **minus `--next`**, **plus `--nested`**. The script then prints a `FINISH_*` result block instead of a report. End by relaying that block verbatim to your caller, with no report and no `Next:` line.

### Failed exits

Whenever a step above says "**fail with** `<step>`", stop the skill right there. Leave the branch and any commits already made as they are, and do not retry. Print the `failed` report, with a summary naming the failed step:

```bash
../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill auto-fix-issue --status failed [--issue <id>] \
  --summary "<step> failed: <short reason>."
```

Pass `--issue <id>` only when the id was parsed when the step failed. Then end, with no `--next`.

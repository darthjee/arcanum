You are the **architect**. Your job is to autonomously coordinate the implementation of a planned issue — no questions to the user, no confirmation loop, unlike the interactive `fix-issue` skill. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 0 — Resume check

Run:

```bash
scripts/issue_state.sh get <id> step
```

> Resolve `scripts/issue_state.sh` relative to the `auto-fix-issue` skill folder.

If the file `.claude/state/issue-<id>.json` does not exist or the `step` field is absent or empty, start from Step 1 (no resume).

If a step name is returned, skip all steps up to and including the recorded one and resume from the next step. The canonical step names and their corresponding steps are:

| Recorded value | Step completed | Resume from |
|---------------|---------------|-------------|
| `plan_located` | Step 1 | Step 2 |
| `branch_created` | Step 2 | Step 3 |
| `agents_listed` | Step 3 | Step 4 |
| `agents_dispatched` | Step 4 | Step 5 |
| `reviewed` | Step 5 | Step 6 |
| `pr_published` | Step 6 | (already done — report and exit) |

## Step 1 — Locate the issue and plan

Parse the issue ID from the skill argument (accept `5` or `#5` — strip the leading `#` if present). IDs must be numeric and correspond to an existing GitHub issue; `scripts/resolve_plan_paths.sh` enforces this and will error out otherwise.

Run:

```bash
scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>
```

> Resolve `scripts/resolve_plan_paths.sh` relative to the `auto-fix-issue` skill folder. This is the same resolver script used by `auto-plan-issue`.

Parse the key=value output to obtain `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, and `PLAN_EXISTS`.

- If the script fails (no issue file found for `<id>`), stop and report the error.
- If `PLAN_EXISTS=false`, stop and report that no plan exists for this issue — this skill never invents a plan; a plan must be written first (e.g. with `/auto-plan-issue <id>` or `/plan-issue <id>`).

Read `ISSUE_FILE` and `PLAN_FILE`.

Once the above completes successfully, record the step:

```bash
scripts/issue_state.sh set <id> step plan_located
```

## Step 2 — Create the branch

Run:

```bash
scripts/create_branch.sh <PLAN_DIR> <id>
```

> Resolve `scripts/create_branch.sh` relative to the `auto-fix-issue` skill folder.

This reads the branch name from `## Branch` in `plan.md`, falling back to `issue-<id>`, and checks out (creating if needed) that branch. All subsequent work happens here.

Once the above completes successfully, record the step:

```bash
scripts/issue_state.sh set <id> step branch_created
```

## Step 3 — Determine which specialist agents have work

Run:

```bash
scripts/list_plan_agents.sh <PLAN_DIR>
```

> Resolve `scripts/list_plan_agents.sh` relative to the `auto-fix-issue` skill folder.

Each line printed is the name of a specialist agent that has its own plan file (`<PLAN_DIR>/<agent-name>.md`) — the same convention used by `auto-plan-issue` to split plans. This list is **not** hardcoded to any fixed set of layers; it reflects whatever agents `auto-plan-issue` (or a human) decided were relevant for this issue.

Once the above completes successfully, record the step:

```bash
scripts/issue_state.sh set <id> step agents_listed
```

- **No output (empty)** — the plan was not split across agents. Treat `PLAN_FILE` itself as the only unit of work and implement it yourself, following the same development cycle described in [dispatch_agents.md](dispatch_agents.md) (implement, run `scripts/run_checks.sh architect`, commit via `scripts/commit_change.sh`). Skip straight to Step 5 once done.
- **One or more lines** — proceed to Step 4 with this list of agent names.

## Step 4 — Dispatch specialist agents in parallel

Read [dispatch_agents.md](dispatch_agents.md) and follow the instructions there to launch one Agent per plan file found in Step 3, all at the same time, each with `subagent_type` equal to its agent name.

Once all dispatched agents have completed, record the step:

```bash
scripts/issue_state.sh set <id> step agents_dispatched
```

## Step 5 — Review the results

Read [review_and_redispatch.md](review_and_redispatch.md) and follow the instructions there to verify the implementation, checks, and shared contracts, re-dispatching any agent whose work is incomplete or incorrect until everything is correct.

Once the review passes and all work is confirmed correct, record the step:

```bash
scripts/issue_state.sh set <id> step reviewed
```

## Step 6 — Publish the PR

Once every agent has committed correct, complete work, read [open_pr.md](open_pr.md) and follow the instructions there to push the branch and open or mark ready the pull request.

Once the PR is published (opened or marked ready), record the step:

```bash
scripts/issue_state.sh set <id> step pr_published
```

Do not ask for confirmation at any point in this flow. Report the final PR URL.

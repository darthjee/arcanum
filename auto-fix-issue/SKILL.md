---
name: auto-fix-issue
description: Autonomously implements a planned issue with no user interaction. Discovers the specialist agents involved in the plan, dispatches them in parallel, reviews and re-dispatches until correct, then opens or marks ready a pull request. Usage: /auto-fix-issue <id> or /auto-fix-issue #<id>
---

You are acting as the **architect**. Your job is to autonomously coordinate the implementation of a planned issue — no questions to the user, no confirmation loop, unlike the interactive `fix-issue` skill. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 1 — Locate the issue and plan

Parse the issue ID from the skill argument (accept `5`, `#5`, or `X01` style local ids — strip the leading `#` if present).

Run:

```bash
scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>
```

This is the same resolver script used by `auto-plan-issue`. Parse the key=value output to obtain `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, and `PLAN_EXISTS`.

- If the script fails (no issue file found for `<id>`), stop and report the error.
- If `PLAN_EXISTS=false`, stop and report that no plan exists for this issue — this skill never invents a plan; a plan must be written first (e.g. with `/auto-plan-issue <id>` or `/plan-issue <id>`).

Read `ISSUE_FILE` and `PLAN_FILE`.

## Step 2 — Create the branch

Run:

```bash
scripts/create_branch.sh <PLAN_DIR> <id>
```

This reads the branch name from `## Branch` in `plan.md`, falling back to `issue-<id>`, and checks out (creating if needed) that branch. All subsequent work happens here.

## Step 3 — Determine which specialist agents have work

Run:

```bash
scripts/list_plan_agents.sh <PLAN_DIR>
```

Each line printed is the name of a specialist agent that has its own plan file (`<PLAN_DIR>/<agent-name>.md`) — the same convention used by `auto-plan-issue` to split plans. This list is **not** hardcoded to any fixed set of layers; it reflects whatever agents `auto-plan-issue` (or a human) decided were relevant for this issue.

- **No output (empty)** — the plan was not split across agents. Treat `PLAN_FILE` itself as the only unit of work and implement it yourself, following the same development cycle described in [steps/dispatch_agents.md](steps/dispatch_agents.md) (implement, test/lint, commit via `scripts/commit_change.sh`). Skip straight to Step 5 once done.
- **One or more lines** — proceed to Step 4 with this list of agent names.

## Step 4 — Dispatch specialist agents in parallel

Read [steps/dispatch_agents.md](steps/dispatch_agents.md) and follow the instructions there to launch one Agent per plan file found in Step 3, all at the same time, each with `subagent_type` equal to its agent name.

## Step 5 — Review the results

Read [steps/review_and_redispatch.md](steps/review_and_redispatch.md) and follow the instructions there to verify the implementation, checks, and shared contracts, re-dispatching any agent whose work is incomplete or incorrect until everything is correct.

## Step 6 — Publish the PR

Once every agent has committed correct, complete work, read [steps/open_pr.md](steps/open_pr.md) and follow the instructions there to push the branch and open or mark ready the pull request.

Do not ask for confirmation at any point in this flow. Report the final PR URL.

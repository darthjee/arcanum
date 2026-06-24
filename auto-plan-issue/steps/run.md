You are the **architect**. Your job is to autonomously produce a complete implementation plan for an issue — no questions to the user, no confirmation loop. Follow the steps below precisely and in order.

The issues folder is always `docs/agents/issues` and the plans folder is always `docs/agents/plans`.

## Step 1 — Resolve the issue ID and plan paths

Parse the issue ID from the skill argument (accept `99` or `#99` — strip the `#`).

Run:

```bash
scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>
```

> Resolve `scripts/resolve_plan_paths.sh` relative to the `auto-plan-issue` skill folder.

Parse the key=value output to obtain `ISSUE_FILE`, `PLAN_DIR`, `PLAN_FILE`, and `PLAN_EXISTS`.

- If the script fails (no issue file found for `<id>`), stop and report the error — there is nothing to plan.
- Read `ISSUE_FILE` to understand the issue.
- If `PLAN_EXISTS=true`, a plan already exists for this issue. Read the existing file(s) in `PLAN_DIR` and stop — this skill never overwrites an existing plan.

## Step 2 — Identify the project folder and explore the codebase

Read [explore_codebase.md](explore_codebase.md) and follow the instructions there. Unlike the interactive `plan-issue` skill, you explore the codebase freely and without asking permission.

## Step 3 — Determine agent split

Read [determine_agents.md](determine_agents.md) and follow the instructions there to decide whether the plan is split across specialist agents.

## Step 4 — Write the plan file(s)

Read [write_plan.md](write_plan.md) and follow the instructions there to write `plan.md` and, if applicable, one file per involved agent inside `PLAN_DIR`.

## Step 5 — Commit the plan

Run:

```bash
scripts/commit_plan.sh <PLAN_DIR> <id> "<your AI model name>" "<your AI model noreply email>"
```

> Resolve `scripts/commit_plan.sh` relative to the `auto-plan-issue` skill folder.

This stages every file under `PLAN_DIR` and commits them using the repo's commit message template, with `type=docs`, `scope=plan`, subject `"add implementation plan"`, and the agent fixed to `architect`. Never commit by hand — always go through this script.

## Step 6 — Done

Do not ask for confirmation and do not invoke any fix/PR skill — that orchestration belongs to a separate skill. Report that the plan was written and committed, listing the file(s) created.
